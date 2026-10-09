/**
 * file-converter.ts
 * Chuyển đổi định dạng file kiểu "convert online": tài liệu, bảng tính, ảnh, âm thanh/video, nén ZIP.
 * - Có LibreOffice (soffice) trên máy → dùng cho Office ↔ PDF (giữ bố cục tốt nhất).
 * - Không có → dự phòng bằng trích text + renderer của bot (mất bố cục/hình, giữ chữ và bảng).
 */
import fs from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";
import { readDocument } from "./document-reader.js";
import { renderPdf } from "./render-pdf.js";
import { renderDocx } from "./render-docx.js";
import { renderTextDocument } from "./render-text-documents.js";
import { extractArchiveFile, detectArchiveKind } from "./archive-extractor.js";
import { cleanupZipTemp } from "./zip-extractor.js";
import type { DocumentBlock } from "./document-content-schema.js";
import { ConvertError, ffmpegConvert, jpegsToPdf, pdfToImage, sofficeConvert } from "./converter-binaries.js";

export { ConvertError };

export const CONVERT_TARGETS = [
  "pdf", "docx", "xlsx", "csv", "txt", "md", "html",
  "png", "jpg", "webp", "gif", "mp3", "wav", "m4a", "mp4", "webm", "zip",
] as const;
export type ConvertTarget = (typeof CONVERT_TARGETS)[number];

export type ConvertOutput = { fileName: string; data: Buffer; note?: string };

const IMG = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tif", ".tiff", ".heic"]);
const MEDIA = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".amr", ".webm", ".mp4", ".mov", ".mkv", ".avi"]);
const SHEET = new Set([".xlsx", ".xls", ".ods", ".csv", ".tsv"]);
const MAX_BYTES = 50 * 1024 * 1024;

const csvCell = (v: string) => (/[",\n\t]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const toRows = (text: string) => text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/\t| {2,}/));

async function viaSheetLib(src: string, target: ConvertTarget): Promise<Buffer> {
  const X: any = await import("xlsx");
  const wb = X.read(fs.readFileSync(src), { type: "buffer", cellDates: true });
  const bookType = target === "xlsx" ? "xlsx" : "csv";
  return Buffer.from(X.write(wb, { type: "buffer", bookType }));
}

async function viaText(src: string, target: ConvertTarget, title: string): Promise<Buffer> {
  const doc = await readDocument(src);
  if (doc.error || !doc.text.trim()) throw new ConvertError(doc.error ?? "File không có nội dung đọc được để chuyển đổi");
  const text = doc.text;
  switch (target) {
    case "txt": case "md":
      return Buffer.from(text, "utf-8");
    case "html":
      return renderTextDocument(text, "html", { title });
    case "csv":
      return Buffer.from("\ufeff" + toRows(text).map((r) => r.map(csvCell).join(",")).join("\n"), "utf-8");
    case "pdf":
      return renderPdf(title, [{ paragraphs: text.split(/\r?\n/).filter((l) => l.trim()) }]);
    case "docx": {
      const blocks = text.split(/\r?\n/).filter((l) => l.trim()).map((t) => ({ type: "paragraph", text: t })) as unknown as DocumentBlock[];
      return renderDocx(blocks, { title });
    }
    case "xlsx": {
      const X: any = await import("xlsx");
      const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(toRows(text)), "Sheet1");
      return Buffer.from(X.write(wb, { type: "buffer", bookType: "xlsx" }));
    }
    default:
      throw new ConvertError(`Không chuyển tài liệu sang .${target} được`);
  }
}

async function imageToJpeg(src: string): Promise<Buffer> {
  const ext = path.extname(src).toLowerCase();
  return ext === ".jpg" || ext === ".jpeg" ? fs.readFileSync(src) : ffmpegConvert(src, "jpg");
}

/** Chuyển một file sang định dạng `target`. Ném ConvertError (tiếng Việt) khi không thực hiện được. */
export async function convertFile(src: string, target: ConvertTarget, password?: string): Promise<ConvertOutput> {
  if (!fs.existsSync(src)) throw new ConvertError("Không tìm thấy file nguồn");
  if (fs.statSync(src).size > MAX_BYTES) throw new ConvertError("File nguồn quá lớn (tối đa 50 MB)");
  const ext = path.extname(src).toLowerCase();
  const base = path.parse(src).name;
  const out = (data: Buffer, note?: string): ConvertOutput => ({ fileName: `${base}.${target}`, data, note });
  if (ext.slice(1) === target) throw new ConvertError(`File đã ở định dạng .${target} rồi`);

  const kind = detectArchiveKind(src);
  if (kind && kind !== "zip" && target === "zip") {
    const r = await extractArchiveFile(src, password, { keepAll: true });
    try {
      const files: Record<string, Uint8Array> = {};
      r.filePaths.forEach((p) => { files[path.basename(p)] = new Uint8Array(fs.readFileSync(p)); });
      if (r.filePaths.length === 0) throw new ConvertError("File nén không chứa tệp nào");
      return out(Buffer.from(zipSync(files)), `Đã đóng gói lại ${r.filePaths.length} tệp (tên thư mục con không được giữ)`);
    } finally { cleanupZipTemp(r.tempDir); }
  }
  if (target === "zip") return out(Buffer.from(zipSync({ [path.basename(src)]: new Uint8Array(fs.readFileSync(src)) })));

  if (IMG.has(ext)) {
    if (target === "pdf") return out(jpegsToPdf([await imageToJpeg(src)]));
    if (["png", "jpg", "webp", "gif"].includes(target)) return out(await ffmpegConvert(src, target));
    throw new ConvertError(`Ảnh chỉ chuyển được sang PDF/PNG/JPG/WEBP/GIF, chưa chuyển sang .${target}`);
  }

  if (MEDIA.has(ext)) {
    if (["mp3", "wav", "m4a", "mp4", "webm", "gif", "png", "jpg", "webp"].includes(target)) {
      return out(await ffmpegConvert(src, target));
    }
    throw new ConvertError(`Âm thanh/video chỉ chuyển được sang MP3/WAV/M4A/MP4/WEBM/GIF hoặc ảnh, chưa chuyển sang .${target}`);
  }

  if (["png", "jpg"].includes(target)) {
    if (ext !== ".pdf") throw new ConvertError("Chỉ chuyển PDF sang ảnh (trang đầu tiên)");
    return out(await pdfToImage(src, target as "png" | "jpg"), "Chỉ chuyển trang đầu tiên của PDF");
  }
  if (["webp", "gif", "mp3", "wav", "m4a", "mp4", "webm"].includes(target)) {
    throw new ConvertError(`Tài liệu không chuyển sang .${target} được`);
  }

  const office = await sofficeConvert(src, target);
  if (office) return out(office);

  if (SHEET.has(ext) && (target === "xlsx" || target === "csv")) return out(await viaSheetLib(src, target));
  const fallbackNote = ["pdf", "docx", "xlsx"].includes(target)
    ? "Chuyển ở mức văn bản/bảng: giữ chữ, có thể mất định dạng, hình ảnh và bố cục gốc"
    : undefined;
  return out(await viaText(src, target, base), fallbackNote);
}
