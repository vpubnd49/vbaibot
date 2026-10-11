/**
 * corpus-bm25.ts
 *
 * BM25 index cho kho văn bản Nội chính (3.327 mẫu).
 *
 * Dùng MiniSearch — thuần TypeScript, zero native deps, hỗ trợ tiếng Việt
 * (unicode tokenizer tách theo khoảng trắng + punctuation, đủ cho VB hành chính).
 *
 * Index được build 1 lần (lazy) khi gọi search đầu tiên, mất ~300ms.
 * Kết quả tốt hơn hẳn so với keyword counting:
 *   - IDF: từ hiếm ("kiện toàn BCĐ") được ưu tiên hơn từ phổ biến ("công văn")
 *   - BM25 normalize độ dài: file ngắn và file dài được đánh giá công bằng
 *   - Prefix matching: "pccc" khớp "pccc" trong text
 */
import MiniSearch from "minisearch";
import { createLogger } from "../shared/logger.js";
import { type CorpusEntry, loadCorpusEntries } from "./corpus-loader.js";

export type { CorpusEntry };

const log = createLogger("corpus-bm25");

let index: MiniSearch<CorpusEntry & { id: number }> | null = null;
let entries: (CorpusEntry & { id: number })[] | null = null;

/** Khởi tạo index BM25 (lazy, thread-safe do Node.js single-threaded) */
function ensureIndex(): { index: MiniSearch<CorpusEntry & { id: number }>; entries: (CorpusEntry & { id: number })[] } {
  if (index && entries) return { index, entries };

  const raw = loadCorpusEntries();
  entries = raw.map((e, i) => ({ ...e, id: i }));

  index = new MiniSearch<CorpusEntry & { id: number }>({
    idField: "id",
    fields: ["filename", "category", "text"],
    storeFields: ["path", "category", "filename", "text"],
    searchOptions: {
      // BM25 mặc định (k1=1.2, b=0.75) — cân bằng tốt cho VB hành chính
      boost: { filename: 3, category: 1.5, text: 1 }, // filename quan trọng nhất
      fuzzy: 0.15,   // chấp nhận lỗi chính tả nhỏ
      prefix: true,  // "pccc" khớp "pccc-phuong"
    },
    tokenize: (text) =>
      text
        .toLowerCase()
        .replace(/[.,;:!?()\[\]{}"'\/\\-]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1),
  });

  const t0 = Date.now();
  index.addAll(entries);
  log.info({ count: entries.length, ms: Date.now() - t0 }, "BM25 index sẵn sàng");

  return { index, entries };
}

export type BM25Result = {
  id: number;
  path: string;
  category: string;
  filename: string;
  text: string;
  score: number;
};

/**
 * Tìm kiếm BM25.
 * @param query     Câu hỏi / từ khóa tự nhiên
 * @param opts.category   Lọc theo thư mục (tùy chọn)
 * @param opts.maxResults Số kết quả tối đa (mặc định 10)
 */
export function bm25Search(
  query: string,
  opts?: { category?: string; maxResults?: number },
): BM25Result[] {
  const { index: idx } = ensureIndex();
  const max = opts?.maxResults ?? 10;
  const filterCat = opts?.category?.toLowerCase();

  let results = idx.search(query, {
    filter: filterCat
      ? (r) => (r.category as string).toLowerCase().includes(filterCat)
      : undefined,
  });

  // MiniSearch trả về kết quả theo score giảm dần
  if (results.length > max) results = results.slice(0, max);

  return results.map((r) => ({
    id: r.id as number,
    path: r.path as string,
    category: r.category as string,
    filename: r.filename as string,
    text: r.text as string,
    score: r.score,
  }));
}

/** Lấy entry theo id (dùng sau reranking để trả về nội dung đầy đủ) */
export function getEntryById(id: number): (CorpusEntry & { id: number }) | undefined {
  const { entries: ents } = ensureIndex();
  return ents[id];
}

/** Thống kê số file theo category */
export function bm25Stats(): { category: string; count: number }[] {
  const { entries: _ents } = ensureIndex();
  const map = new Map<string, number>();
  for (const e of _ents) map.set(e.category, (map.get(e.category) ?? 0) + 1);
  return [...map.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}
