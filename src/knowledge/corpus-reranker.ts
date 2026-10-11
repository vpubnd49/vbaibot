/**
 * corpus-reranker.ts
 *
 * Reranker dùng Gemini (qua 9router) để chọn kết quả phù hợp nhất từ top-K BM25.
 *
 * Luồng:
 *   BM25 → top-10 ứng viên → Gemini chọn 1-3 cái phù hợp nhất → trả về
 *
 * Tại sao hiệu quả:
 *   - BM25 lọc nhanh 3.327 → 10 ứng viên (không tốn API)
 *   - Gemini hiểu ngữ nghĩa tiếng Việt: "PCCC" = "phòng cháy", "BCĐ" = "ban chỉ đạo"
 *   - Prompt ngắn gọn → tiêu thụ ít token
 *
 * Fallback: nếu reranker lỗi → trả về top-K BM25 nguyên gốc (không bị lỗi toàn bộ).
 */
import http from "node:http";
import { getEffectiveLlmSettings } from "../config/runtime-llm-settings.js";
import { createLogger } from "../shared/logger.js";
import type { BM25Result } from "./corpus-bm25.js";

const log = createLogger("corpus-reranker");

/** Gọi 9router chat completions để rerank */
async function callChatJson(prompt: string): Promise<string> {
  const llm = getEffectiveLlmSettings();
  const baseUrl = llm.baseUrl ?? "http://127.0.0.1:20128/v1";
  const model = "ag/gemini-3.8-flash-low"; // model nhẹ, đủ dùng cho reranking
  const apiKey = llm.apiKey;

  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 128,
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}/chat/completions`);
    const req = http.request(
      { hostname: url.hostname, port: url.port || 80, path: url.pathname, method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`, "Content-Length": Buffer.byteLength(body) } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          try {
            const d = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            resolve(d?.choices?.[0]?.message?.content ?? "");
          } catch {
            reject(new Error("parse error"));
          }
        });
        res.on("error", reject);
      },
    );
    req.setTimeout(15_000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

/**
 * Rerank danh sách BM25 kết quả theo truy vấn của người dùng.
 *
 * @param query     Câu hỏi gốc của người dùng
 * @param candidates BM25 top-K (nên là 8-12)
 * @param wantTop   Số kết quả cuối cùng muốn trả về (mặc định 3)
 * @returns Danh sách kết quả đã rerank, hoặc candidates[:wantTop] nếu lỗi
 */
export async function rerankResults(
  query: string,
  candidates: BM25Result[],
  wantTop = 3,
): Promise<BM25Result[]> {
  if (candidates.length === 0) return [];
  if (candidates.length <= wantTop) return candidates;

  // Prompt ngắn: chỉ dùng filename + category (không gửi nội dung → tiết kiệm token)
  const list = candidates
    .map((c, i) => `${i + 1}. [${c.category}] ${c.filename}`)
    .join("\n");

  const prompt =
    `Người dùng cần tìm mẫu văn bản hành chính liên quan đến: "${query}"\n\n` +
    `Dưới đây là ${candidates.length} ứng viên từ kho lưu trữ:\n${list}\n\n` +
    `Hãy chọn ${wantTop} mục PHÙ HỢP NHẤT (theo số thứ tự, cách nhau dấu phẩy). ` +
    `Chỉ trả về các số, ví dụ: 2,5,7`;

  try {
    const raw = await callChatJson(prompt);
    // Parse: "2,5,7" hoặc "2, 5, 7" hoặc "Các mục phù hợp: 2, 5, 7"
    const nums = [...raw.matchAll(/\b(\d+)\b/g)]
      .map((m) => parseInt(m[1]!, 10) - 1) // convert 1-based → 0-based
      .filter((n) => n >= 0 && n < candidates.length);

    if (nums.length === 0) {
      log.debug({ raw }, "Reranker không trả về số hợp lệ, dùng BM25 gốc");
      return candidates.slice(0, wantTop);
    }

    // Dedup, giữ thứ tự Gemini đề xuất
    const seen = new Set<number>();
    const picked: BM25Result[] = [];
    for (const n of nums) {
      if (!seen.has(n) && candidates[n]) {
        seen.add(n);
        picked.push(candidates[n]!);
        if (picked.length >= wantTop) break;
      }
    }

    // Bổ sung nếu Gemini chọn ít hơn wantTop
    if (picked.length < wantTop) {
      for (const c of candidates) {
        if (!seen.has(candidates.indexOf(c))) {
          picked.push(c);
          if (picked.length >= wantTop) break;
        }
      }
    }

    log.debug({ query, picked: picked.map((p) => p.filename) }, "Reranker hoàn tất");
    return picked;
  } catch (err) {
    log.debug({ err }, "Reranker lỗi, fallback BM25 gốc");
    return candidates.slice(0, wantTop);
  }
}
