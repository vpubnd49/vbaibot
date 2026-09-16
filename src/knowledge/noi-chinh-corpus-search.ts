/**
 * Tra cứu kho văn bản NỘI CHÍNH — 3.327 mẫu thật.
 *
 * Corpus nạp 1 lần khi khởi động, lưu trong RAM (~16MB). Agent gọi
 * `searchCorpus(keywords)` để tìm mẫu VB giống nhất, trả về nội dung
 * đầy đủ để tham khảo khi soạn thảo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../shared/logger.js";

const log = createLogger("noi-chinh-corpus");

interface CorpusEntry {
  path: string;
  category: string;
  filename: string;
  text: string;
}

let corpus: CorpusEntry[] | null = null;

function getCorpusPath(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // Thứ tự ưu tiên: cùng thư mục → src/knowledge/ → data/
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
  return candidates[0]!; // fallback, sẽ fail khi load
}

/** Nạp corpus 1 lần (lazy load khi gọi search đầu tiên) */
function loadCorpus(): CorpusEntry[] {
  if (corpus) return corpus;

  const corpusPath = getCorpusPath();
  try {
    const raw = fs.readFileSync(corpusPath, "utf-8");
    corpus = JSON.parse(raw) as CorpusEntry[];
    log.info({ count: corpus.length, path: corpusPath }, "Nạp corpus NỘI CHÍNH");
    return corpus;
  } catch (err) {
    log.warn({ err, path: corpusPath }, "Không đọc được corpus NỘI CHÍNH");
  }

  corpus = [];
  return corpus;
}

/**
 * Tìm văn bản mẫu theo từ khóa.
 *
 * Thuật toán: đếm số từ khóa xuất hiện trong filename + text,
 * xếp theo score giảm dần, trả về top N.
 */
export function searchCorpus(
  keywords: string,
  options?: { category?: string; maxResults?: number },
): { path: string; category: string; filename: string; text: string; score: number }[] {
  const entries = loadCorpus();
  const max = options?.maxResults ?? 5;
  const filterCat = options?.category?.toLowerCase();

  // Tách từ khóa, chuẩn hóa
  const terms = keywords
    .toLowerCase()
    .replace(/[,;.!?()]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (terms.length === 0) return [];

  const scored = entries
    .filter((e) => !filterCat || e.category.toLowerCase().includes(filterCat))
    .map((entry) => {
      const haystack = (entry.filename + " " + entry.text).toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score++;
        // Bonus nếu xuất hiện trong filename (quan trọng hơn)
        if (entry.filename.toLowerCase().includes(term)) score += 2;
      }
      return { ...entry, score };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);

  return scored;
}

/**
 * Tìm theo category (thư mục cấp 1), trả về tất cả file trong đó.
 */
export function listByCategory(category: string): { path: string; filename: string }[] {
  const entries = loadCorpus();
  return entries
    .filter((e) => e.category === category)
    .map((e) => ({ path: e.path, filename: e.filename }));
}

/**
 * Lấy nội dung 1 file theo đường dẫn tương đối.
 */
export function getByPath(relPath: string): CorpusEntry | undefined {
  const entries = loadCorpus();
  return entries.find((e) => e.path === relPath);
}

/** Danh sách tất cả category và số file */
export function corpusStats(): { category: string; count: number }[] {
  const entries = loadCorpus();
  const map = new Map<string, number>();
  for (const e of entries) {
    map.set(e.category, (map.get(e.category) || 0) + 1);
  }
  return [...map.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}
