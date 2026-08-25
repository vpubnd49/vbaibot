import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./index.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("review-admin-document");

type Ctx = Pick<ToolContext, "api" | "account" | "message">;

export const reviewAuditResultSchema = z.object({
  documentType: z.string().describe("Loại văn bản (Tờ trình, Quyết định, Công văn, Giấy mời...)"),
  summary: z.string().describe("Tóm tắt nội dung và mục đích chính của văn bản"),
  findings: z
    .array(
      z.object({
        severity: z
          .enum(["must_fix", "verify", "should_fix", "editorial"])
          .describe("Mức độ: must_fix (lỗi sai nghiêm trọng), verify (cần đối chiếu nguồn), should_fix (nên sửa để rõ logic), editorial (trau chuốt câu từ)"),
        category: z
          .enum(["the_thuc_nd30", "chinh_ta_ngon_ngu", "can_cu_phap_ly", "logic_nhiem_vu", "tham_quyen_ky", "noi_nhan"])
          .describe("Nhóm lỗi: the_thuc_nd30, chinh_ta_ngon_ngu, can_cu_phap_ly, logic_nhiem_vu, tham_quyen_ky, noi_nhan"),
        location: z.string().describe("Vị trí phát hiện lỗi (ví dụ: 'Điều 2, Khoản 1', 'Phần Căn cứ', 'Khối chữ ký')"),
        currentText: z.string().describe("Đoạn văn bản hiện tại có lỗi hoặc điểm cần chú ý"),
        issueDescription: z.string().describe("Phân tích lỗi sai hoặc lý do cần chỉnh sửa"),
        suggestedFix: z.string().describe("Đề xuất sửa đổi cụ thể"),
      }),
    )
    .describe("Danh sách các lỗi và phát hiện sau khi rà soát"),
  overallVerdict: z
    .enum(["dat_yeu_cau", "can_chinh_sua_truoc_khi_ky", "khong_dat_tra_lai"])
    .describe("Đánh giá chung: dat_yeu_cau, can_chinh_sua_truoc_khi_ky, khong_dat_tra_lai"),
  recommendation: z.string().describe("Khuyến nghị tổng thể cho người soạn thảo / lãnh đạo duyệt ký"),
});

export type ReviewAuditResult = z.infer<typeof reviewAuditResultSchema>;

export function reviewAdminDocumentTool(_ctx: Ctx) {
  return tool({
    description:
      "Rà soát, thẩm định chuyên sâu hồ sơ văn bản hành chính theo quy trình 7 lớp chuẩn Nghị định 30/2020/NĐ-CP " +
      "và quy chuẩn tham mưu tổng hợp (Chính tả ngôn ngữ, Thể thức NĐ30, Căn cứ pháp lý, Thẩm quyền ban hành, Logic giao nhiệm vụ, Nơi nhận).\n" +
      "Trả về bảng kết quả phân loại 4 mức độ: must_fix (bắt buộc sửa), verify (nghi vấn đối chiếu nguồn), should_fix (nên sửa rõ nghĩa), editorial (biên tập từ ngữ).",
    inputSchema: z.object({
      content: z.string().min(1).describe("Toàn bộ nội dung văn bản hoặc dự thảo cần rà soát"),
      targetStandard: z
        .enum(["nd30_nha_nuoc", "hd05_dang"])
        .default("nd30_nha_nuoc")
        .describe("Chuẩn đối chiếu: nd30_nha_nuoc (Nghị định 30) hoặc hd05_dang (Hướng dẫn 05 Đảng)"),
      contextNotes: z.string().optional().describe("Ghi chú bối cảnh hoặc tài liệu cấp trên để đối chiếu nếu có"),
    }),
    execute: async ({ content, targetStandard, contextNotes }) => {
      try {
        log.info({ chars: content.length, targetStandard }, "Bắt đầu rà soát văn bản hành chính");
        return (
          `Đã tiếp nhận văn bản (${content.length} ký tự) để rà soát theo chuẩn ${targetStandard}.\n` +
          `Bối cảnh: ${contextNotes || "Không có"}.\n` +
          `Hãy thực hiện rà soát theo 7 lớp tại skill ra-soat-van-ban-hanh-chinh và trả về kết quả đánh giá 4 mức độ (must_fix, verify, should_fix, editorial) trực tiếp cho người dùng.`
        );
      } catch (err) {
        return ketQuaLoi(`Lỗi khi rà soát văn bản: ${String(err)}`);
      }
    },
  });
}

