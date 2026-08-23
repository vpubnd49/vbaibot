import { tool } from "ai";
import { z } from "zod";
import { fetchNewsArticles, type NewsCategory } from "../../realtime/news/news-service.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";
import { ketQuaLoi } from "./tool-failure-result.js";

export function createNewsTool() {
  return tool({
    description:
      "Tra cứu và điểm tin tức thời sự, kinh tế, xã hội, quốc phòng, an ninh, công nghệ thông tin (CNTT/chuyển đổi số) cả nước và đặc biệt cập nhật nhanh nhất từ Cổng TTĐT tỉnh Lâm Đồng (lamdong.gov.vn) và Báo Lâm Đồng (baolamdong.vn).",
    inputSchema: z.object({
      category: z
        .enum(["lam_dong", "kinh_te", "xa_hoi", "quoc_phong_an_ninh", "cntt", "tong_hop"])
        .default("tong_hop")
        .describe("Chuyên mục tin tức: lam_dong (Lâm Đồng), kinh_te (Kinh tế), xa_hoi (Xã hội), quoc_phong_an_ninh (Quốc phòng & An ninh), cntt (Công nghệ thông tin), tong_hop (Tổng hợp)"),
      query: z
        .string()
        .optional()
        .describe("Từ khóa tìm kiếm cụ thể (nếu có), ví dụ: 'cao tốc Tân Phú Bảo Lộc', 'chuyển đổi số', 'lễ hội hoa Đà Lạt'..."),
    }),
    execute: async ({ category, query }) => {
      try {
        const report = await fetchNewsArticles(category as NewsCategory, query);
        return wrapUntrustedContent(report.formattedSummary, `tin tức: ${category}`);
      } catch (err) {
        return ketQuaLoi(`Không thể tra cứu tin tức (${err instanceof Error ? err.message : String(err)})`);
      }
    },
  });
}
