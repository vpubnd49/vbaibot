import type { ThreadType } from "zca-js";
import { db } from "../conversation/database.js";
import { createLogger } from "../shared/logger.js";
import { getRunningAccountApi } from "../zalo/account-manager.js";
import { deliverChatReply } from "../zalo/deliver-chat-reply.js";
import type { ReplyTarget } from "../zalo/send-reply-in-parts.js";

const log = createLogger("broadcast-service");

export type BroadcastTemplate = {
  id: string;
  title: string;
  description: string;
  content: string;
};

export const DEFAULT_BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  {
    id: "feature_update",
    title: "🚀 Nâng cấp Tính năng mới (Toàn diện)",
    description: "Giới thiệu các bộ công cụ vừa cập nhật: Hành chính, Học thuật, Kỹ thuật, Đa phương tiện",
    content: `🚀 **VBAI BOT — BẢN NÂNG CẤP TÍNH NĂNG MỚI**

Chào anh/chị, hệ thống vừa hoàn tất nâng cấp bổ sung các bộ công cụ chuyên sâu:

1. 🏛️ **Văn bản Hành chính & Đảng**: Soạn thảo & rà soát 7 lớp chuẩn NĐ 30 & HD 05, tự động bôi đỏ từ đã sửa.
2. 📚 **Tra cứu Học thuật & Tri thức**: Bách khoa Wikipedia, bài báo khoa học arXiv, PubMed y sinh, Semantic Scholar, Crossref.
3. 💻 **Kỹ thuật & Lập trình**: Tra cứu kho mã nguồn GitHub, giải pháp sửa lỗi Stack Overflow, tin công nghệ Hacker News.
4. 📊 **Tạo lập Slide & Excel**: Xuất slide PowerPoint 16:9 và bảng tính Excel kèm công thức tính tự động.
5. 🎙️ **Voice Podcast**: Tạo tin nhắn thoại đối thoại 2 người nghe nhanh trong Zalo.

✨ *Anh/chị chỉ cần gắn thẻ @Châu Phiên Bản Số và đặt câu hỏi để trải nghiệm ngay nhé!*`,
  },
  {
    id: "research_tools_only",
    title: "🔬 Bộ Công cụ Tra cứu & Nghiên cứu mới",
    description: "Thông báo ngắn gọn về năng lực tra cứu học thuật Wikipedia, arXiv, PubMed, GitHub, Stack Overflow",
    content: `🔬 **CẬP NHẬT: BỘ CÔNG CỤ NGHIÊN CỨU & TRA CỨU CHUYÊN SÂU**

Hệ thống bot AI vừa được tích hợp thêm 2 bộ công cụ nghiên cứu mạnh mẽ:

- 📚 **Nghiên cứu Học thuật**: Tra cứu bách khoa Wikipedia, bài báo khoa học arXiv, cơ sở dữ liệu y sinh PubMed/NCBI, trích dẫn Semantic Scholar & mã định danh DOI Crossref.
- 💻 **Nghiên cứu Kỹ thuật**: Tra cứu kho mã nguồn mở GitHub, giải pháp sửa lỗi lập trình Stack Overflow và thảo luận công nghệ Hacker News.

Dữ liệu tra cứu luôn được chuẩn hóa, trích dẫn nguồn gốc và đối chiếu mốc thời gian rõ ràng! 🚀`,
  },
  {
    id: "maintenance",
    title: "🛠️ Thông báo Bảo trì / Khởi động lại",
    description: "Thông báo bảo trì định kỳ nâng cấp server",
    content: `🛠️ **THÔNG BÁO BẢO TRÌ & NÂNG CẤP HỆ THỐNG**

Hệ thống đang thực hiện tối ưu hóa hiệu năng và cập nhật phiên bản mới.
Trong ít phút tới, một số phản hồi có thể chậm hơn bình thường. Cảm ơn anh/chị đã thông cảm và đồng hành! 🙏`,
  },
];

export type BroadcastTarget = {
  accountId: string;
  threadId: string;
  threadType: ThreadType;
  displayName: string;
  botEnabled: boolean;
  messageCount: number;
  lastMessageAt: string | null;
};

export type TargetFilterOptions = {
  accountId?: string;
  query?: string;
  type?: "all" | "group" | "direct";
  botEnabledOnly?: boolean;
  activeWithinDays?: number;
};

type ThreadRow = {
  account_id: string;
  thread_id: string;
  thread_type: number;
  display_name: string;
  bot_enabled: number;
  message_count: number;
  last_message_at: string | null;
};

