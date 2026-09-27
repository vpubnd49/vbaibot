import { tool } from "ai";
import { z } from "zod";
import { getDisasterAlertSummary } from "../../realtime/disaster/disaster-alert-service.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";

export function createDisasterAlertTool() {
  return tool({
    description:
      "Tra cứu cảnh báo thiên tai thời gian thực cho toàn tỉnh Lâm Đồng (mới): " +
      "sạt lở, mưa bão, ngập lụt, xả lũ hồ đập thủy điện/thủy lợi (Đa Nhim, Hàm Thuận, Đa Mi, Đại Ninh, Đồng Nai 2-5, " +
      "Sông Quao, Ba Bàu, Đắk R'Tih...), tình trạng giao thông đèo (D'ran, Bảo Lộc, Prenn, Mimosa...). " +
      "Dữ liệu từ Facebook Thời tiết Lâm Đồng, BCH Phòng thủ Dân sự, Báo Lâm Đồng, Cổng TTĐT. " +
      "Cập nhật mỗi 15 phút.",
    inputSchema: z.object({
      area: z
        .string()
        .optional()
        .describe(
          'Khu vực cần tra cứu (tùy chọn). Ví dụ: "Đà Lạt", "Bảo Lộc", "đèo Bảo Lộc", "Phan Thiết", "Gia Nghĩa". ' +
          "Để trống để xem toàn tỉnh.",
        ),
    }),
    execute: async ({ area }) => {
      const result = getDisasterAlertSummary(area);
      return wrapUntrustedContent(
        result.formattedText,
        `cảnh báo thiên tai${area ? `: ${area}` : ""}`,
      );
    },
  });
}
