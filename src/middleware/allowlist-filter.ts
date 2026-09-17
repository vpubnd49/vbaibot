import type { AccountConfig } from "../config/account-store.js";
import { isMentioningBot } from "../shared/fold-for-search.js";
import { isThreadPaused } from "../conversation/thread-store.js";
import type { ParsedMessage } from "../zalo/zalo-message-parser.js";

export type FilterDecision = {
  /** Bot có chạy agent + trả lời không */
  respond: boolean;
  /**
   * Không trả lời nhưng vẫn ghi vào history (passive listening): tin group
   * thiếu @mention, hoặc thread đang tắt bot. Lần tương tác sau agent sẽ
   * thấy được ngữ cảnh xung quanh thay vì chỉ các lần mention rời rạc.
   */
  record: boolean;
  reason: string;
};

const skip = (reason: string): FilterDecision => ({ respond: false, record: false, reason });
const recordOnly = (reason: string): FilterDecision => ({ respond: false, record: true, reason });

/**
 * Quyết định bot có trả lời tin nhắn này không - chạy TRƯỚC khi gọi LLM
 * để tin bị lọc không tốn token nào.
 *
 * @param botEnabledForThread trạng thái kill switch per thread (bảng threads),
 * caller đọc từ thread-store để module này thuần, test không cần DB.
 */
export function shouldRespond(
  account: AccountConfig,
  msg: ParsedMessage,
  botEnabledForThread = true,
): FilterDecision {
  if (msg.isSelf) {
    return skip("tin của chính bot");
  }

  if (!msg.text.trim() && msg.images.length === 0 && (msg.files?.length ?? 0) === 0) {
    return skip("không có nội dung xử lý được (sticker/voice/...)");
  }

  // ── Bỏ qua sticker "add bạn" ──────────────────────────────────────────────
  // Khi add bạn trên Zalo, hệ thống gửi sticker chào dưới dạng file ảnh có
  // tên generic (file.png, file.gif). Bot không nên trả lời vì đây không phải
  // yêu cầu — chỉ là hành động kết bạn. Chạy OCR trên sticker sẽ thất bại.
  //
  // Ảnh thuần (images array) vẫn cho qua vì người dùng có thể gửi ảnh chụp
  // tài liệu không kèm text. File tài liệu thật (.pdf, .docx...) cũng cho qua.
  if (!msg.text.trim()) {
    const files = msg.files ?? [];
    // Chỉ có file duy nhất tên generic như sticker add bạn, không có ảnh thật
    const isOnlyStickerFile = files.length === 1
      && msg.images.length === 0
      && /^file\.(png|gif|jpg|jpeg|webp)$/i.test(files[0]!.fileName);
    if (isOnlyStickerFile) {
      return skip("sticker add bạn (file.png) không kèm text");
    }
  }

  const isMentioned = msg.mentionsMe || isMentioningBot(msg.text, account.label);

  if (msg.isGroup) {
    if (!account.respondToGroups) {
      return skip("account tắt trả lời group");
    }
    if (account.groupRequireMention && !isMentioned) {
      return account.groupPassiveListen
        ? recordOnly("group không @mention - chỉ ghi history")
        : skip("group yêu cầu @mention bot");
    }
  }

  if (account.allowlist.mode === "list" && !account.allowlist.userIds.includes(msg.senderId)) {
    return skip(`sender ${msg.senderId} ngoài allowlist`);
  }

  // Check kill switch SAU allowlist: người ngoài allowlist không được ghi history
  // dù thread tắt bot
  if (!botEnabledForThread) {
    return recordOnly("thread đang tắt bot - chỉ ghi history");
  }

  // Smart Admin Pause: admin đang tự trả lời → bot nhường sóng, chỉ ghi history.
  // Check SAU botEnabled vì thread tắt hẳn thì không cần check pause nữa.
  if (isThreadPaused(account.id, msg.threadId)) {
    return recordOnly("thread đang nhường admin - chỉ ghi history");
  }

  return { respond: true, record: true, reason: "ok" };
}

