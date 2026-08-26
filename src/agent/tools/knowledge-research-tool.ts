import { tool } from "ai";
import { z } from "zod";
import { executeKnowledgeResearch } from "../../research/knowledge-research-service.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";

export function createKnowledgeResearchTool(options: { fetchFn?: typeof fetch } = {}) {
  return tool({
    description:
      "Tra cứu tri thức chuyên sâu, bách khoa toàn thư (Wikipedia), và bài báo nghiên cứu khoa học học thuật (arXiv, Semantic Scholar, Crossref, PubMed y sinh). Hỗ trợ tra theo từ khóa hoặc mã định danh (arXiv ID, DOI, PMID). Kết quả có trích dẫn, nguồn, và mốc thời gian rõ ràng.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("Từ khóa tra cứu, chủ đề nghiên cứu, hoặc mã định danh (arXiv ID, DOI, PMID)"),
      source: z
        .enum(["auto", "wikipedia", "arxiv", "semantic_scholar", "crossref", "pubmed"])
        .optional()
        .default("auto")
        .describe("Nguồn tra cứu cụ thể hoặc 'auto' để tự động định tuyến"),
      mode: z
        .enum(["auto", "keyword", "identifier"])
        .optional()
        .default("auto")
        .describe("Chế độ tìm theo từ khóa hoặc mã định danh"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .default(5)
        .describe("Số lượng kết quả mong muốn (1-10, mặc định 5)"),
      language: z
        .enum(["auto", "vi", "en"])
        .optional()
        .default("auto")
        .describe("Ngôn ngữ ưu tiên khi tra cứu bách khoa Wikipedia ('vi', 'en', 'auto')"),
    }),
    execute: async (args) => {
      try {
        const { text, results } = await executeKnowledgeResearch(args, { fetchFn: options.fetchFn });
        if (results.length === 0) {
          return wrapUntrustedContent(
            "Không tìm thấy tài liệu hay công trình nghiên cứu nào phù hợp với yêu cầu.",
            `knowledge_research:${args.source ?? "auto"}`,
          );
        }
        return wrapUntrustedContent(text, `knowledge_research:${args.source ?? "auto"}`);
      } catch (err) {
        return ketQuaLoi(
          `Tra cứu tri thức thất bại: ${err instanceof Error ? err.message : String(err)}. Vui lòng thử lại với từ khóa khác hoặc kiểm tra nguồn.`,
        );
      }
    },
  });
}
