/**
 * corpus-loader.ts
 *
 * Tách logic đọc file corpus ra module riêng để BM25 và keyword search
 * đều import chung một chỗ, không duplicate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../shared/logger.js";

const log = createLogger("corpus-loader");

export interface CorpusEntry {
  path: string;
  category: string;
  filename: string;
  text: string;
}

let cached: CorpusEntry[] | null = null;

function getCorpusPath(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(__dirname, "noi-chinh-corpus.json"),
    path.resolve(__dirname, "../../src/knowledge/noi-chinh-corpus.json"),
    path.resolve(__dirname, "../src/knowledge/noi-chinh-corpus.json"),
    path.resolve(process.cwd(), "src/knowledge/noi-chinh-corpus.json"),
    path.resolve(process.cwd(), "data/noi-chinh-corpus.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]!;
}

/** Nạp corpus 1 lần, lưu vào bộ nhớ. Thread-safe do Node.js đơn luồng. */
export function loadCorpusEntries(): CorpusEntry[] {
  if (cached) return cached;
  const p = getCorpusPath();
  try {
    cached = JSON.parse(fs.readFileSync(p, "utf-8")) as CorpusEntry[];
    log.info({ count: cached.length, path: p }, "Nạp corpus");
    return cached;
  } catch (err) {
    log.warn({ err, path: p }, "Không đọc được corpus");
    cached = [];
    return cached;
  }
}
