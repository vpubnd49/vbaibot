/**
 * batch-ocr-engine.ts
 * Core engine OCR hang loat: PDF text/scan, anh, Word, Excel → text hoac bang JSON.
 * Tai su dung vision-sidecar va document-reader hien co.
 *
 * Su dung:
 *   import { batchOcr } from "../documents/batch-ocr-engine.js";
 *   const { rows, text, stats } = await batchOcr({ kind: "folder", folderPath: "..." }, cfg);
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { createLogger } from "../shared/logger.js";

const log = createLogger("batch-ocr-engine");

// ── Types ────────────────────────────────────────────────────────────────────

export type OcrSource =
  | { kind: "folder"; folderPath: string; extensions?: string[] }
  | { kind: "files"; filePaths: string[] };

export type OcrMode = "table" | "text" | "auto";
export type SortMode = "score_desc" | "score_asc" | "name_asc" | "none";

export type OcrConfig = {
  mode: OcrMode;
  prompt?: string;         // Override prompt
  concurrency?: number;    // Mac dinh: 3
  maxTokens?: number;      // Mac dinh: 8192
  sortBy?: SortMode;
  sortColumn?: string;     // Mac dinh: "tong_diem"
  dedupKey?: string;       // Ten cot dedup (vd: "so_bao_danh")
  maxFiles?: number;       // Gioi han so file (mac dinh: 200)
};

export type OcrRow = Record<string, string | number | null>;

export type OcrPageResult = {
  filePath: string;
  pageNum?: number;
  rows?: OcrRow[];
  text?: string;
  rawContent?: string;
  error?: string;
};

export type OcrStats = {
  totalFiles: number;
  processedFiles: number;
  totalRows: number;
  failedFiles: number;
  durationMs: number;
};

// ── Supported extensions ─────────────────────────────────────────────────────

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".heic", ".webp"]);
const DOC_EXTS   = new Set([".pdf", ".docx", ".doc", ".xlsx", ".xls", ".ods", ".csv", ".txt", ".md"]);
const ALL_EXTS   = new Set([...IMAGE_EXTS, ...DOC_EXTS]);

function isSupported(filePath: string, extensions?: string[]): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (extensions?.length) return extensions.includes(ext);
  return ALL_EXTS.has(ext);
}

// ── Detect PDF type ──────────────────────────────────────────────────────────

/** Phat hien PDF co text layer hay scan anh — export de script ben ngoai dung lai */
export async function detectPdfKind(filePath: string): Promise<"text" | "scan"> {
  try {
    const pdfModule: any = await import("pdf-parse");
    const buf = fs.readFileSync(filePath);
    const fn = typeof pdfModule === "function" ? pdfModule : pdfModule.default;
    if (fn) {
      const data = await fn(buf);
      const text: string = data.text ?? "";
      const pages: number = Math.max(1, data.numpages ?? 1);
      if (text.trim().length / pages >= 100) return "text";
    }
  } catch { /* ignore */ }
  return "scan";
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const TABLE_PROMPT =
  "This document page contains a data table. Extract ALL rows as a JSON array. " +
  "Return ONLY the JSON array — no markdown fences, no explanation. " +
  "Each element is an object with column names as keys. " +
  "Use exact Vietnamese text (preserve diacritics). Numbers stay as numbers (82.5 not \"82.5\"). " +
  "If no table found, return [].";

const TEXT_PROMPT =
  "Extract complete text from this page. Preserve Vietnamese diacritics exactly. " +
  "Render tables as markdown (| col |). Preserve headings and numbering. Return text only.";

const AUTO_PROMPT =
  "Analyze this image. " +
  "If it contains a DATA TABLE (score lists, multi-column tables): return a JSON array of row objects ONLY. " +
  "Otherwise: extract text preserving Vietnamese diacritics, tables as markdown, headings. " +
  "Do NOT mix JSON and text — one format only.";

// ── Concurrency ───────────────────────────────────────────────────────────────

async function withConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const run = async (): Promise<void> => {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]!();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => run()));
  return results;
}

// ── Vision call with retry ────────────────────────────────────────────────────

