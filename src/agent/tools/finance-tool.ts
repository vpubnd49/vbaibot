import { tool } from "ai";
import { z } from "zod";
import { fetchFinancialRates } from "../../realtime/finance/finance-service.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";
import { ketQuaLoi } from "./tool-failure-result.js";

export function createFinanceTool() {
  return tool({
    description:
      "Tra cứu giá vàng trong nước (SJC, DOJI, PNJ, vàng nhẫn 9999, vàng thế giới) và tỷ giá ngoại tệ ngân hàng (USD, EUR, JPY, GBP, CNY...) cập nhật thời gian thực hôm nay.",
    inputSchema: z.object({
      category: z
        .enum(["gold", "currency", "all"])
        .default("all")
        .describe("Loại dữ liệu muốn tra cứu: gold (chỉ giá vàng), currency (chỉ tỷ giá ngoại tệ), all (cả hai)"),
    }),
    execute: async ({ category }) => {
      try {
        const report = await fetchFinancialRates(category);
        return wrapUntrustedContent(report.formattedText, `dữ liệu tài chính: ${category}`);
      } catch (err) {
        return ketQuaLoi(`Không thể lấy dữ liệu tài chính (${err instanceof Error ? err.message : String(err)})`);
      }
    },
  });
}
