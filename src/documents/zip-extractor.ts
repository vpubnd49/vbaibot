/**
 * zip-extractor.ts
 * Giai nen file ZIP bang fflate (pure-JS, khong can native binding).
 * Dung trong batch-ocr-engine de xu ly file .zip nguoi dung gui len.
 *
 * Logic:
 *  1. Doc ZIP tu Buffer hoac duong dan file
 *  2. Loc ra cac file co dinh dang ho tro (anh, PDF, Word, Excel...)
 *  3. Ghi cac file do vao thu muc tam (os.tmpdir)
 *  4. Tra ve danh sach duong dan tuyet doi de OCR
 *  5. Caller phai goi cleanup() sau khi OCR xong
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { unzipSync } from "fflate";
import { createLogger } from "../shared/logger.js";

const log = createLogger("zip-extractor");

// Dinh dang duoc phep giai nen va OCR
const ALLOWED_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".heic", ".webp",
  ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".ods", ".csv", ".txt", ".md",
]);

// Bo qua cac file he thong nen trong ZIP (macOS/Windows metadata)
const SKIP_PATTERNS = [
  /^__MACOSX\//,
  /\/\._/,
  /^\.DS_Store$/,
  /Thumbs\.db$/i,
  /desktop\.ini$/i,
];

function shouldSkip(entryName: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(entryName));
}

export type ZipExtractResult = {
  /** Duong dan cac file da giai nen ra thu muc tam */
  filePaths: string[];
  /** Thu muc tam - caller goi cleanup() sau khi dung xong */
  tempDir: string;
  /** So file bi bo qua do dinh dang khong ho tro */
  skippedCount: number;
};

/**
 * Giai nen ZIP tu Buffer.
 * @param zipBuffer  Noi dung file ZIP
 * @param nameHint   Ten file goc (chi de log)
 */
export function extractZipBuffer(zipBuffer: Buffer, nameHint = "upload.zip"): ZipExtractResult {
  const tempDir = path.join(os.tmpdir(), `vbaibot-zip-${crypto.randomBytes(6).toString("hex")}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const filePaths: string[] = [];
  let skippedCount = 0;

  try {
    const unzipped = unzipSync(new Uint8Array(zipBuffer));

    for (const [entryName, data] of Object.entries(unzipped)) {
      // Bo qua thu muc (ten ket thuc bang /)
      if (entryName.endsWith("/")) continue;
      if (shouldSkip(entryName)) continue;

      const ext = path.extname(entryName).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) {
        skippedCount++;
        log.debug({ entry: entryName, ext }, "Bo qua entry khong ho tro");
        continue;
      }

      // Dam bao ten file an toan (tranh path traversal)
      const safeName = path.basename(entryName).replace(/[^a-zA-Z0-9._-]/g, "_") || `file${ext}`;
      // Them index de tranh trung ten
      const destName = filePaths.length > 0 ? `${String(filePaths.length).padStart(4, "0")}_${safeName}` : safeName;
      const destPath = path.join(tempDir, destName);

      fs.writeFileSync(destPath, Buffer.from(data));
      filePaths.push(destPath);
      log.debug({ entry: entryName, destName, bytes: data.length }, "Da giai nen file tu ZIP");
    }
  } catch (err) {
    // Don dep neu loi
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* bo qua */ }
    throw new Error(`Khong doc duoc file ZIP "${nameHint}": ${err instanceof Error ? err.message : String(err)}`);
  }

  log.info({ zip: nameHint, totalFiles: filePaths.length, skippedCount, tempDir }, "Giai nen ZIP hoan tat");
  return { filePaths, tempDir, skippedCount };
}

/**
 * Giai nen ZIP tu duong dan file tren dia.
 */
export function extractZipFile(zipPath: string): ZipExtractResult {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`File ZIP khong ton tai: ${zipPath}`);
  }
  const buf = fs.readFileSync(zipPath);
  return extractZipBuffer(buf, path.basename(zipPath));
}

/**
 * Xoa thu muc tam sau khi OCR xong.
 */
export function cleanupZipTemp(tempDir: string): void {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    log.debug({ tempDir }, "Da don dep thu muc tam ZIP");
  } catch (err) {
    log.warn({ tempDir, err }, "Khong don dep duoc thu muc tam ZIP");
  }
}

/**
 * Kiem tra file co phai ZIP khong (kiem tra magic bytes, khong chi dua vao ext).
 */
export function isZipFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    // Magic bytes cua ZIP: PK\x03\x04
    return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  } catch {
    return false;
  }
}
