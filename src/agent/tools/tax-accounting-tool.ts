import { tool } from "ai";
import { z } from "zod";
import { lookupTaxAccounting } from "../../realtime/tax-accounting/tax-accounting-service.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";
import { ketQuaLoi } from "./tool-failure-result.js";

export function createTaxAccountingTool() {
  return tool({
    description:
      "Tra cứu nghiệp vụ Tài chính, Ngân hàng, Thuế (TNCN, GTGT/VAT, TNDN, lệ phí môn bài, hạn nộp thuế), Kế toán doanh nghiệp (Hệ thống tài khoản TT200/TT133, định khoản Nợ/Có, hóa đơn điện tử Nghị định 123/Thông tư 78), và tính thuế TNCN chính xác.",
    inputSchema: z.object({
      query: z
        .string()
        .describe('Nội dung cần tra cứu: ví dụ "tài khoản 112", "thuế suất GTGT", "cách tính thuế TNCN", "hóa đơn điều chỉnh NĐ 123", "lãi suất ngân hàng"...'),
      grossSalary: z
        .number()
        .optional()
        .describe("Mức lương Gross (VNĐ) nếu cần tính thuế TNCN cụ thể, ví dụ: 25000000"),
      dependentsCount: z
        .number()
        .optional()
        .default(0)
        .describe("Số người phụ thuộc để tính giảm trừ gia cảnh thuế TNCN (mặc định: 0)"),
    }),
    execute: async ({ query, grossSalary, dependentsCount }) => {
      try {
        const report = await lookupTaxAccounting(query, grossSalary, dependentsCount);
        return wrapUntrustedContent(report.formattedText, `nghiệp vụ thuế kế toán tài chính: ${query}`);
      } catch (err) {
        return ketQuaLoi(`Không thể tra cứu dữ liệu tài chính thuế kế toán (${err instanceof Error ? err.message : String(err)})`);
      }
    },
  });
}
