import { tool } from "ai";
import { z } from "zod";
import { searchLamDongPlaces } from "../../realtime/lamdong/lamdong-places-service.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";
import { ketQuaLoi } from "./tool-failure-result.js";

export function createLamDongPlacesTool() {
  return tool({
    description:
      "Tra cứu các quán ăn ngon, ẩm thực đặc sản (lẩu gà lá é, lẩu bò Ba Toa, bánh ướt lòng gà, bánh mì xíu mại, kem bơ...), nhà hàng, quán cafe view đẹp / săn mây / acoustic, khách sạn, resort 4-5 sao, và homestay / glamping nổi tiếng & hot trend tại tỉnh Lâm Đồng (TP. Đà Lạt, TP. Bảo Lộc, Lạc Dương, Tuyền Lâm, Cầu Đất...).",
    inputSchema: z.object({
      query: z
        .string()
        .describe('Nhu cầu tìm kiếm hoặc tên quán, ví dụ: "lẩu gà lá é", "quán cafe săn mây", "khách sạn gần chợ đêm", "resort Tuyền Lâm", "quán ăn ngon Bảo Lộc"...'),
      category: z
        .enum(["an_uong", "nha_hang", "cafe_view", "khach_san_resort", "homestay_glamping"])
        .optional()
        .describe("Phân loại địa điểm (không bắt buộc): an_uong, nha_hang, cafe_view, khach_san_resort, homestay_glamping"),
    }),
    execute: async ({ query, category }) => {
      try {
        const report = await searchLamDongPlaces(query, category);
        return wrapUntrustedContent(report.formattedSummary, `địa điểm Lâm Đồng: ${query}`);
      } catch (err) {
        return ketQuaLoi(`Không thể tra cứu địa điểm Lâm Đồng (${err instanceof Error ? err.message : String(err)})`);
      }
    },
  });
}
