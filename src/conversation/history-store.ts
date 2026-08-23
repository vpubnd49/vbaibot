import { closeDatabase, db } from "./database.js";
import { getTuning } from "../config/runtime-tuning-settings.js";

export type StoredFile = {
  fileName: string;
  localPath?: string;
  extension: string;
};

export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  senderName?: string;
  senderId?: string;
  /** Đường dẫn ảnh đã lưu trong data/media (tương đối DATA_DIR) - nạp lại cho model xem */
  images?: string[];
  /** File tài liệu đính kèm đã lưu trong data/media */
  files?: StoredFile[];
  /** ISO UTC - có sẵn khi đọc; khi ghi do DB tự sinh */
  createdAt?: string;
};

const insertStmt = db.prepare(
  `INSERT INTO messages (account_id, thread_id, role, sender_name, sender_id, content, images, files)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);

const recentStmt = db.prepare(
  `SELECT role, sender_name, sender_id, content, images, files, created_at FROM messages
   WHERE account_id = ? AND thread_id = ?
   ORDER BY id DESC LIMIT ?`,
);

/** Cột images là JSON array; NULL hoặc JSON hỏng đều coi như không có ảnh */
function parseImages(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(String) : undefined;
  } catch {
    return undefined;
  }
}

/** Cột files là JSON array; NULL hoặc JSON hỏng đều coi như không có file */
function parseFiles(raw: string | null): StoredFile[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as StoredFile[]) : undefined;
  } catch {
    return undefined;
  }
}

// Giữ N tin mới nhất của thread, xóa phần cũ hơn. Subquery lấy id của tin thứ
// N+1 tính từ mới nhất; thread có ít hơn N+1 tin thì trả NULL và không xóa gì.
// Cả DELETE lẫn subquery đều chạy trên index (account_id, thread_id, id).
const pruneStmt = db.prepare(
  `DELETE FROM messages
   WHERE account_id = ? AND thread_id = ?
     AND id <= (SELECT id FROM messages
                WHERE account_id = ? AND thread_id = ?
                ORDER BY id DESC LIMIT 1 OFFSET ?)`,
);

/** Ghi 1 tin, trả về id của row để cập nhật bổ sung sau (vd gắn ảnh/file tải xong muộn) */
export function appendMessage(
  accountId: string,
  threadId: string,
  message: StoredMessage,
): number {
  const result = insertStmt.run(
    accountId,
    threadId,
    message.role,
    message.senderName ?? null,
    message.senderId ?? null,
    message.content,
    message.images && message.images.length > 0 ? JSON.stringify(message.images) : null,
    message.files && message.files.length > 0 ? JSON.stringify(message.files) : null,
  );
  // Dọn ngay thread vừa ghi: không cần cron, và thread im lặng thì không tốn gì
  pruneStmt.run(accountId, threadId, accountId, threadId, getTuning("HISTORY_MAX_MESSAGES_PER_THREAD"));
  return Number(result.lastInsertRowid);
}

const setImagesStmt = db.prepare(`UPDATE messages SET images = ? WHERE id = ?`);
const setFilesStmt = db.prepare(`UPDATE messages SET files = ? WHERE id = ?`);

/** Gắn ảnh vào tin đã ghi - dùng cho passive listen */
export function setMessageImages(messageId: number, images: string[]): void {
  if (images.length === 0) return;
  setImagesStmt.run(JSON.stringify(images), messageId);
}

/** Gắn file vào tin đã ghi - dùng cho passive listen */
export function setMessageFiles(messageId: number, files: StoredFile[]): void {
  if (files.length === 0) return;
  setFilesStmt.run(JSON.stringify(files), messageId);
}

export function getRecentMessages(
  accountId: string,
  threadId: string,
  limit = getTuning("HISTORY_CONTEXT_LIMIT"),
): StoredMessage[] {
  type Row = {
    role: "user" | "assistant";
    sender_name: string | null;
    sender_id: string | null;
    content: string;
    images: string | null;
    files: string | null;
    created_at: string;
  };
  const rows = recentStmt.all(accountId, threadId, limit) as unknown as Row[];
  // DESC để lấy N tin mới nhất, đảo lại thành thứ tự thời gian cho LLM
  return rows.reverse().map((r) => ({
    role: r.role,
    content: r.content,
    senderName: r.sender_name ?? undefined,
    senderId: r.sender_id ?? undefined,
    images: parseImages(r.images),
    files: parseFiles(r.files),
    createdAt: r.created_at,
  }));
}

const pagedStmt = db.prepare(
  `SELECT id, role, sender_name, content, images, files, created_at FROM messages
   WHERE account_id = ? AND thread_id = ? AND id < ?
   ORDER BY id DESC LIMIT ?`,
);

export type PagedMessage = StoredMessage & { id: number };

/**
 * Đọc tin nhắn phân trang cho dashboard
 */
export function listMessagesPaged(
  accountId: string,
  threadId: string,
  options: { limit?: number; beforeId?: number } = {},
): PagedMessage[] {
  type Row = {
    id: number;
    role: "user" | "assistant";
    sender_name: string | null;
    content: string;
    images: string | null;
    files: string | null;
    created_at: string;
  };
  const rows = pagedStmt.all(
    accountId,
    threadId,
    options.beforeId ?? Number.MAX_SAFE_INTEGER,
    options.limit ?? 50,
  ) as unknown as Row[];
  return rows.reverse().map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    senderName: r.sender_name ?? undefined,
    images: parseImages(r.images),
    files: parseFiles(r.files),
    createdAt: r.created_at,
  }));
}

export function closeHistoryStore(): void {
  closeDatabase();
}
