/**
 * ocr-folder-to-file-tool.ts
 * Tool agent: nhan folder/files → batch OCR → xuat Excel/Word/CSV/PDF/TXT → gui Zalo.
 *
 * Source co the la:
 *   - "folder"       : duong dan thu muc (phai nam trong SAFE_ROOTS)
 *   - "recent_files" : index file tu hoi thoai hien tai (giong read_document)
 *   - "shared_files" : ten file trong data/shared-files/
 */
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
import type { ToolContext } from "./index.js";

const log = createLogger("ocr-folder-to-file");

// Thu muc duoc phep doc — them "bosung" va "shared-files"
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

/** Deliver file Buffer qua Zalo giong pattern create-document-tools.ts */
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
      "Doc hang loat file (anh JPG/PNG, PDF text/scan, Word, Excel) tu thu muc hoac danh sach file, " +
      "tu dong OCR bang Gemini Vision neu can, trich xuat noi dung va xuat ket qua thanh file Excel/Word/CSV/PDF/TXT roi gui cho nguoi dung. " +
      "Dung cho: bang diem thi nhieu trang, ho so scan, bao cao nhieu file, thu muc anh tai lieu. " +
      "BATCH MODE: xu ly ca thu muc (source=folder) hoac nhieu file trong hoi thoai (source=recent_files). " +
      "Table mode: trich xuat bang bieu JSON → xuat Excel/CSV dep. " +
      "Text mode: noi dung van ban → xuat Word/PDF/TXT.",
    inputSchema: z.object({
      // ── INPUT ──
      source: z.enum(["folder", "recent_files", "shared_files"]).describe(
        "Nguon file: folder=tu thu muc, recent_files=file vua gui trong hoi thoai, shared_files=kho shared-files",
      ),
      folderPath: z.string().optional().describe(
        "Duong dan thu muc can xu ly (chi khi source=folder). Vi du: bosung/DS",
      ),
      fileExtensions: z.array(z.string()).optional().describe(
        "Chi xu ly cac dinh dang nay, vi du [\".jpg\",\".png\"]. Bo trong = tat ca dinh dang ho tro.",
      ),
      fileIndexes: z.array(z.coerce.number().int().min(0)).optional().describe(
        "Index cac file trong hoi thoai (chi khi source=recent_files). 0=moi nhat.",
      ),

      // ── OCR CONFIG ──
      ocrMode: z.enum(["table", "text", "auto"]).default("auto").describe(
        "table=trich bang bieu JSON (diem thi, danh sach...), text=van ban thuan, auto=tu nhan biet",
      ),
      customPrompt: z.string().optional().describe(
        "Prompt tuy chinh cho Vision OCR (tuy chon, bo trong = dung prompt mac dinh theo mode)",
      ),
      sortBy: z.enum(["score_desc", "score_asc", "name_asc", "none"]).default("none").describe(
        "Sap xep ket qua: score_desc=tong diem cao→thap (cho bang diem thi), none=giu nguyen thu tu",
      ),
      sortColumn: z.string().optional().describe(
        "Ten cot dung de sap xep (mac dinh: tong_diem). Vi du: diem_viet, tong_diem",
      ),
      dedupKey: z.string().optional().describe(
        "Ten cot dung de loai trung (vi du: so_bao_danh). Bo trong = khong loai trung.",
      ),

      // ── OUTPUT ──
      outputFormat: z.enum(["excel", "word", "csv", "pdf", "txt"]).describe(
        "Dinh dang file dau ra: excel=xlsx dep voi mau sac, word=docx A4, csv=bang phang, pdf=tai lieu, txt=van ban",
      ),
      outputFileName: z.string().optional().describe(
        "Ten file dau ra (tu dong dat ten neu bo trong)",
      ),
      caption: z.string().optional().describe("Loi nhan gui kem file"),
    }),

    execute: async ({ source, folderPath, fileExtensions, fileIndexes, ocrMode, customPrompt, sortBy, sortColumn, dedupKey, outputFormat, outputFileName, caption }) => {
      // Rate limit
      const rate = checkDocumentRateLimit(`${ctx.account.id}:${ctx.message.threadId}`);
      if (!rate.ok) return ketQuaLoi(rate.reason);

      // Lay danh sach file theo source
      let filePaths: string[] = [];

      if (source === "folder") {
        if (!folderPath) return ketQuaLoi("Vui long cung cap duong dan thu muc (folderPath).");
        const absFolder = path.isAbsolute(folderPath) ? folderPath : path.resolve(folderPath);
        if (!isSafePath(absFolder)) {
          return ketQuaLoi(`Thu muc "${folderPath}" khong nam trong vung duoc phep truy cap.`);
        }
        if (!fs.existsSync(absFolder)) return ketQuaLoi(`Thu muc "${folderPath}" khong ton tai.`);
        // batch-ocr-engine se tu doc thu muc
        const ocrSource = { kind: "folder" as const, folderPath: absFolder, extensions: fileExtensions };
        return runOcr(ctx, ocrSource, { mode: ocrMode, prompt: customPrompt, sortBy, sortColumn, dedupKey },
          outputFormat, outputFileName, caption, deliverFile);
      }

      if (source === "recent_files") {
        const allPaths = collectRecentFilePaths(ctx);
        if (allPaths.length === 0) return ketQuaLoi("Khong co file nao trong hoi thoai gan day.");
        const idxList = fileIndexes ?? [0];
        filePaths = idxList.map(i => allPaths[i]).filter((p): p is string => !!p);
        if (filePaths.length === 0) return ketQuaLoi(`Khong tim thay file tai cac index da chon.`);
      } else if (source === "shared_files") {
        const sharedDir = path.join(dataDir, "shared-files");
        filePaths = (fileIndexes ?? []).map(i => path.join(sharedDir, String(i))).filter(p => fs.existsSync(p));
        if (filePaths.length === 0) return ketQuaLoi("Khong tim thay file trong shared-files.");
      }

      const ocrSource = { kind: "files" as const, filePaths };
      return runOcr(ctx, ocrSource, { mode: ocrMode, prompt: customPrompt, sortBy, sortColumn, dedupKey },
        outputFormat, outputFileName, caption, deliverFile);
    },
  });
}

