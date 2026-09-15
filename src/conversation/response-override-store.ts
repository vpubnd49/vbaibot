/**
 * Lưu trữ các câu trả lời đã được admin sửa lại (Response Override).
 *
 * Mục đích: admin sửa câu bot trả lời sai → lưu cặp (câu hỏi, câu trả lời đúng)
 * làm few-shot examples → inject vào system prompt để bot tự cải thiện.
 */

import { db } from "./database.js";

export type ResponseOverride = {
  id: number;
  accountId: string;
  threadId: string;
  userMessage: string;
  originalResponse: string;
  correctedResponse: string;
  createdAt: string;
};

type Row = {
  id: number;
  account_id: string;
  thread_id: string;
  user_message: string;
  original_response: string;
  corrected_response: string;
  created_at: string;
};

const toOverride = (r: Row): ResponseOverride => ({
  id: r.id,
  accountId: r.account_id,
  threadId: r.thread_id,
  userMessage: r.user_message,
  originalResponse: r.original_response,
  correctedResponse: r.corrected_response,
  createdAt: r.created_at,
});

const insertStmt = db.prepare(`
  INSERT INTO response_overrides (account_id, thread_id, user_message, original_response, corrected_response)
  VALUES (?, ?, ?, ?, ?)
`);

/**
 * Lưu 1 override mới.
 * @returns id của override vừa tạo
 */
export function saveOverride(params: {
  accountId: string;
  threadId: string;
  userMessage: string;
  originalResponse: string;
  correctedResponse: string;
}): number {
  const result = insertStmt.run(
    params.accountId,
    params.threadId,
    params.userMessage,
    params.originalResponse,
    params.correctedResponse,
  );
  return Number(result.lastInsertRowid);
}

const recentStmt = db.prepare(`
  SELECT id, account_id, thread_id, user_message, original_response, corrected_response, created_at
  FROM response_overrides
  WHERE account_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

/**
 * Lấy N override gần nhất cho account, dùng làm few-shot examples.
 * Mặc định 3 — vừa đủ để model học pattern, không quá nhiều chiếm prompt.
 */
export function getRecentOverrides(accountId: string, limit = 3): ResponseOverride[] {
  return (recentStmt.all(accountId, limit) as unknown as Row[]).map(toOverride);
}

const listStmt = db.prepare(`
  SELECT id, account_id, thread_id, user_message, original_response, corrected_response, created_at
  FROM response_overrides
  WHERE (? = '' OR account_id = ?)
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`);

/** Liệt kê overrides cho dashboard. accountId rỗng = mọi account. */
export function listOverrides(params: {
  accountId?: string;
  limit?: number;
  offset?: number;
}): ResponseOverride[] {
  const acc = params.accountId ?? "";
  return (listStmt.all(acc, acc, params.limit ?? 50, params.offset ?? 0) as unknown as Row[]).map(toOverride);
}

const deleteStmt = db.prepare("DELETE FROM response_overrides WHERE id = ?");

/** Xóa 1 override. Trả true nếu xóa thành công. */
export function deleteOverride(id: number): boolean {
  return deleteStmt.run(id).changes > 0;
}

/**
 * Dựng khối few-shot từ overrides để inject vào system prompt.
 * Trả empty string nếu không có override nào.
 */
export function buildOverrideExamples(accountId: string): string {
  const overrides = getRecentOverrides(accountId, 3);
  if (overrides.length === 0) return "";

  const examples = overrides.map((o, i) =>
    `Ví dụ ${i + 1}:\n` +
    `Người dùng: ${o.userMessage.slice(0, 200)}\n` +
    `❌ Câu trả lời cũ (sai): ${o.originalResponse.slice(0, 200)}\n` +
    `✅ Câu trả lời đúng: ${o.correctedResponse.slice(0, 500)}`
  ).join("\n\n");

  return `Các ví dụ admin đã sửa - HỌC từ đây để không lặp lại sai lầm tương tự:\n${examples}`;
}
