import { isImageGenConfigured } from "../../config/runtime-image-settings.js";
import { isMusicGenConfigured } from "../../config/runtime-music-settings.js";
import { isVideoGenConfigured } from "../../config/runtime-video-settings.js";
import { createExcelFileTool, createWordDocumentTool, createPowerpointTool } from "./create-document-tools.js";
import { createTextDocumentTool } from "./create-text-document-tool.js";
import { createConvertFileTool } from "./convert-file-tool.js";
import { createImageTool } from "./create-image-tool.js";
import { createMusicTool } from "./create-music-tool.js";
import { createVideoTool } from "./create-video-tool.js";
import { createAdminDocumentTool } from "./create-admin-document-tool.js";
import { reviewAdminDocumentTool } from "./review-admin-document-tool.js";
import type { ToolDefinition } from "./tool-catalog-types.js";

/**
 * Nhóm "action" - phần TẠO NỘI DUNG / FILE (Word, Excel, PPT, PDF, chuyển đổi, ảnh, nhạc, video).
 * Tách khỏi tool-catalog-action.ts (đã vượt 370 dòng). Thứ tự giữ nguyên như cũ.
 */
export const CONTENT_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    key: "create_word_document",
    label: "Tạo file Word",
    description: "Soạn nội dung thành file .docx (tiêu đề, đoạn văn, gạch đầu dòng, bảng, 2 cột) rồi gửi luôn - dùng cho biểu mẫu/danh sách có bố cục riêng",
    group: "action",
    // Cùng lý do runsInScheduledTurn:false của send_file - gửi thẳng qua
    // enqueueSend, né trần ngày.
    runsInScheduledTurn: false,
    build: (ctx) => createWordDocumentTool(ctx),
  },
  {
    key: "create_admin_document",
    label: "Soạn VB Hành chính & Đảng (NĐ 30 / HD 05)",
    description:
      "Soạn và xuất file Word (.docx) chuẩn thể thức Nghị định 30/2020/NĐ-CP (Tờ trình, Quyết định, Công văn, Giấy mời, Kế hoạch...) hoặc Hướng dẫn 05 Đảng - không dùng cho biểu mẫu bố cục riêng",
    group: "action",
    runsInScheduledTurn: false,
    build: (ctx) => createAdminDocumentTool(ctx),
  },
  {
    key: "review_admin_document",
    label: "Rà soát VB Hành chính",
    description:
      "Rà soát, thẩm định hồ sơ văn bản hành chính theo quy trình 7 lớp (thể thức, chính tả, căn cứ, logic giao việc, thẩm quyền)",
    group: "action",
    runsInScheduledTurn: false,
    build: (ctx) => reviewAdminDocumentTool(ctx),
  },
  {
    key: "create_excel_file",
    label: "Tạo file Excel",
    description: "Soạn bảng số liệu thành file .xlsx có công thức tính sẵn rồi gửi luôn",
    group: "action",
    // Cùng lý do runsInScheduledTurn:false của send_file - gửi thẳng qua
    // enqueueSend, né trần ngày.
    runsInScheduledTurn: false,
    build: (ctx) => createExcelFileTool(ctx),
  },
  {
    key: "create_powerpoint",
    label: "Tạo file PowerPoint",
    description: "Soạn nội dung thành slide trình chiếu .pptx chuyên nghiệp (bìa, bullet, bảng, so sánh, trích dẫn) rồi gửi luôn",
    group: "action",
    runsInScheduledTurn: false,
    build: (ctx) => createPowerpointTool(ctx),
  },
  {
    key: "create_text_document",
    label: "Tạo file văn bản (MD, TXT, CSV, HTML, PDF)",
    description: "Soạn nội dung thành file Markdown (.md), Text (.txt), CSV (.csv), HTML (.html), hoặc PDF (.pdf) rồi gửi luôn",
    group: "action",
    runsInScheduledTurn: false,
    build: (ctx) => createTextDocumentTool(ctx),
  },
  {
    key: "convert_file",
    label: "Chuyển đổi định dạng file",
    description: "Chuyển file đã gửi sang định dạng khác (Word/Excel/PDF/ảnh/âm thanh/video, RAR/TAR/GZ sang ZIP) rồi gửi luôn",
    group: "action",
    runsInScheduledTurn: false,
    build: (ctx) => createConvertFileTool(ctx),
  },
  {
    key: "create_image",
    label: "Vẽ ảnh AI",
    description: "Vẽ ảnh mới hoặc sửa ảnh người dùng vừa gửi (đổi màu, xóa vật thể, đổi phong cách) rồi gửi luôn",
    group: "action",
    hasSettings: true,
    available: () => isImageGenConfigured(),
    unavailableHint: "Bấm Settings để cấu hình endpoint + model vẽ ảnh",
    // Cùng lý do runsInScheduledTurn:false của send_file - gửi 2 tin ("đang
    // vẽ..." rồi ảnh) thẳng qua enqueueSend, né trần ngày. Nặng nhất trong
    // nhóm 5 tool này: job every 5 phút + prompt "vẽ ảnh rồi [SILENT]" ra
    // hàng trăm tin chủ động/ngày mà trần không bao giờ chặn được.
    runsInScheduledTurn: false,
    build: (ctx) => createImageTool(ctx),
  },
  {
    key: "create_music",
    label: "Tạo nhạc AI",
    description: "Sáng tác nhạc từ mô tả (có lời hoặc nhạc nền) rồi gửi file MP3 luôn",
    group: "action",
    hasSettings: true,
    available: () => isMusicGenConfigured(),
    unavailableHint: "Cấu hình Gemini API key (hoặc dùng provider Google) để dùng tool tạo nhạc",
    runsInScheduledTurn: false,
    build: (ctx) => createMusicTool(ctx),
  },
  {
    key: "create_video",
    label: "Tạo video AI",
    description: "Tạo video ngắn (5-8 giây) từ mô tả rồi gửi file MP4 luôn",
    group: "action",
    hasSettings: true,
    available: () => isVideoGenConfigured(),
    unavailableHint: "Cấu hình Gemini API key (hoặc dùng provider Google) để dùng tool tạo video",
    runsInScheduledTurn: false,
    build: (ctx) => createVideoTool(ctx),
  },
];
