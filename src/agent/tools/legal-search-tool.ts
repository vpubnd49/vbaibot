import { tool } from "ai";
import { z } from "zod";
import { processLegalQuery } from "../../legal/services/legal-query-engine.js";
import { detectAdminContext } from "../../legal/services/administrative-engine.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";

/**
 * Tool tra cứu pháp luật Việt Nam (Lõi VBAI Legal Pro).
 * Tra cứu văn bản quy phạm pháp luật (Luật, Nghị định, Thông tư), cơ quan ban hành,
 * ngày hiệu lực, tình trạng hiệu lực, văn bản thay thế, trích dẫn Điều/Khoản và tóm tắt chính sách.
 */
export function createLegalSearchTool() {
  return tool({
    description:
      "Tra cứu văn bản quy phạm pháp luật Việt Nam (Luật, Nghị định, Thông tư, Nghị quyết). Tìm theo số hiệu (vd: 72/2025/QH15, Luật 74), theo tên/chủ đề (vd: tổ chức chính quyền địa phương, việc làm, bảo hiểm thất nghiệp, đất đai) hoặc điều khoản (vd: Điều 116 Luật 74). Trả về thông tin chính xác về hiệu lực, cơ quan ban hành, tóm tắt nội dung và văn bản thay thế.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("Từ khóa, tên luật, số hiệu văn bản hoặc điều khoản cần tra cứu"),
    }),
    execute: async ({ query }) => {
      const trimmed = query.trim();
      if (!trimmed) {
        return ketQuaLoi("Vui lòng cung cấp nội dung hoặc số hiệu văn bản cần tra cứu.");
      }

      // Check administrative context first (e.g. Lâm Đồng departments)
      const adminCtx = detectAdminContext(trimmed);

      // Run legal query engine
      const legalRes = processLegalQuery(trimmed);

      if (!legalRes.success && !adminCtx) {
        return ketQuaLoi(
          legalRes.error || "Không tìm thấy thông tin văn bản pháp luật phù hợp. Thử từ khóa khác.",
        );
      }

      const outputParts: string[] = [];

      if (adminCtx) {
        outputParts.push(adminCtx);
      }

      if (legalRes.retrievalContext) {
        outputParts.push(legalRes.retrievalContext);
      }

      if (outputParts.length === 0) {
        return ketQuaLoi(
          `Không tìm thấy văn bản pháp luật nào khớp với "${trimmed}". Thử tra theo số hiệu cụ thể hoặc từ khóa chủ đề ngắn gọn.`,
        );
      }

      return wrapUntrustedContent(outputParts.join("\n\n"), `kết quả tra cứu pháp luật: ${trimmed}`);
    },
  });
}
