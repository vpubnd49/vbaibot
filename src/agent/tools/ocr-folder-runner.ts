/**
 * Phần chạy của ocr_folder_to_file: kiểm đường dẫn an toàn, gom ảnh trong hội thoại,
 * OCR hàng loạt rồi xuất + gửi file. Tách từ ocr-folder-to-file-tool.ts (trước ~300 dòng).
 */
import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../shared/logger.js";
import { dataDir } from "../../config/env.js";
import { batchOcr } from "../../documents/batch-ocr-engine.js";
import { renderXlsxFromRows } from "../../documents/render-xlsx-from-rows.js";
import { renderDocxFromPages } from "../../documents/render-docx-from-pages.js";
import { renderCsvFromRows } from "../../documents/render-text-documents.js";
import { renderPdf } from "../../documents/render-pdf.js";
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

export function isSafePath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  return SAFE_ROOTS.some(root =>
    resolved === root || resolved.startsWith(root + path.sep)
  );
}

/** Extend co gioi han 300 anh (cho batch OCR toan bo anh trong hoi thoai) */
export function collectAllRecentImagePaths(ctx: ToolContext): string[] {
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

export async function runOcr(
  ctx: ToolContext,
  ocrSource: Parameters<typeof batchOcr>[0],
  ocrCfg: { mode: "table" | "text" | "auto"; prompt?: string; sortBy?: string; sortColumn?: string; dedupKey?: string },
  outputFormat: string,
  outputFileName: string | undefined,
  caption: string | undefined,
): Promise<string | ReturnType<typeof ketQuaLoi>> {
  try {
    const { pages, rows, text, stats } = await batchOcr(ocrSource, {
      mode: ocrCfg.mode,
      prompt: ocrCfg.prompt,
      concurrency: 2,
      maxTokens: 8192,
      sortBy: (ocrCfg.sortBy as any) ?? "none",
      sortColumn: ocrCfg.sortColumn,
      dedupKey: ocrCfg.dedupKey,
    });

    if (stats.totalFiles === 0) return ketQuaLoi("Khong tim thay file hop le de xu ly.");

    // Chan triet de: Khong bao gio xuat file rong khi OCR that bai toan bo
    if (stats.processedFiles === 0 || (rows.length === 0 && !text.trim())) {
      const firstErr = pages.find(p => p.error)?.error;
      const errHint = firstErr ? ` (${firstErr})` : "";
      log.warn({ stats, firstErr }, "OCR that bai toan bo, khong co noi dung de xuat file");
      return ketQuaLoi(
        `Khong trich xuat duoc noi dung tu file (xu ly ${stats.processedFiles}/${stats.totalFiles} file thanh cong).${errHint} ` +
        `Co the do he thong AI nhan dien hinh anh dang qua tai (Too Many Requests / 429) hoac file khong co chu doc duoc. ` +
        `Vui long thu lai sau giay lat hoac gui file text/Word thay the.`
      );
    }

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
      const pagesData = text
        ? [{ filename: "OCR", text }]
        : rows.map((r, i) => ({ filename: `Muc ${i + 1}`, text: Object.entries(r).map(([k, v]) => `${k}: ${v ?? ""}`).join("\n") }));
      data = await renderDocxFromPages(pagesData, { title: baseName });
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

    if (!data || data.length === 0) {
      return ketQuaLoi("Noi dung trich xuat rong, khong the tao file.");
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
