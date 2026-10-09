/**
 * archive-extractor.ts
 * Giải nén các file nén người dùng gửi: ZIP, RAR, TAR, TAR.GZ/TGZ, GZ.
 * Trả về cùng kiểu ZipExtractResult để chỗ gọi (document-reader, batch-ocr) dùng chung.
 *
 * - ZIP: giao cho zip-extractor (fflate)
 * - RAR: node-unrar-js (WASM, không cần binary ngoài; hỗ trợ mật khẩu)
 * - TAR/TGZ/GZ: zlib + bộ đọc tar tối giản
 * Có giới hạn số file và tổng dung lượng để chống bom nén.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { createLogger } from "../shared/logger.js";
import { extractZipFile, type ZipExtractResult } from "./zip-extractor.js";

const log = createLogger("archive-extractor");

export type ArchiveExtractResult = ZipExtractResult;

/** Đuôi file nén được hỗ trợ (đã gồm .zip). */
export const ARCHIVE_EXTS = [".zip", ".rar", ".tar", ".tgz", ".gz"] as const;

const MAX_ENTRIES = 200;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

const ALLOWED_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".heic", ".webp",
  ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".ods", ".csv", ".tsv", ".txt", ".md",
  ".json", ".xml", ".html", ".htm", ".rtf",
]);

const SKIP_PATTERNS = [/^__MACOSX\//, /\/\._/, /(^|\/)\.DS_Store$/, /Thumbs\.db$/i, /desktop\.ini$/i];

export function isArchivePath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return (ARCHIVE_EXTS as readonly string[]).includes(ext);
}

/** Cho phép đoán theo magic bytes với file không đuôi. */
export function detectArchiveKind(filePath: string): "zip" | "rar" | "gz" | "tar" | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".zip") return "zip";
  if (ext === ".rar") return "rar";
  if (ext === ".tar") return "tar";
  if (ext === ".tgz" || ext === ".gz") return "gz";
  if (ext) return null;
  try {
    const fd = fs.openSync(filePath, "r");
    const b = Buffer.alloc(8);
    fs.readSync(fd, b, 0, 8, 0);
    fs.closeSync(fd);
    if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "zip";
    if (b.subarray(0, 4).toString("latin1") === "Rar!") return "rar";
    if (b[0] === 0x1f && b[1] === 0x8b) return "gz";
  } catch { /* bỏ qua */ }
  return null;
}

type Entry = { name: string; data: Uint8Array };

class Collector {
  readonly tempDir = path.join(os.tmpdir(), `vbaibot-arc-${crypto.randomBytes(6).toString("hex")}`);
  readonly filePaths: string[] = [];
  skippedCount = 0;
  private total = 0;
  constructor(private readonly keepAll = false) { fs.mkdirSync(this.tempDir, { recursive: true }); }

  add(entry: Entry): void {
    const name = entry.name.replace(/\\/g, "/");
    if (name.endsWith("/") || SKIP_PATTERNS.some((p) => p.test(name))) return;
    const ext = path.extname(name).toLowerCase();
    if (!this.keepAll && !ALLOWED_EXTS.has(ext)) { this.skippedCount++; return; }
    if (this.filePaths.length >= MAX_ENTRIES) { this.skippedCount++; return; }
    this.total += entry.data.length;
    if (this.total > MAX_TOTAL_BYTES) throw new Error("Nội dung giải nén vượt giới hạn dung lượng cho phép");
    const safe = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_") || `file${ext}`;
    const dest = this.filePaths.length > 0 ? `${String(this.filePaths.length).padStart(4, "0")}_${safe}` : safe;
    const full = path.join(this.tempDir, dest);
    fs.writeFileSync(full, Buffer.from(entry.data));
    this.filePaths.push(full);
  }

  result(): ArchiveExtractResult {
    return { filePaths: this.filePaths, tempDir: this.tempDir, skippedCount: this.skippedCount };
  }
  abort(): void { try { fs.rmSync(this.tempDir, { recursive: true, force: true }); } catch { /* bỏ qua */ } }
}

/** Đọc các entry file thường trong buffer tar (không nén). */
export function parseTar(buf: Buffer): Entry[] {
  const out: Entry[] = [];
  let off = 0;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const readStr = (s: number, e: number) => header.subarray(s, e).toString("utf-8").replace(/\0.*$/s, "");
    const size = parseInt(readStr(124, 136).trim() || "0", 8) || 0;
    const type = String.fromCharCode(header[156] || 48);
    const prefix = readStr(345, 500);
    const name = prefix ? `${prefix}/${readStr(0, 100)}` : readStr(0, 100);
    off += 512;
    if (off + size > buf.length) break;
    if (type === "0" || type === "\0") out.push({ name, data: buf.subarray(off, off + size) });
    off += Math.ceil(size / 512) * 512;
  }
  return out;
}

function gunzip(buf: Buffer): Buffer {
  return zlib.gunzipSync(buf, { maxOutputLength: MAX_TOTAL_BYTES });
}

async function extractRar(buf: Buffer, c: Collector, password?: string): Promise<void> {
  const { createExtractorFromData } = await import("node-unrar-js");
  const data = new Uint8Array(buf).buffer;
  const extractor = await createExtractorFromData({ data, password });
  const { files } = extractor.extract();
  for (const f of files) {
    if (f.fileHeader.flags.directory || !f.extraction) continue;
    c.add({ name: f.fileHeader.name, data: f.extraction });
  }
}

/**
 * Giải nén một file nén bất kỳ ra thư mục tạm. Caller phải gọi cleanupZipTemp(tempDir).
 * Ném Error (tiếng Việt) nếu hỏng/cần mật khẩu.
 */
export async function extractArchiveFile(
  filePath: string,
  password?: string,
  opts: { keepAll?: boolean } = {},
): Promise<ArchiveExtractResult> {
  const kind = detectArchiveKind(filePath);
  if (!kind) throw new Error(`Không nhận ra định dạng file nén: ${path.basename(filePath)}`);
  if (kind === "zip") return extractZipFile(filePath);

  const c = new Collector(opts.keepAll);
  try {
    const raw = fs.readFileSync(filePath);
    if (kind === "rar") {
      await extractRar(raw, c, password);
    } else if (kind === "tar") {
      for (const e of parseTar(raw)) c.add(e);
    } else {
      const plain = gunzip(raw);
      const isTar = plain.length > 262 && plain.subarray(257, 262).toString("latin1") === "ustar";
      if (isTar) {
        for (const e of parseTar(plain)) c.add(e);
      } else {
        const inner = path.basename(filePath).replace(/\.(gz|tgz)$/i, "") || "file.txt";
        c.add({ name: path.extname(inner) ? inner : `${inner}.txt`, data: plain });
      }
    }
  } catch (err) {
    c.abort();
    const msg = err instanceof Error ? err.message : String(err);
    const needPw = /password|ERAR_(MISSING|BAD)_PASSWORD/i.test(msg);
    throw new Error(
      needPw
        ? `File nén "${path.basename(filePath)}" có mật khẩu${password ? " (mật khẩu không đúng)" : ", cần cung cấp mật khẩu"}`
        : `Không đọc được file nén "${path.basename(filePath)}": ${msg}`,
    );
  }
  log.info({ file: path.basename(filePath), kind, files: c.filePaths.length, skipped: c.skippedCount }, "Giải nén hoàn tất");
  return c.result();
}
