import { getTuning } from "../../config/runtime-tuning-settings.js";
import { isTtsConfigured } from "../../config/runtime-tts-settings.js";
import { isSidecarConfigured } from "../../config/runtime-vision-settings.js";
import { createAddReactionTool } from "./add-reaction-tool.js";
import { createVoiceSummaryTool } from "./create-voice-tool.js";
import { createScheduleTaskTool } from "./schedule-task-tool.js";
import { createSaveMemoryTool } from "./save-memory-tool.js";
import { createSendFileTool } from "./send-file-tool.js";
import { createTagMemberTool } from "./tag-member-tool.js";
import { createFinanceTrackerTool } from "./finance-tracker-tool.js";
import { createProposeKnowledgeTool } from "./propose-knowledge-tool.js";
import { createOcrFolderToFileTool } from "./ocr-folder-to-file-tool.js";
import { createRecallMessageTool } from "./recall-message-tool.js";
import { createSendStickerTool } from "./send-sticker-tool.js";
import { createPollTool } from "./create-poll-tool.js";
import { createGroupAdminTool } from "./group-admin-tool.js";
import { createOrUpdateSkillTool } from "./create-skill-tool.js";
import { CONTENT_TOOL_DEFINITIONS } from "./tool-catalog-content.js";
import { EXTRA_TOOL_DEFINITIONS } from "./tool-catalog-extra.js";
import type { ToolDefinition } from "./tool-catalog-types.js";

/**
 * Nhóm "action" của catalog tool - gửi/sửa thứ gì đó trên Zalo. Tách khỏi
 * `tool-catalog.ts` (đúng nếp tách theo NHÓM đã bàn ở phase 04) để không file
 * catalog nào vượt ngưỡng 200 dòng khi thêm tool mới. Phần tạo nội dung nằm ở
 * `tool-catalog-content.ts`, phần mở rộng ở `tool-catalog-extra.ts`.
 */
const ACTION_DAU: ToolDefinition[] = [
  {
    key: "create_or_update_skill",
    label: "Tạo/cập nhật kỹ năng",
    description: "Tạo mới hoặc cập nhật một kỹ năng (Skill) cho bot từ mẫu văn bản, quy trình hoặc hướng dẫn của người dùng",
    group: "action",
    keTrongKhaNang: true,
    build: () => createOrUpdateSkillTool(),
  },
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
    key: "recall_message",
    label: "Thu hồi tin nhắn",
    description: "Thu hồi (gỡ) tin nhắn bot đã gửi trước đó (trong vòng 1 giờ)",
    group: "action",
    keTrongKhaNang: false,
    runsInScheduledTurn: false,
    build: (ctx) => createRecallMessageTool(ctx),
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
];

const ACTION_CUOI: ToolDefinition[] = [
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
  {
    key: "ocr_folder_to_file",
    label: "OCR thư mục / nhiều file → Xuất file",
    description:
      "Đọc hàng loạt file (ảnh JPG/PNG, PDF text, PDF scan, Word, Excel) từ thư mục hoặc file đã gửi trong hội thoại, " +
      "tự động OCR bằng Vision AI, tổng hợp và xuất kết quả thành Excel/Word/CSV/PDF/TXT rồi gửi luôn cho người dùng",
    group: "action",
    hasSettings: true,
    available: () => isSidecarConfigured(),
    unavailableHint: "Cần cấu hình Vision Sidecar (Vision AI) trong Settings để dùng tool OCR hàng loạt này",
    runsInScheduledTurn: false,
    build: (ctx) => createOcrFolderToFileTool(ctx),
  },
  {
    key: "send_sticker",
    label: "Gửi sticker",
    description: "Gửi nhãn dán (sticker) biểu cảm vào cuộc trò chuyện",
    group: "action",
    keTrongKhaNang: false,
    runsInScheduledTurn: false,
    build: (ctx) => createSendStickerTool(ctx),
  },
  {
    key: "create_poll",
    label: "Tạo bình chọn",
    description: "Tạo cuộc bình chọn / thăm dò ý kiến trong nhóm Zalo",
    group: "action",
    keTrongKhaNang: true,
    runsInScheduledTurn: false,
    build: (ctx) => createPollTool(ctx),
  },
  {
    key: "group_admin",
    label: "Quản trị nhóm",
    description: "Đổi tên nhóm, kick thành viên (cần quyền admin/phó nhóm)",
    group: "action",
    keTrongKhaNang: false,
    runsInScheduledTurn: false,
    build: (ctx) => createGroupAdminTool(ctx),
  },
];

export const ACTION_TOOL_DEFINITIONS: ToolDefinition[] = [
  ...ACTION_DAU,
  ...CONTENT_TOOL_DEFINITIONS,
  ...ACTION_CUOI,
  ...EXTRA_TOOL_DEFINITIONS,
];
