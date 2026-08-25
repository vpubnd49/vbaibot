import { getTuning } from "../../config/runtime-tuning-settings.js";
import { isImageGenConfigured } from "../../config/runtime-image-settings.js";
import { isTtsConfigured } from "../../config/runtime-tts-settings.js";
import { createAddReactionTool } from "./add-reaction-tool.js";
import { createExcelFileTool, createWordDocumentTool, createPowerpointTool } from "./create-document-tools.js";
import { createTextDocumentTool } from "./create-text-document-tool.js";
import { createImageTool } from "./create-image-tool.js";
import { createVoiceSummaryTool } from "./create-voice-tool.js";
import { createScheduleTaskTool } from "./schedule-task-tool.js";
import { createSaveMemoryTool } from "./save-memory-tool.js";
import { createSendFileTool } from "./send-file-tool.js";
import { createTagMemberTool } from "./tag-member-tool.js";
import { createFinanceTrackerTool } from "./finance-tracker-tool.js";
import { createProposeKnowledgeTool } from "./propose-knowledge-tool.js";
import { createAdminDocumentTool } from "./create-admin-document-tool.js";
import { reviewAdminDocumentTool } from "./review-admin-document-tool.js";
import type { ToolDefinition } from "./tool-catalog-types.js";

/**
 * Nhóm "action" của catalog tool - gửi/sửa thứ gì đó trên Zalo. Tách khỏi
 * `tool-catalog.ts` (đúng nếp tách theo NHÓM đã bàn ở phase 04) để không file
 * catalog nào vượt ngưỡng 200 dòng khi thêm tool mới.
 */
export const ACTION_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    key: "add_reaction",
    label: "Thả cảm xúc",
    description: "Thả reaction (tim, like...) vào tin nhắn trong hội thoại",
    group: "action",
    // Không khoe: đây là phép lịch sự trong lúc trò chuyện, không phải việc ai
    // đó nhờ bot làm.
    keTrongKhaNang: false,
    // Lượt theo lịch không có tin thật nào (msgId rỗng) để mà thả reaction vào
    runsInScheduledTurn: false,
    build: (ctx) => createAddReactionTool(ctx),
  },
  {
    key: "send_file",
    label: "Gửi file",
    description: "Gửi file từ kho shared-files hoặc tải từ URL công khai rồi gửi",
    group: "action",
    // Gọi thẳng `enqueueSend` (rate-limiter THEO THREAD, không phải trần ngày)
    // để gửi - vào lượt theo lịch sẽ né hoàn toàn `SCHEDULER_MAX_PROACTIVE_PER_DAY`,
    // vì bộ đếm trần chỉ tăng ở đường `deliverProactively`/`reserveProactiveSlot`
    // của scheduler. Loại khỏi lượt theo lịch cho tới khi tool này đi qua đúng
    // đường đếm trần (đợt sau).
    runsInScheduledTurn: false,
    build: (ctx) => createSendFileTool(ctx),
  },
  {
    key: "create_word_document",
    label: "Tạo file Word",
    description: "Soạn nội dung thành file .docx (tiêu đề, đoạn văn, gạch đầu dòng, bảng) rồi gửi luôn",
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
      "Soạn và xuất file Word (.docx) chuẩn thể thức Nghị định 30/2020/NĐ-CP (Tờ trình, Quyết định, Công văn, Giấy mời, Kế hoạch...) hoặc Hướng dẫn 05 Đảng",
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
    key: "tag_member",
    label: "Tag thành viên",
    description: "Nhắc tên (@mention) thành viên trong nhóm khi trả lời",
    group: "action",
    // Cùng lý do runsInScheduledTurn:false của send_file - gửi thẳng qua
    // enqueueSend, né trần ngày.
    runsInScheduledTurn: false,
    build: (ctx) => createTagMemberTool(ctx),
  },
  {
    key: "save_memory",
    label: "Ghi nhớ lâu dài",
    description: "Tự lưu fact về người dùng/nhóm để nhớ qua các phiên chat sau",
    group: "action",
    // Đường nội dung web đi vào trí nhớ vĩnh viễn là prompt injection thật, và
    // lượt theo lịch vốn không có phát ngôn nào của user để mà học
    runsInScheduledTurn: false,
    build: (ctx) => createSaveMemoryTool(ctx),
  },
  {
    key: "propose_shared_knowledge",
    label: "Đề xuất tri thức chung",
    description: "Đề xuất tri thức áp dụng cho toàn hệ thống (luật mới, đính chính, quy trình) — chờ admin duyệt",
    group: "action",
    // Cùng lý do save_memory: lượt theo lịch không có user input để học
    runsInScheduledTurn: false,
    build: (ctx) => createProposeKnowledgeTool(ctx),
  },
  {
    key: "schedule_task",
    label: "Lịch hẹn",
    description: "Đặt/xem/sửa/hủy lịch để bot tự nhắn lại đúng cuộc trò chuyện này ở một mốc giờ trong tương lai",
    group: "action",
    // Tắt cả tính năng lịch hẹn (vòng tick không chạy nữa) thì tool cũng biến
    // khỏi schema - đặt job mới lúc đó vô nghĩa, không có gì nhặt job lên chạy
    available: () => getTuning("SCHEDULER_ENABLED"),
    unavailableHint: 'Bật "Bật lịch hẹn" trong Cấu hình > Lịch hẹn để dùng tool này',
    // Luật số 1 của Hermes: job không được đẻ job
    runsInScheduledTurn: false,
    build: (ctx) => createScheduleTaskTool(ctx),
  },
  {
    key: "finance_tracker",
    label: "Sổ thu chi & Dòng tiền",
    description: "Ghi nhận thu chi, theo dõi dòng tiền, tổng hợp báo cáo tài chính cá nhân/nhóm",
    group: "action",
    runsInScheduledTurn: false,
    build: (ctx) => createFinanceTrackerTool(ctx),
  },
  {
    key: "create_voice_summary",
    label: "Tổng hợp bằng giọng nói",
    description:
      "Chuyển nội dung tổng hợp thành tin nhắn thoại dạng podcast 2 người (giọng Bắc chuẩn) rồi gửi trực tiếp",
    group: "action",
    hasSettings: true,
    available: () => isTtsConfigured(),
    unavailableHint:
      "Cấu hình TTS_API_KEY (hoặc dùng provider Google) và TTS_PUBLIC_BASE_URL trong .env hoặc Dashboard",
    runsInScheduledTurn: false,
    build: (ctx) =>
      createVoiceSummaryTool({
        api: ctx.api,
        threadId: ctx.message.threadId,
        threadType: ctx.message.threadType,
        threadKey: `${ctx.account.id}:${ctx.message.threadId}`,
        accountId: ctx.account.id,
        ghiNhanDaGui: ctx.ghiNhanDaGui,
      }),
  },
];
