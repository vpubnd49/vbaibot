/** Runtime guard chống model khẳng định action đã xong khi tool action thất bại. */
import { laKetQuaLoi } from "./tools/tool-failure-result.js";

/** Các tool có tác dụng phụ hoặc tạo/gửi nội dung cho người dùng. */
export const ACTION_TOOLS = new Set([
  "add_reaction",
  "send_file",
  "create_word_document",
  "create_admin_document",
  "create_excel_file",
  "create_powerpoint",
  "create_text_document",
  "create_image",
  "create_music",
  "create_video",
  "create_voice_summary",
  "tag_member",
  "save_memory",
  "propose_shared_knowledge",
  "schedule_task",
  "finance_tracker",
  "ocr_folder_to_file",
]);

export type ToolResultLike = {
  toolCallId?: string;
  toolName?: string;
  output?: unknown;
};

export type FailedAction = {
  toolName: string;
  message: string;
};

/** Lấy các action thực sự thất bại, không suy đoán từ nội dung tiếng Việt. */
export function getFailedActions(steps: Array<{ toolResults?: ToolResultLike[] }>): FailedAction[] {
  return steps.flatMap((step) =>
    (step.toolResults ?? []).flatMap((result) => {
      if (!result.toolName || !ACTION_TOOLS.has(result.toolName) || !laKetQuaLoi(result.output)) {
        return [];
      }
      return [{ toolName: result.toolName, message: result.output.loi }];
    }),
  );
}

const KHANG_DINH_THANH_CONG_RE =
  /(?:^|\s)(?:đã|vừa)\s+(?:gửi|tạo|xuất|lưu|ghi nhớ|đặt|cập nhật|hủy|sửa|tag|thả|vẽ|tổng hợp)(?:\s|$)|(?:^|\s)(?:đã hoàn tất|thực hiện thành công|xong rồi|đã xử lý xong)(?:\s|$)/i;

/**
 * Không cho gửi câu khẳng định thành công sau khi action tương ứng trả lỗi.
 * Chỉ chặn khi có cả lỗi máy đọc được và ngôn ngữ khẳng định; câu giải thích
 * thất bại/đang thử lại vẫn được giữ nguyên.
 */
export function guardFailedActionReply(text: string, failedActions: FailedAction[]): string {
  if (failedActions.length === 0 || !KHANG_DINH_THANH_CONG_RE.test(text)) return text;

  const details = failedActions
    .slice(0, 2)
    .map((action) => `${action.toolName}: ${action.message}`)
    .join("; ");
  return `Mình chưa hoàn tất thao tác vì công cụ đã báo lỗi: ${details}. Mình không muốn khẳng định đã xong khi chưa có kết quả thành công.`;
}
