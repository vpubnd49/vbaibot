import { isSidecarConfigured } from "../../config/runtime-vision-settings.js";
import { createFinanceTool } from "./finance-tool.js";
import { createGetDatetimeTool } from "./get-datetime-tool.js";
import { createGetGroupInfoTool } from "./get-group-info-tool.js";
import { createLamDongPlacesTool } from "./lamdong-places-tool.js";
import { createLegalSearchTool } from "./legal-search-tool.js";
import { createNewsTool } from "./news-tool.js";
import { createReadImageTool } from "./read-image-tool.js";
import { createTaxAccountingTool } from "./tax-accounting-tool.js";
import type { ToolDefinition } from "./tool-catalog-types.js";
import { createWeatherTool } from "./weather-tool.js";
import { createWebFetchTool } from "./web-fetch-tool.js";
import { createWebSearchTool } from "./web-search-tool.js";
import { createReadDocumentTool } from "./read-document-tool.js";
import { createAdminDivisionTool } from "./admin-division-tool.js";

/**
 * Nhóm "read" của catalog tool - tra cứu, không tác động ra ngoài. Tách khỏi
 * `tool-catalog.ts` (đúng nếp tách theo NHÓM đã bàn ở phase 04) để không file
 * catalog nào vượt ngưỡng 200 dòng khi thêm tool mới.
 */
export const READ_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    key: "get_datetime",
    label: "Ngày giờ hiện tại",
    description: "Cho bot biết chính xác ngày, giờ, thứ trong tuần theo múi giờ Việt Nam",
    group: "read",
    keTrongKhaNang: false,
    build: () => createGetDatetimeTool(),
  },
  {
    key: "legal_search",
    label: "Tra cứu pháp luật",
    description:
      "Tra cứu văn bản quy phạm pháp luật Việt Nam (Luật, Nghị định, Thông tư), kiểm tra hiệu lực, cơ quan ban hành, điều khoản và văn bản thay thế",
    group: "read",
    build: () => createLegalSearchTool(),
  },
  {
    key: "weather_lookup",
    label: "Dự báo thời tiết",
    description:
      "Tra cứu thời tiết thời gian thực và dự báo 3 ngày cho 34 tỉnh/thành phố và các huyện/TP tỉnh Lâm Đồng",
    group: "read",
    build: () => createWeatherTool(),
  },
  {
    key: "finance_rates_lookup",
    label: "Giá vàng & Tỷ giá",
    description: "Tra cứu giá vàng SJC, DOJI, PNJ, 9999 và tỷ giá ngoại tệ ngân hàng hôm nay",
    group: "read",
    build: () => createFinanceTool(),
  },
  {
    key: "news_lookup",
    label: "Tin tức & Thời sự",
    description:
      "Điểm tin thời sự kinh tế, xã hội, quốc phòng, an ninh, CNTT cả nước và cập nhật nhanh nhất từ Cổng TTĐT tỉnh Lâm Đồng",
    group: "read",
    build: () => createNewsTool(),
  },
  {
    key: "lamdong_places_lookup",
    label: "Địa điểm & Ẩm thực Lâm Đồng",
    description:
      "Tra cứu quán ăn ngon, nhà hàng, cafe view săn mây/acoustic, khách sạn, resort, homestay hot trend tại Lâm Đồng",
    group: "read",
    build: () => createLamDongPlacesTool(),
  },
  {
    key: "tax_accounting_lookup",
    label: "Thuế, Kế toán & Ngân hàng",
    description:
      "Tra cứu nghiệp vụ Thuế (TNCN, GTGT, TNDN, môn bài), Kế toán (Hệ thống TK TT200/TT133, hóa đơn điện tử NĐ 123), lãi suất ngân hàng và tính thuế TNCN",
    group: "read",
    build: () => createTaxAccountingTool(),
  },
  {
    key: "web_search",
    label: "Tìm kiếm web",
    description: "Tìm thông tin mới trên web theo chuỗi nguồn, DuckDuckGo luôn đứng cuối",
    group: "read",
    hasSettings: true,
    build: () => createWebSearchTool(),
  },
  {
    key: "web_fetch",
    label: "Đọc trang web",
    description: "Đọc nội dung 1 URL công khai (đã chặn IP nội bộ chống SSRF)",
    group: "read",
    hasSettings: true,
    build: () => createWebFetchTool(),
  },
  {
    key: "read_image",
    label: "Nhìn kỹ ảnh",
    description:
      "Hỏi model đọc ảnh (sidecar) một câu cụ thể về ảnh đã nhận - đếm, đọc chữ nhỏ, soi chi tiết",
    group: "read",
    hasSettings: true,
    available: () => isSidecarConfigured(),
    unavailableHint: "Bấm Settings để cấu hình model sidecar đọc ảnh",
    runsInScheduledTurn: false,
    build: (ctx) => createReadImageTool(ctx),
  },
  {
    key: "get_group_info",
    label: "Thông tin nhóm",
    description: "Xem tên nhóm, số thành viên, danh sách thành viên của nhóm hiện tại",
    group: "read",
    build: (ctx) => createGetGroupInfoTool(ctx),
  },
  {
    key: "read_document",
    label: "Đọc tài liệu",
    description: "Đọc nội dung file PDF, Word, Excel, CSV, TXT do người dùng gửi",
    group: "read",
    runsInScheduledTurn: false,
    build: (ctx) => createReadDocumentTool(ctx),
  },
  {
    key: "admin_division_lookup",
    label: "Tra cứu ĐVHC 34 tỉnh",
    description: "Tra cứu đơn vị hành chính 34 tỉnh/thành phố, 3.321 xã/phường/đặc khu theo mô hình 2 cấp. Hỗ trợ tra ngược địa chỉ cũ sang mới",
    group: "read",
    build: () => createAdminDivisionTool(),
  },
];
