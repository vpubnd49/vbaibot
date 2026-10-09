import { createYouTubeTranscriptTool } from "./youtube-transcript-tool.js";
import { createDownloadVideoTool } from "./download-video-tool.js";
import { createForwardToOwnerTool } from "./forward-to-owner-tool.js";
import { createReviewMemberTool } from "./review-member-tool.js";
import { createTicketTool } from "./ticket-tool.js";
import { createVideoWorkshopTool } from "./video-workshop-tool.js";
import { createNotionSyncTool } from "./notion-sync-tool.js";
import { createMcpClientTool } from "./mcp-client-tool.js";
import type { ToolDefinition } from "./tool-catalog-types.js";

/**
 * Nhóm "action" - phần MỞ RỘNG (media từ link, báo chủ bot, duyệt thành viên, ticket, Notion, MCP).
 * Tách khỏi tool-catalog-action.ts (đã vượt 370 dòng). Thứ tự giữ nguyên như cũ.
 */
export const EXTRA_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    key: "youtube_transcript",
    label: "Đọc phụ đề YouTube",
    description: "Lấy transcript (phụ đề) từ video YouTube để tóm tắt nội dung",
    // Chỉ ĐỌC (không gửi gì lên Zalo) nên thuộc nhóm read, dù định nghĩa nằm ở file action
    group: "read",
    keTrongKhaNang: true,
    runsInScheduledTurn: true,
    build: (ctx) => createYouTubeTranscriptTool(ctx),
  },
  {
    key: "download_video",
    label: "Tải video/nhạc",
    description: "Tải video từ YouTube, TikTok, Facebook, Instagram hoặc tách nhạc MP3",
    group: "action",
    keTrongKhaNang: true,
    runsInScheduledTurn: false,
    build: (ctx) => createDownloadVideoTool(ctx),
  },
  {
    key: "forward_to_owner",
    label: "Báo chủ bot",
    description: "Chuyển tiếp tin nhắn hoặc báo việc gấp cho chủ bot (admin)",
    group: "action",
    keTrongKhaNang: false,
    runsInScheduledTurn: false,
    build: (ctx) => createForwardToOwnerTool(ctx),
  },
  {
    key: "review_member",
    label: "Duyệt thành viên",
    description: "Duyệt hoặc từ chối thành viên đang chờ vào nhóm",
    group: "action",
    keTrongKhaNang: true,
    runsInScheduledTurn: false,
    build: (ctx) => createReviewMemberTool(ctx),
  },
  {
    key: "ticket_manager",
    label: "Phiếu hỗ trợ KH",
    description: "Tạo, cập nhật, theo dõi phiếu hỗ trợ khách hàng (CRM mini)",
    group: "action",
    keTrongKhaNang: true,
    runsInScheduledTurn: false,
    build: (ctx) => createTicketTool(ctx),
  },
  {
    key: "video_workshop",
    label: "Xưởng Video",
    description: "Xử lý video/âm thanh người dùng đã gửi trong hội thoại bằng FFmpeg: tách nhạc, nén, cắt, tạo GIF, thêm chữ, xem thông tin",
    group: "action",
    keTrongKhaNang: true,
    runsInScheduledTurn: false,
    build: (ctx) => createVideoWorkshopTool(ctx),
  },
  {
    key: "notion_sync",
    label: "Đồng bộ Notion",
    description: "Tạo trang, thêm nội dung, tìm kiếm trên Notion",
    group: "action",
    hasSettings: true,
    keTrongKhaNang: true,
    runsInScheduledTurn: false,
    build: (ctx) => createNotionSyncTool(ctx),
  },
  {
    key: "mcp_client",
    label: "MCP Client",
    description: "Gọi tools từ MCP servers bên ngoài (plugin mở rộng)",
    group: "action",
    hasSettings: true,
    keTrongKhaNang: false,
    runsInScheduledTurn: false,
    build: (ctx) => createMcpClientTool(ctx),
  },
];
