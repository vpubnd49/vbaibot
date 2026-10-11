import { tool } from "ai";
import { z } from "zod";
import { getDisasterAlertSummary } from "../../realtime/disaster/disaster-alert-service.js";
import {
  filterPassReports,
  formatPassReports,
  getMountainPassReports,
} from "../../realtime/disaster/mountain-pass-status.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";

const PASS_HINT_RE = /đèo|d'ran|dran|prenn|mimosa|gia bắc|sông pha|ngoạn mục|khánh lê|tà đùng|giao thông|đường lên|tuyến đường|quốc lộ|ql\s?\d/i;

export function createDisasterAlertTool() {
  return tool({
    description:
      "Tra cứu cảnh báo thiên tai thời gian thực cho toàn tỉnh Lâm Đồng (mới): " +
      "sạt lở, mưa bão, ngập lụt, xả lũ hồ đập thủy điện/thủy lợi (Đa Nhim, Hàm Thuận, Đa Mi, Đại Ninh, Đồng Nai 2-5, " +
      "Sông Quao, Ba Bàu, Đắk R'Tih...), tình trạng giao thông 10 đèo (D'ran, Đại Ninh, Gia Bắc, Sông Pha, Khánh Lê, " +
      "Prenn, Mimosa, Tuyền Lâm, Tà Đùng, Bảo Lộc). " +
      "Dữ liệu từ báo chí (có ngày đăng), các fanpage Facebook địa phương, Báo Lâm Đồng, Cổng TTĐT.",
    inputSchema: z.object({
      area: z
        .string()
        .optional()
        .describe(
          'Khu vực cần tra cứu (tùy chọn). Ví dụ: "Đà Lạt", "Bảo Lộc", "đèo Prenn", "Phan Thiết", "Gia Nghĩa". ' +
          "Để trống để xem toàn tỉnh.",
        ),
      includePasses: z
        .boolean()
        .optional()
        .describe("true khi người dùng hỏi về đèo, đường lên Đà Lạt, giao thông, tuyến đường, quốc lộ."),
    }),
    execute: async ({ area, includePasses }) => {
      const result = getDisasterAlertSummary(area);
      let text = result.formattedText;
      if (includePasses || (area && PASS_HINT_RE.test(area))) {
        const reports = filterPassReports(await getMountainPassReports(), area);
        text += `\n\n${formatPassReports(reports)}`;
      }
      return wrapUntrustedContent(text, `cảnh báo thiên tai${area ? `: ${area}` : ""}`);
    },
  });
}
