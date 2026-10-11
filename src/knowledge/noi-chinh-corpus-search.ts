/**
 * noi-chinh-corpus-search.ts
 *
 * Tra cứu kho văn bản NỘI CHÍNH — 3.327 mẫu thật.
 *
 * NÂNG CẤP: BM25 (MiniSearch) + LLM reranking thay thế keyword counting cũ.
 *
 * Luồng:
 *   1. BM25 → top-12 ứng viên (< 1ms, pure JS)
 *   2. Gemini (ag/gemini-3.8-flash-low, có sẵn qua 9router) → chọn top-N phù hợp nhất
 *   3. Fallback: nếu reranker lỗi → dùng BM25 top-N (không bao giờ crash)
 *
 * API ngoài (searchCorpus, corpusStats, listByCategory, getByPath) GIỮ NGUYÊN
 * để các tool hiện tại không cần sửa.
 */
import { bm25Search, bm25Stats } from "./corpus-bm25.js";
import { rerankResults } from "./corpus-reranker.js";
import { loadCorpusEntries } from "./corpus-loader.js";

// ─── Re-export types ─────────────────────────────────────────────────────────

export type SearchResult = {
  path: string;
  category: string;
  filename: string;
  text: string;
  score: number;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Tìm văn bản mẫu theo từ khóa / câu hỏi tự nhiên.
 *
 * Sử dụng BM25 + LLM reranking:
 *   - BM25 lọc nhanh top-(maxResults*4) ứng viên
 *   - Gemini chọn maxResults phù hợp nhất theo ngữ nghĩa
 *
 * @param keywords   Từ khóa hoặc câu hỏi ngắn ("ủy quyền vụ án hành chính")
 * @param options.category    Lọc theo thư mục (tùy chọn)
 * @param options.maxResults  Số kết quả cuối cùng (mặc định 5)
 * @param options.rerank      Bật/tắt LLM reranking (mặc định true)
 */
export async function searchCorpus(
  keywords: string,
  options?: { category?: string; maxResults?: number; rerank?: boolean },
): Promise<SearchResult[]> {
  const max = options?.maxResults ?? 5;
  const doRerank = options?.rerank !== false;

  // BM25: lấy nhiều hơn để reranker có đủ ứng viên
  const bm25Candidates = bm25Search(keywords, {
    category: options?.category,
    maxResults: doRerank ? Math.min(max * 4, 16) : max,
  });

  if (bm25Candidates.length === 0) return [];
  if (!doRerank || bm25Candidates.length <= max) {
    return bm25Candidates.map((r) => ({ ...r }));
  }

  // LLM reranking
  const reranked = await rerankResults(keywords, bm25Candidates, max);
  return reranked.map((r) => ({ ...r }));
}

/** Danh sách tất cả category và số file */
export function corpusStats(): { category: string; count: number }[] {
  return bm25Stats();
}

/** Lấy tất cả file trong một category */
export function listByCategory(category: string): { path: string; filename: string }[] {
  return loadCorpusEntries()
    .filter((e) => e.category === category)
    .map((e) => ({ path: e.path, filename: e.filename }));
}

/** Lấy nội dung 1 file theo đường dẫn tương đối */
export function getByPath(relPath: string): { path: string; category: string; filename: string; text: string } | undefined {
  return loadCorpusEntries().find((e) => e.path === relPath);
}
