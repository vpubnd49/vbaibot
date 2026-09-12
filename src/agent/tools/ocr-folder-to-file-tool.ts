import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../shared/logger.js";
import { dataDir } from "../../config/env.js";
import { batchOcr } from "../../documents/batch-ocr-engine.js";
import { renderXlsxFromRows } from "../../documents/render-xlsx-from-rows.js";
import { renderDocxFromPages } from "../../documents/render-docx-from-pages.js";
import { renderCsvFromRows } from "../../documents/render-text-documents.js";
import { renderPdf } from "../../documents/render-pdf.js";
import { collectRecentFilePaths } from "./read-document-tool.js";
import { checkDocumentRateLimit } from "../../documents/document-rate-limit.js";
import { withNamedTempFile } from "../../shared/temp-file-store.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { getRecentMessages } from "../../conversation/history-store.js";
import type { ToolContext } from "./index.js";

const log = createLogger("ocr-folder-to-file");

// Thu muc duoc phep doc
const SAFE_ROOTS = [
  path.resolve(dataDir),
  path.resolve("bosung"),
  path.resolve("data", "shared-files"),
  path.resolve("data", "exports"),
];

function isSafePath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return SAFE_ROOTS.some(root =>
    resolved === root || resolved.startsWith(root + path.sep)
  );
}