export function listBroadcastTargets(options: TargetFilterOptions = {}): BroadcastTarget[] {
  let sql = `
    SELECT account_id, thread_id, thread_type, display_name, bot_enabled, message_count, last_message_at
    FROM threads
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (options.accountId) {
    sql += ` AND account_id = ?`;
    params.push(options.accountId);
  }

  if (options.type === "group") {
    sql += ` AND thread_type = 1`; // Group
  } else if (options.type === "direct") {
    sql += ` AND thread_type = 0`; // Direct user
  }

  if (options.botEnabledOnly) {
    sql += ` AND bot_enabled = 1`;
  }

  if (options.activeWithinDays && options.activeWithinDays > 0) {
    sql += ` AND datetime(last_message_at) >= datetime('now', '-' || ? || ' days')`;
    params.push(options.activeWithinDays);
  }

  if (options.query && options.query.trim()) {
    sql += ` AND (display_name LIKE ? OR thread_id LIKE ?)`;
    const q = `%${options.query.trim()}%`;
    params.push(q, q);
  }

  sql += ` ORDER BY last_message_at DESC, message_count DESC`;

  const rows = db.prepare(sql).all(...params) as unknown as ThreadRow[];
  return rows.map((r) => ({
    accountId: r.account_id,
    threadId: r.thread_id,
    threadType: r.thread_type as ThreadType,
    displayName: r.display_name || (r.thread_type === 1 ? `Nhóm ${r.thread_id}` : `Người dùng ${r.thread_id}`),
    botEnabled: r.bot_enabled === 1,
    messageCount: r.message_count,
    lastMessageAt: r.last_message_at,
  }));
}

export type BroadcastSendParams = {
  accountId: string;
  threadIds: string[];
  message: string;
  delayMinMs?: number;
  delayMaxMs?: number;
};

export type BroadcastSendDetail = {
  threadId: string;
  threadName: string;
  success: boolean;
  error?: string;
};

export type BroadcastSendResult = {
  total: number;
  succeeded: number;
  failed: number;
  details: BroadcastSendDetail[];
};

export async function sendBroadcastBatch(params: BroadcastSendParams): Promise<BroadcastSendResult> {
  const { accountId, threadIds, message, delayMinMs = 1500, delayMaxMs = 2500 } = params;

  if (!accountId) {
    throw new Error("Thiếu accountId");
  }
  if (!threadIds || threadIds.length === 0) {
    throw new Error("Chưa chọn nhóm / người nhận");
  }
  if (!message || !message.trim()) {
    throw new Error("Nội dung thông báo không được để trống");
  }

  const api = getRunningAccountApi(accountId);
  if (!api) {
    throw new Error("Tài khoản Zalo chưa kết nối hoặc đang offline. Vui lòng kiểm tra lại tài khoản.");
  }

  const targetThreads = listBroadcastTargets({ accountId });
  const threadMap = new Map(targetThreads.map((t) => [t.threadId, t]));

  const details: BroadcastSendDetail[] = [];
  let succeeded = 0;
  let failed = 0;

  const logStmt = db.prepare(`
    INSERT INTO broadcast_logs (account_id, thread_id, thread_name, message, status, error)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < threadIds.length; i++) {
    const threadId = threadIds[i]!;
    const thread = threadMap.get(threadId);
    const threadName = thread ? thread.displayName : threadId;
    const threadType = thread ? thread.threadType : 1;

    try {
      const target: ReplyTarget = {
        api,
        threadKey: `${accountId}:${threadId}`,
        threadId,
        threadType,
      };

      const result = await deliverChatReply(target, accountId, threadId, message.trim());
      if (result.hong) {
        throw new Error("Không thể chuyển tin nhắn đến Zalo");
      }

      succeeded += 1;
      details.push({ threadId, threadName, success: true });
      logStmt.run(accountId, threadId, threadName, message.trim(), "success", null);
      log.info({ threadId, threadName, progress: `${i + 1}/${threadIds.length}` }, "Đã gửi thông báo broadcast");
    } catch (err) {
      failed += 1;
      const errorMsg = err instanceof Error ? err.message : String(err);
      details.push({ threadId, threadName, success: false, error: errorMsg });
      logStmt.run(accountId, threadId, threadName, message.trim(), "failed", errorMsg);
      log.error({ threadId, threadName, err }, "Lỗi khi gửi thông báo broadcast");
    }

    // Delay tự nhiên giữa các nhóm để chống spam
    if (i < threadIds.length - 1) {
      const delay = delayMinMs + Math.random() * (delayMaxMs - delayMinMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    total: threadIds.length,
    succeeded,
    failed,
    details,
  };
}

export type BroadcastLogItem = {
  id: number;
  accountId: string;
  threadId: string;
  threadName: string;
  message: string;
  status: string;
  error: string | null;
  createdAt: string;
};

type BroadcastLogRow = {
  id: number;
  account_id: string;
  thread_id: string;
  thread_name: string;
  message: string;
  status: string;
  error: string | null;
  created_at: string;
};

export function getBroadcastHistory(accountId?: string, limit = 50): BroadcastLogItem[] {
  let sql = `
    SELECT id, account_id, thread_id, thread_name, message, status, error, created_at
    FROM broadcast_logs
  `;
  const params: (string | number)[] = [];
  if (accountId) {
    sql += ` WHERE account_id = ?`;
    params.push(accountId);
  }
  sql += ` ORDER BY id DESC LIMIT ?`;
  params.push(Math.min(200, Math.max(1, limit)));

  const rows = db.prepare(sql).all(...params) as unknown as BroadcastLogRow[];
  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    threadId: r.thread_id,
    threadName: r.thread_name,
    message: r.message,
    status: r.status,
    error: r.error,
    createdAt: r.created_at,
  }));
}
