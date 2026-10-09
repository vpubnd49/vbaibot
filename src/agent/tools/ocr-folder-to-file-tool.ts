import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../shared/logger.js";
import { dataDir } from "../../config/env.js";
import { collectRecentFilePaths } from "./read-document-tool.js";
import { listChoices, originalNames, pickIndex } from "./recent-file-picker.js";
import { checkDocumentRateLimit } from "../../documents/document-rate-limit.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import type { ToolContext } from "./index.js";
import { collectAllRecentImagePaths, isSafePath, runOcr } from "./ocr-folder-runner.js";

const log = createLogger("ocr-folder-to-file");

export function createOcrFolderToFileTool(ctx: ToolContext) {
  return tool({
    description:
      "[GỌI NGAY khi user gửi ZIP, nhiều ảnh, hoặc yêu cầu đọc/xuất từ file/thư mục] " +
      "Tool này ĐỌC ĐƯỢC: ảnh JPG/PNG/TIFF/HEIC, PDF (text + scan), DOCX, XLSX, CSV, TXT, và ĐẶC BIỆT là file ZIP (tự giải nén, đọc tất cả bên trong). " +
      "TUYỆT ĐỐI KHÔNG tự nói 'không đọc được ZIP' hoặc 'không có công cụ giải nén' — GỌI TOOL NÀY với source=recent_files là xong. " +
      "Sau khi đọc xong, tự động xuất file Excel/Word/CSV/PDF/TXT và gửi cho người dùng. " +
      "Khi user gửi FILE ZIP → source='recent_files' (tool tự giải nén). " +
      "Khi user gửi ẢNH qua Zalo → source='recent_images'. " +
      "Khi biết đường dẫn thư mục trên server → source='folder'.",
    inputSchema: z.object({
      source: z.enum(["folder", "recent_files", "recent_images", "shared_files"]).describe(
        "Nguon file: recent_images=TAT CA anh da gui trong hoi thoai (dung cho anh Zalo), " +
        "recent_files=file tai lieu da gui (PDF/Word/Excel), " +
        "folder=duong dan thu muc tren server, shared_files=kho shared-files",
      ),
      folderPath: z.string().optional().describe(
        "Duong dan thu muc (chi khi source=folder). Vi du: bosung/DS",
      ),
      fileExtensions: z.array(z.string()).optional().describe(
        "Chi xu ly dinh dang nay, vi du [\".jpg\",\".png\"]. Bo trong = tat ca.",
      ),
      fileIndexes: z.array(z.coerce.number().int().min(0)).optional().describe(
        "Index cu the (tuy chon). Bo trong = lay TAT CA file/anh.",
      ),
      fileNames: z.array(z.string()).optional().describe(
        "Chi xu ly file co TEN GOC chua cac chuoi nay (khop khong dau), chi ap dung source=recent_files. " +
        "Uu tien hon fileIndexes vi danh sach file lan ca anh, index de tro nham.",
      ),
      ocrMode: z.enum(["table", "text", "auto"]).default("auto").describe(
        "table=trich bang bieu JSON (diem thi, danh sach so lieu), text=van ban thuan, auto=tu nhan biet",
      ),
      customPrompt: z.string().optional().describe("Prompt tuy chinh cho Vision OCR"),
      sortBy: z.enum(["score_desc", "score_asc", "name_asc", "none"]).default("none").describe(
        "Sap xep: score_desc=cao xuong thap (cho bang diem thi), none=giu thu tu",
      ),
      sortColumn: z.string().optional().describe("Ten cot sap xep (mac dinh: tong_diem)"),
      dedupKey: z.string().optional().describe("Ten cot loai trung (vi du: so_bao_danh)"),
      outputFormat: z.enum(["excel", "word", "csv", "pdf", "txt"]).describe(
        "excel=xlsx dep, word=docx A4, csv=bang phang, pdf, txt",
      ),
      outputFileName: z.string().optional().describe("Ten file dau ra (tu dong dat neu bo trong)"),
      caption: z.string().optional().describe("Loi nhan gui kem file"),
    }),

    execute: async ({ source, folderPath, fileExtensions, fileIndexes, fileNames, ocrMode, customPrompt,
                      sortBy, sortColumn, dedupKey, outputFormat, outputFileName, caption }) => {
      const rate = checkDocumentRateLimit(`${ctx.account.id}:${ctx.message.threadId}`);
      if (!rate.ok) return ketQuaLoi(rate.reason);

      // ── Xac dinh nguon file ───────────────────────────────────────────────

      if (source === "folder") {
        if (!folderPath) return ketQuaLoi("Vui long cung cap folderPath.");
        const absFolder = path.isAbsolute(folderPath) ? folderPath : path.resolve(folderPath);
        if (!isSafePath(absFolder)) return ketQuaLoi(`Thu muc "${folderPath}" khong nam trong vung duoc phep.`);
        if (!fs.existsSync(absFolder)) return ketQuaLoi(`Thu muc "${folderPath}" khong ton tai.`);
        return runOcr(ctx, { kind: "folder", folderPath: absFolder, extensions: fileExtensions },
          { mode: ocrMode, prompt: customPrompt, sortBy, sortColumn, dedupKey },
          outputFormat, outputFileName, caption);
      }

      if (source === "recent_images") {
        // Thu thap TAT CA anh da gui trong hoi thoai (khong gioi han so luong)
        const rawPaths = collectAllRecentImagePaths(ctx);
        if (rawPaths.length === 0) {
          return ketQuaLoi("Khong tim thay anh nao trong hoi thoai. Hay gui anh roi thu lai.");
        }
        // Convert relative → absolute
        const imagePaths = rawPaths.map(p => path.isAbsolute(p) ? p : path.join(dataDir, p));
        log.info({ count: imagePaths.length, sample: imagePaths[0] }, "Batch OCR recent_images");
        return runOcr(ctx, { kind: "files", filePaths: imagePaths },
          { mode: ocrMode, prompt: customPrompt, sortBy, sortColumn, dedupKey },
          outputFormat, outputFileName, caption);
      }

      if (source === "recent_files") {
        const rawPaths = collectRecentFilePaths(ctx);
        if (rawPaths.length === 0) return ketQuaLoi("Khong co file nao trong hoi thoai gan day.");
        // Convert relative → absolute (scanDiskMediaFiles trả relative path)
        const allPaths = rawPaths.map(p => path.isAbsolute(p) ? p : path.join(dataDir, p));
        let filePaths: string[];
        if (fileNames?.length) {
          const names = originalNames(ctx);
          const idx = new Set<number>();
          for (const n of fileNames) {
            const r = pickIndex(rawPaths, names, 0, n);
            if ("error" in r) return ketQuaLoi(r.error);
            idx.add(r.index);
          }
          filePaths = [...idx].map(i => allPaths[i]!);
        } else {
          filePaths = fileIndexes?.length
            ? fileIndexes.map(i => allPaths[i]).filter((p): p is string => !!p)
            : allPaths; // Lay tat ca neu khong chi ro index
        }
        if (filePaths.length === 0) {
          return ketQuaLoi(`Khong tim thay file tai index da chon. Cac file hien co:\n${listChoices(rawPaths, originalNames(ctx))}`);
        }
        log.info({ count: filePaths.length, sample: filePaths[0] }, "Batch OCR recent_files");
        return runOcr(ctx, { kind: "files", filePaths },
          { mode: ocrMode, prompt: customPrompt, sortBy, sortColumn, dedupKey },
          outputFormat, outputFileName, caption);
      }

      // shared_files
      const sharedDir = path.join(dataDir, "shared-files");
      const filePaths = (fileIndexes ?? []).map(i => path.join(sharedDir, String(i))).filter(p => fs.existsSync(p));
      if (filePaths.length === 0) return ketQuaLoi("Khong tim thay file trong shared-files.");
      return runOcr(ctx, { kind: "files", filePaths },
        { mode: ocrMode, prompt: customPrompt, sortBy, sortColumn, dedupKey },
        outputFormat, outputFileName, caption);
    },
  });
}
