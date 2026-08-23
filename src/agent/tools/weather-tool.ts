import { tool } from "ai";
import { z } from "zod";
import { fetchWeather } from "../../realtime/weather/weather-service.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";
import { ketQuaLoi } from "./tool-failure-result.js";

export function createWeatherTool() {
  return tool({
    description:
      "Tra cứu thời tiết thời gian thực và dự báo 3 ngày cho 34 tỉnh/thành phố cả nước và chi tiết từng huyện/thành phố thuộc tỉnh Lâm Đồng (Đà Lạt, Bảo Lộc, Lạc Dương, Đức Trọng, Di Linh...). " +
      "Trả về nhiệt độ hiện tại, nhiệt độ cảm nhận, độ ẩm, sức gió, khả năng mưa, sương mù và dự báo tương lai.",
    inputSchema: z.object({
      location: z
        .string()
        .min(1)
        .describe('Tên địa danh muốn xem thời tiết, ví dụ: "Đà Lạt", "Lâm Đồng", "Bảo Lộc", "Hà Nội", "TP HCM", "Đà Nẵng"...'),
    }),
    execute: async ({ location }) => {
      try {
        const report = await fetchWeather(location);
        return wrapUntrustedContent(report.rawSummary, `thời tiết: ${report.locationName}`);
      } catch (err) {
        return ketQuaLoi(`Không thể lấy dữ liệu thời tiết (${err instanceof Error ? err.message : String(err)})`);
      }
    },
  });
}