// ── Runner ─────────────────────────────────────────────────────────────────────

async function runOcr(
  ctx: ToolContext,
  ocrSource: Parameters<typeof batchOcr>[0],
  ocrCfg: { mode: "table" | "text" | "auto"; prompt?: string; sortBy?: string; sortColumn?: string; dedupKey?: string },
  outputFormat: string,
  outputFileName: string | undefined,
  caption: string | undefined,
  deliver: typeof deliverFile,
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

    if (stats.totalFiles === 0) return ketQuaLoi("Khong tim thay file nao hop le de xu ly.");

    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
    const baseName = outputFileName?.replace(/\.[a-z]+$/i, "") ?? `OCR_Export_${ts}`;

    let data: Buffer;
    let ext: string;
    let summary: string;

    if (outputFormat === "excel") {
      if (rows.length === 0) return ketQuaLoi(`OCR xong ${stats.processedFiles} file nhung khong trich xuat duoc bang bieu. Thu dung ocrMode=text.`);
      data = await renderXlsxFromRows(rows, {
        sheetName: "Ket qua OCR",
        title: baseName,
        sortColumn: ocrCfg.sortColumn,
      });
      ext = "xlsx";
      summary = `${rows.length} dong du lieu tu ${stats.processedFiles} file`;
    } else if (outputFormat === "csv") {
      if (rows.length === 0) return ketQuaLoi(`Khong co bang bieu de xuat CSV. Thu outputFormat=txt.`);
      data = renderCsvFromRows(rows);
      ext = "csv";
      summary = `${rows.length} dong`;
    } else if (outputFormat === "word") {
      const pages = text ? [{ filename: "OCR", text }] : rows.map((r, i) => ({ filename: `Dong ${i + 1}`, text: Object.entries(r).map(([k, v]) => `${k}: ${v}`).join("\n") }));
      data = await renderDocxFromPages(pages, { title: baseName });
      ext = "docx";
      summary = `${stats.processedFiles} file → ${pages.length} trang`;
    } else if (outputFormat === "pdf") {
      const sections = text
        ? [{ title: baseName, paragraphs: text.split("\n").filter(l => l.trim()) }]
        : rows.map((r, i) => ({ title: `Dong ${i + 1}`, paragraphs: Object.entries(r).map(([k, v]) => `${k}: ${v}`) }));
      data = renderPdf(baseName, sections);
      ext = "pdf";
      summary = `${stats.processedFiles} file → PDF`;
    } else {
      // txt
      const content = text || rows.map(r => Object.values(r).join("\t")).join("\n");
      data = Buffer.from(content, "utf-8");
      ext = "txt";
      summary = `${stats.processedFiles} file`;
    }

    const fileName = `${baseName}.${ext}`;
    const captionText = caption ?? `OCR xong: ${summary}. Xu ly ${stats.processedFiles}/${stats.totalFiles} file (${Math.round(stats.durationMs / 1000)}s).`;
    return deliver(ctx, fileName, data, captionText);
  } catch (err) {
    log.error({ err }, "ocr_folder_to_file that bai");
    return ketQuaLoi(`Loi khi xu ly OCR: ${err instanceof Error ? err.message : String(err)}`);
  }
}