async function callVision(b64: string, mime: string, prompt: string, maxTokens: number, retries = 3): Promise<string> {
  const { askAboutImage } = await import("../agent/vision-sidecar.js");
  const image = { base64: b64, mediaType: mime };
  for (let i = 0; i < retries; i++) {
    try {
      return await (askAboutImage as any)(image, prompt, maxTokens);
    } catch (err) {
      const msg = String(err);
      const retry = msg.includes("429") || msg.includes("rate") || msg.includes("503");
      if (!retry || i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error("Het so lan retry");
}

// ── Parse JSON response ───────────────────────────────────────────────────────

/** Giai so Viet de: 1.234,5 → 1234.5; 82,5 → 82.5 */
function parseViNumber(s: string | unknown): number | null {
  if (typeof s === "number") return s;
  if (typeof s !== "string") return null;
  const clean = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

export function parseTableContent(content: string): OcrRow[] | null {
  const s = content.replace(/^```[\w]*\r?\n?/m, "").replace(/\r?\n?```$/m, "").trim();
  const m = s.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr) || arr.length === 0) return [];
    // Normalize: chuyen so string → number
    return arr.map((row: Record<string, unknown>) => {
      const out: OcrRow = {};
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "number") { out[k] = v; continue; }
        const n = parseViNumber(v);
        out[k] = n !== null && String(v).trim() !== "" && !isNaN(n) ? n : (v as string | null);
      }
      return out;
    });
  } catch { return null; }
}

function isLikelyTable(content: string): boolean {
  const t = content.trim();
  return t.startsWith("[") || t.startsWith("```json\n[") || (t.includes("| ") && t.includes(" |"));
}

// ── OCR image buffer ──────────────────────────────────────────────────────────

const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".webp": "image/webp",
  ".bmp": "image/bmp", ".tiff": "image/tiff",
  ".tif": "image/tiff", ".heic": "image/heic",
};

async function ocrBuffer(
  buf: Buffer, mime: string, filePath: string, pageNum: number | undefined,
  mode: OcrMode, prompt: string | undefined, maxTokens: number,
): Promise<OcrPageResult> {
  const promptText = prompt ?? (mode === "table" ? TABLE_PROMPT : mode === "text" ? TEXT_PROMPT : AUTO_PROMPT);
  let raw: string;
  try {
    raw = await callVision(buf.toString("base64"), mime, promptText, maxTokens);
  } catch (err) {
    return { filePath, pageNum, error: String(err) };
  }

  if (mode === "table" || (mode === "auto" && isLikelyTable(raw))) {
    const rows = parseTableContent(raw);
    if (rows !== null) return { filePath, pageNum, rows, rawContent: raw };
  }
  return { filePath, pageNum, text: raw.trim(), rawContent: raw };
}

// ── OCR single image file ─────────────────────────────────────────────────────

async function processImageFile(fp: string, cfg: OcrConfig): Promise<OcrPageResult[]> {
  const ext = path.extname(fp).toLowerCase();
  try {
    const buf = fs.readFileSync(fp);
    const result = await ocrBuffer(buf, IMAGE_MIME[ext] ?? "image/jpeg", fp, undefined, cfg.mode, cfg.prompt, cfg.maxTokens ?? 8192);
    return [result];
  } catch (err) { return [{ filePath: fp, error: String(err) }]; }
}

// ── pdftoppm helpers ──────────────────────────────────────────────────────────

function checkPdftoppm(): Promise<boolean> {
  return new Promise(r => execFile("pdftoppm", ["-v"], { timeout: 3000 }, e => r(!e)));
}
function runPdftoppm(pdfPath: string, outDir: string, s: number, e: number): Promise<void> {
  return new Promise((res, rej) => {
    execFile("pdftoppm", ["-png", "-r", "200", "-f", String(s), "-l", String(e), pdfPath, path.join(outDir, "page")],
      { timeout: 120_000 }, (err, _, stderr) => err ? rej(new Error(`pdftoppm: ${stderr || err.message}`)) : res());
  });
}

// ── OCR PDF file ──────────────────────────────────────────────────────────────

