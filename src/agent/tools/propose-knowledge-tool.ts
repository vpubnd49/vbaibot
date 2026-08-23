import { tool } from "ai";
import { z } from "zod";
import { proposeKnowledge, type KnowledgeCategory } from "../../conversation/shared-knowledge-store.js";
import type { ToolContext } from "./index.js";
import { ketQuaLoi } from "./tool-failure-result.js";

/**
 * Tool cho bot đề xuất tri thức dùng chung khi phát hiện người dùng đính chính
 * quy định, luật pháp, hoặc cung cấp thông tin có giá trị áp dụng rộng.
 *
 * Khác với `save_memory` (ghi nhớ CÁ NHÂN cho 1 người hoặc 1 nhóm):
 * - Tool này ghi vào bảng `shared_knowledge` với status='pending'.
 * - Sau khi admin duyệt, tri thức được inject vào MỌI cuộc trò chuyện.
 * - Dùng khi thông tin mang tính CHUNG, không phải sở thích cá nhân.
 */
const MO_TA = [
  "Đề xuất tri thức dùng chung cho TOÀN HỆ THỐNG — áp dụng cho MỌI cuộc trò chuyện sau khi admin duyệt.",
  "",
  "KHI NÀO GỌI:",
  "1. Người dùng đính chính quy định/luật pháp (\"luật X đã hết hiệu lực, thay bằng luật Y\").",
  "2. Sau khi tra web hoặc tra luật và tìm được THÔNG TIN CÓ GIÁ TRỊ LÂU DÀI:",
  "   - Diện tích, dân số, đơn vị hành chính tỉnh thành (đặc biệt sau sáp nhập 2025-2026).",
  "   - Luật, nghị định, thông tư mới hoặc đã thay thế văn bản cũ.",
  "   - Thông tin chính sách, quy trình, quy định đã cập nhật.",
  "   - Hướng dẫn kỹ thuật, quy chuẩn chuyên ngành có giá trị tham khảo.",
  "   → Gọi propose_shared_knowledge ngay SAU KHI trả lời xong, ghi rõ NGUỒN (tên VB, ngày, URL).",
  "3. Cung cấp quy trình nội bộ chung, thông tin chính sách mới.",
  "",
  "KHÔNG DÙNG cho: sở thích cá nhân (dùng save_memory), chuyện vặt, tin tức tạm thời (giá vàng, thời tiết).",
  "",
  "Phân loại (category):",
  "- 'legal': Luật, nghị định, thông tư, quy phạm pháp luật.",
  "- 'policy': Quy định, chính sách nội bộ cơ quan.",
  "- 'procedure': Quy trình, hướng dẫn thao tác.",
  "- 'correction': Đính chính thông tin bot đang trả lời sai (diện tích, dân số, ngày hiệu lực...).",
  "- 'general': Kiến thức chung có giá trị lâu dài.",
].join("\n");

export function createProposeKnowledgeTool({ account, message }: ToolContext) {
  return tool({
    description: MO_TA,
    inputSchema: z.object({
      category: z
        .enum(["legal", "policy", "procedure", "correction", "general"])
        .describe("Phân loại tri thức"),
      content: z
        .string()
        .min(10)
        .max(500)
        .describe(
          "Nội dung tri thức, 1-2 câu rõ ràng. VD: 'Nghị định 30/2020/NĐ-CP đã được sửa đổi bởi Nghị định XX/2025/NĐ-CP'",
        ),
    }),
    execute: async ({ category, content }) => {
      const source = `user:${message.senderName || message.senderId}`;

      const kq = proposeKnowledge({
        accountId: account.id,
        category: category as KnowledgeCategory,
        content,
        source,
        learnedInThreadId: message.threadId,
      });

      if (!kq.ghi) {
        if (kq.lyDo === "trung") {
          return "Tri thức này đã tồn tại trong hệ thống, không cần đề xuất thêm.";
        }
        return ketQuaLoi("Phân loại không hợp lệ.");
      }

      return `Đã ghi nhận đề xuất tri thức (mã #${kq.id}). Thông tin sẽ được quản trị viên xem xét và duyệt để áp dụng cho toàn hệ thống.`;
    },
  });
}