/** Extend co gioi han 300 anh (cho batch OCR toan bo anh trong hoi thoai) */
function collectAllRecentImagePaths(ctx: ToolContext): string[] {
  const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".heic", ".webp"]);
  const paths: string[] = [];

  // 1. Tu batch hien tai
  for (let i = ctx.batch.length - 1; i >= 0; i--) {
    const msg = ctx.batch[i] as any;
    for (const img of (msg.images ?? [])) {
      const p = typeof img === "string" ? img : img?.localPath;
      if (p && IMAGE_EXTS.has(path.extname(p).toLowerCase()) && !paths.includes(p)) paths.push(p);
    }
  }

  // 2. Tu SQLite history (lay tat ca, khong gioi han)
  const history = getRecentMessages(ctx.account.id, ctx.message.threadId, 200);
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i] as any;
    for (const img of (msg.images ?? [])) {
      const p = typeof img === "string" ? img : img?.localPath;
      if (p && IMAGE_EXTS.has(path.extname(p).toLowerCase()) && !paths.includes(p)) paths.push(p);
    }
  }

  // 3. Fallback: quet dia media/<accountId>/<threadId>/
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_") || "x";
  const mediaDir = path.join(dataDir, "media", sanitize(ctx.account.id), sanitize(ctx.message.threadId));
  if (fs.existsSync(mediaDir)) {
    try {
      const entries = fs.readdirSync(mediaDir, { withFileTypes: true });
      const imgs = entries
        .filter(e => e.isFile() && IMAGE_EXTS.has(path.extname(e.name).toLowerCase()))
        .map(e => ({ p: path.join(mediaDir, e.name), mtime: fs.statSync(path.join(mediaDir, e.name)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      for (const { p } of imgs) {
        if (!paths.includes(p)) paths.push(p);
      }
    } catch { /* bo qua */ }
  }

  return paths.slice(0, 300);
}

/** Deliver file Buffer qua Zalo */
async function deliverFile(
  ctx: Pick<ToolContext, "api" | "account" | "message" | "ghiNhanDaGui">,
  fileName: string,
  data: Buffer,
  caption?: string,
): Promise<string> {
  const threadKey = `${ctx.account.id}:${ctx.message.threadId}`;
  await withNamedTempFile(fileName, data, filePath =>
    guiFileKemCaption(ctx.api, threadKey, ctx.message.threadId, ctx.message.threadType, filePath, caption),
  );
  ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(fileName, caption));
  log.info({ fileName, bytes: data.length }, "Da gui file OCR export");
  return `Da tao va GUI file ${fileName} (${Math.round(data.length / 1024)} KB) cho nguoi dung. KHONG goi send_file gui lai.`;
}

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

    execute: async ({ source, folderPath, fileExtensions, fileIndexes, ocrMode, customPrompt,
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
        const filePaths = fileIndexes?.length
          ? fileIndexes.map(i => allPaths[i]).filter((p): p is string => !!p)
          : allPaths; // Lay tat ca neu khong chi ro index
        if (filePaths.length === 0) return ketQuaLoi("Khong tim thay file tai index da chon.");
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

// ── Runner ────────────────────────────────────────────────────────────────────

async function runOcr(
  ctx: ToolContext,
  ocrSource: Parameters<typeof batchOcr>[0],
  ocrCfg: { mode: "table" | "text" | "auto"; prompt?: string; sortBy?: string; sortColumn?: string; dedupKey?: string },
  outputFormat: string,
  outputFileName: string | undefined,
  caption: string | undefined,
): Promise<string | ReturnType<typeof ketQuaLoi>> {
  try {
    const { rows, text, stats } = await batchOcr(ocrSource, {
      mode: ocrCfg.mode,
      prompt: ocrCfg.prompt,
      concurrency: 3,
      maxTokens: 8192,
      sortBy: (ocrCfg.sortBy as any) ?? "none",
      sortColumn: ocrCfg.sortColumn,
      dedupKey: ocrCfg.dedupKey,
    });

    if (stats.totalFiles === 0) return ketQuaLoi("Khong tim thay file hop le de xu ly.");

    const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    const baseName = (outputFileName ?? `OCR_${ts}`).replace(/\.[a-z]+$/i, "");

    let data: Buffer;
    let ext: string;

    if (outputFormat === "excel") {
      if (rows.length === 0) {
        return ketQuaLoi(
          `OCR xong ${stats.processedFiles} file nhung khong trich xuat duoc bang du lieu. ` +
          `Thu ocrMode=text hoac xem lai chat luong anh. ${stats.failedFiles > 0 ? `Loi: ${stats.failedFiles} file.` : ""}`,
        );
      }
      data = await renderXlsxFromRows(rows, { title: baseName, sortColumn: ocrCfg.sortColumn });
      ext = "xlsx";
    } else if (outputFormat === "csv") {
      if (rows.length === 0) return ketQuaLoi("Khong co bang bieu de xuat CSV.");
      data = renderCsvFromRows(rows);
      ext = "csv";
    } else if (outputFormat === "word") {
      const pages = text
        ? [{ filename: "OCR", text }]
        : rows.map((r, i) => ({ filename: `Muc ${i + 1}`, text: Object.entries(r).map(([k, v]) => `${k}: ${v ?? ""}`).join("\n") }));
      data = await renderDocxFromPages(pages, { title: baseName });
      ext = "docx";
    } else if (outputFormat === "pdf") {
      const sections = text
        ? [{ title: baseName, paragraphs: text.split("\n").filter(l => l.trim()) }]
        : rows.map((r, i) => ({ title: `Muc ${i + 1}`, paragraphs: Object.entries(r).map(([k, v]) => `${k}: ${v ?? ""}`) }));
      data = renderPdf(baseName, sections);
      ext = "pdf";
    } else {
      data = Buffer.from(text || rows.map(r => Object.values(r).join("\t")).join("\n"), "utf-8");
      ext = "txt";
    }

    const fileName = `${baseName}.${ext}`;
    const captionFinal = caption ??
      `OCR xong: ${rows.length > 0 ? rows.length + " dong du lieu" : stats.processedFiles + " file"}. ` +
      `Xu ly ${stats.processedFiles}/${stats.totalFiles} file (${Math.round(stats.durationMs / 1000)}s).`;

    return deliverFile(ctx, fileName, data, captionFinal);
  } catch (err) {
    log.error({ err }, "ocr_folder_to_file that bai");
    return ketQuaLoi(`Loi OCR: ${err instanceof Error ? err.message : String(err)}`);
  }
}