async function processPdfFile(fp: string, cfg: OcrConfig): Promise<OcrPageResult[]> {
  // Thu doc text layer
  let pdfText = ""; let totalPages = 0;
  try {
    const m: any = await import("pdf-parse");
    const fn = typeof m === "function" ? m : m.default;
    if (fn) { const d = await fn(fs.readFileSync(fp)); pdfText = d.text ?? ""; totalPages = d.numpages ?? 1; }
  } catch { /* ignore */ }

  const avgChars = totalPages > 0 ? pdfText.trim().length / totalPages : 0;
  if (avgChars >= 100) return [{ filePath: fp, text: pdfText.trim() }];

  // PDF scan
  const hasTool = await checkPdftoppm();
  if (!hasTool) return [{ filePath: fp, error: "PDF scan nhung chua co pdftoppm (cai poppler-utils)" }];

  const { isSidecarConfigured } = await import("../config/runtime-vision-settings.js");
  if (!isSidecarConfigured()) return [{ filePath: fp, error: "Vision sidecar chua cau hinh" }];

  const pages = Math.max(1, totalPages || 20);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "batch-ocr-"));
  const results: OcrPageResult[] = [];
  try {
    await runPdftoppm(fp, tmpDir, 1, pages);
    const pngs = fs.readdirSync(tmpDir).filter(f => f.endsWith(".png")).sort();
    for (let i = 0; i < pngs.length; i++) {
      const buf = fs.readFileSync(path.join(tmpDir, pngs[i]!));
      results.push(await ocrBuffer(buf, "image/png", fp, i + 1, cfg.mode, cfg.prompt, cfg.maxTokens ?? 8192));
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  return results.length > 0 ? results : [{ filePath: fp, error: "pdftoppm khong xuat duoc anh" }];
}

// ── OCR doc/spreadsheet via document-reader ───────────────────────────────────

async function processDocFile(fp: string): Promise<OcrPageResult[]> {
  try {
    const { readDocument } = await import("./document-reader.js");
    const r = await readDocument(fp);
    return [{ filePath: fp, text: r.text }];
  } catch (err) { return [{ filePath: fp, error: String(err) }]; }
}

// ── Route file to handler ─────────────────────────────────────────────────────

async function processFile(fp: string, cfg: OcrConfig): Promise<OcrPageResult[]> {
  const ext = path.extname(fp).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return processImageFile(fp, cfg);
  if (ext === ".pdf")       return processPdfFile(fp, cfg);
  return processDocFile(fp);
}

// ── Collect files ─────────────────────────────────────────────────────────────

function collectFiles(source: OcrSource, maxFiles: number): string[] {
  if (source.kind === "files") {
    return source.filePaths.filter(fp => fs.existsSync(fp) && isSupported(fp)).slice(0, maxFiles);
  }
  const dir = source.folderPath;
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => {
      const fp = path.join(dir, f);
      return fs.statSync(fp).isFile() && isSupported(fp, source.extensions);
    })
    .map(f => path.join(dir, f))
    .sort((a, b) => {
      const na = parseInt(a.match(/Page(\d+)/i)?.[1] ?? "0");
      const nb = parseInt(b.match(/Page(\d+)/i)?.[1] ?? "0");
      return na !== nb ? na - nb : a.localeCompare(b);
    })
    .slice(0, maxFiles);
}

// ── Sort rows ─────────────────────────────────────────────────────────────────

function sortRows(rows: OcrRow[], sortBy: SortMode, col: string): OcrRow[] {
  if (sortBy === "none") return rows;
  if (sortBy === "name_asc") {
    return [...rows].sort((a, b) => String(a.ho_ten ?? a.name ?? "").localeCompare(String(b.ho_ten ?? b.name ?? ""), "vi"));
  }
  return [...rows].sort((a, b) => {
    const va = Number(a[col] ?? 0); const vb = Number(b[col] ?? 0);
    return sortBy === "score_desc" ? vb - va : va - vb;
  });
}

// ── Main API ──────────────────────────────────────────────────────────────────

export async function batchOcr(
  source: OcrSource,
  cfg: OcrConfig,
): Promise<{ pages: OcrPageResult[]; rows: OcrRow[]; text: string; stats: OcrStats }> {
  const t0 = Date.now();
  const filePaths = collectFiles(source, cfg.maxFiles ?? 200);
  log.info({ totalFiles: filePaths.length, mode: cfg.mode, source: source.kind }, "Bat dau batch OCR");

  const tasks = filePaths.map((fp, i) => async () => {
    log.debug({ i: i + 1, total: filePaths.length, file: path.basename(fp) }, "OCR file");
    return processFile(fp, cfg);
  });

  const nestedResults = await withConcurrency(tasks, cfg.concurrency ?? 3);
  const allPages = nestedResults.flat();

  // Gom rows (table mode)
  const seenKeys = new Set<string>();
  let allRows: OcrRow[] = [];
  for (const page of allPages) {
    if (!page.rows) continue;
    for (const row of page.rows) {
      if (cfg.dedupKey) {
        const k = String(row[cfg.dedupKey] ?? "").trim().toUpperCase();
        if (!k || seenKeys.has(k)) continue;
        seenKeys.add(k);
      }
      allRows.push(row);
    }
  }
  if (cfg.sortBy && cfg.sortBy !== "none") {
    allRows = sortRows(allRows, cfg.sortBy, cfg.sortColumn ?? "tong_diem");
  }

  // Gom text
  const allText = allPages
    .filter(p => p.text)
    .map(p => `--- ${path.basename(p.filePath)}${p.pageNum ? ` Trang ${p.pageNum}` : ""} ---\n${p.text}`)
    .join("\n\n");

  const stats: OcrStats = {
    totalFiles: filePaths.length,
    processedFiles: allPages.filter(p => !p.error).length,
    totalRows: allRows.length,
    failedFiles: allPages.filter(p => p.error).length,
    durationMs: Date.now() - t0,
  };
  log.info(stats, "Hoan thanh batch OCR");
  return { pages: allPages, rows: allRows, text: allText, stats };
}
