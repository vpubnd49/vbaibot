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
  "convert_file",
  "create_image",
  "create_music",
  "create_video",
  "create_voice_summary",
  "tag_member",
  "save_memory",
  "delete_memory",
  "propose_shared_knowledge",
  "schedule_task",
  "cancel_schedule",
  "finance_tracker",
  "ocr_folder_to_file",
  "qppl_lamdong",
  "thanhtra_lamdong",
  "national_legal",
  "notebooklm",
  "create_or_update_skill",
  "download_video",
  "video_workshop",
  "create_poll",
  "group_admin",
  "review_member",
  "notion_sync",
  "mcp_client",
  "send_email",
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
function lamSachThongDiepLoi(raw: string): string {
  let s = raw.replace(/\.?\s*Nói thật với người dùng.*$/i, "");
  s = s.replace(/\.?\s*đừng hứa gửi.*$/i, "");
  s = s.replace(/\.?\s*Mình không muốn.*$/i, "");
  if (/\{.*code.*message.*\}/s.test(s) || /"error":\s*\{/i.test(s)) {
    s = s.replace(/\{[\s\S]*?\}(?:\s*\(reset after \w+\))?/g, "lỗi dịch vụ");
  }
  return s.trim() || "thao tác gặp sự cố";
}

export function guardFailedActionReply(text: string, failedActions: FailedAction[]): string {
  // Lớp phòng vệ chống rò rỉ mã lỗi kỹ thuật JSON hoặc chỉ dẫn nội bộ
  let cleaned = text;
  if (
    /\{[\s\S]*?"(?:code|message|error)"[\s\S]*?\}/i.test(cleaned) ||
    /Requested entity was not found/i.test(cleaned) ||
    /Nói thật với người dùng/i.test(cleaned) ||
    /đừng hứa gửi/i.test(cleaned)
  ) {
    cleaned = cleaned.replace(/\{[\s\S]*?"(?:code|message|error)"[\s\S]*?\}(?:\s*\(reset after \w+\))?/gi, "");
    cleaned = cleaned.replace(/\.?\s*Nói thật với người dùng.*$/im, "");
    cleaned = cleaned.replace(/\.?\s*đừng hứa gửi.*$/im, "");
    cleaned = cleaned.replace(/\.?\s*Mình không muốn.*$/im, "");
    cleaned = cleaned.trim();
    if (!cleaned || cleaned === "}" || cleaned === "}}") {
      cleaned = "Dạ em rất tiếc hệ thống đang gặp sự cố tạm thời khi xử lý tác vụ này, anh/chị vui lòng thử lại sau giây lát ạ.";
    }
  }

  if (failedActions.length === 0 || !KHANG_DINH_THANH_CONG_RE.test(cleaned)) return cleaned;

  const details = failedActions
    .slice(0, 2)
    .map((action) => `${action.toolName}: ${lamSachThongDiepLoi(action.message)}`)
    .join("; ");
  return `Mình chưa hoàn tất thao tác vì công cụ đã báo lỗi: ${details}.`;
}
