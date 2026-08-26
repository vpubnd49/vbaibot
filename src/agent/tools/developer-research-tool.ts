import { tool } from "ai";
import { z } from "zod";
import { executeDeveloperResearch } from "../../research/developer-research-service.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";

export function createDeveloperResearchTool(options: { fetchFn?: typeof fetch } = {}) {
  return tool({
    description:
      "Tra cứu mã nguồn, thư viện, repo GitHub, lỗi lập trình & giải pháp kỹ thuật (Stack Overflow), và tin tức/thảo luận xu hướng công nghệ (Hacker News). Có trích dẫn nguồn, link chính thức và điểm số vote/stars.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("Từ khóa tra cứu mã nguồn, repo, bug, lỗi lập trình hoặc chủ đề công nghệ"),
      source: z
        .enum(["auto", "github", "stackoverflow", "hacker_news"])
        .optional()
        .default("auto")
        .describe("Nguồn tra cứu cụ thể hoặc 'auto' để tự động phân loại"),
      kind: z
        .enum(["auto", "repository", "issue", "discussion", "question", "story"])
        .optional()
        .default("auto")
        .describe("Loại nội dung tìm kiếm (repo, issue, thảo luận, câu hỏi, bài viết)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .default(5)
        .describe("Số lượng kết quả mong muốn (1-10, mặc định 5)"),
    }),
    execute: async (args) => {
      try {
        const { text, results } = await executeDeveloperResearch(args, { fetchFn: options.fetchFn });
        if (results.length === 0) {
          return wrapUntrustedContent(
            "Không tìm thấy kho mã nguồn, giải pháp kỹ thuật hoặc thảo luận nào phù hợp với yêu cầu.",
            `developer_research:${args.source ?? "auto"}`,
          );
        }
        return wrapUntrustedContent(text, `developer_research:${args.source ?? "auto"}`);
      } catch (err) {
        return ketQuaLoi(
          `Tra cứu kỹ thuật thất bại: ${err instanceof Error ? err.message : String(err)}. Vui lòng thử lại với từ khóa khác hoặc kiểm tra nguồn.`,
        );
      }
    },
  });
}
