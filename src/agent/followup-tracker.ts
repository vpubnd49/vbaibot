/**
 * Proactive follow-up: nhắc lại khi user chưa phản hồi sau N phút.
 *
 * Lưu vào DB pending_followups — scheduler pick up khi fire_at đến.
 */

import { db } from "../conversation/database.js";
import { getTuning } from "../config/runtime-tuning-settings.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("followup-tracker");

// ============ DB prepared statements ============

const insertStmt = db.prepare(`
  INSERT INTO pending_followups (account_id, thread_id, fire_at, status)
  VALUES (?, ?, ?, 'pending')
`);

const cancelStmt = db.prepare(`
  UPDATE pending_followups SET status = 'cancelled'
  WHERE account_id = ? AND thread_id = ? AND status = 'pending'
`);

const dueStmt = db.prepare(`
  SELECT id, account_id, thread_id
  FROM pending_followups
  WHERE status = 'pending' AND fire_at <= ?
  ORDER BY fire_at ASC
  LIMIT 20
`);

const markFiredStmt = db.prepare(`
  UPDATE pending_followups SET status = 'fired' WHERE id = ?
`);

// ============ Detection ============

/**
 * Phát hiện câu trả lời cần follow-up.
 *
 * Heuristic đơn giản: câu kết thúc bằng dấu ? hoặc chứa từ khóa yêu cầu phản hồi.
 */
const FOLLOWUP_TRIGGERS = [
  "anh xác nhận", "chị xác nhận", "cho em biết",
  "phản hồi lại", "vui lòng trả lời", "reply lại",
  "anh cho biết", "chị cho biết", "bạn cho biết",
  "có đồng ý không", "có muốn không", "cần gì thêm",
];

export function shouldTrackFollowup(response: string): boolean {
  const timeoutMs = getTuning("FOLLOWUP_TIMEOUT_MS");
  if (timeoutMs <= 0) return false;

  const trimmed = response.trim();
  if (trimmed.endsWith("?")) return true;

  const lower = trimmed.toLowerCase();
  return FOLLOWUP_TRIGGERS.some((kw) => lower.includes(kw));
}

// ============ Schedule / Cancel ============

export function scheduleFollowup(accountId: string, threadId: string): void {
  const timeoutMs = getTuning("FOLLOWUP_TIMEOUT_MS");
  if (timeoutMs <= 0) return;

  // Cancel pending trước khi schedule mới
  cancelStmt.run(accountId, threadId);

  const fireAt = Date.now() + timeoutMs;
  insertStmt.run(accountId, threadId, fireAt);
  log.info({ accountId, threadId, fireAt: new Date(fireAt).toISOString() }, "Đặt follow-up");
}

export function cancelFollowup(accountId: string, threadId: string): void {
  const result = cancelStmt.run(accountId, threadId);
  if (result.changes > 0) {
    log.debug({ accountId, threadId }, "Hủy follow-up (user đã phản hồi)");
  }
}

// ============ Polling ============

export type DueFollowup = {
  id: number;
  accountId: string;
  threadId: string;
};

/**
 * Lấy danh sách follow-up đến hạn.
 * Scheduler gọi hàm này mỗi vòng lặp.
 */
export function getDueFollowups(): DueFollowup[] {
  const now = Date.now();
  const rows = dueStmt.all(now) as { id: number; account_id: string; thread_id: string }[];
  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    threadId: r.thread_id,
  }));
}

export function markFollowupFired(id: number): void {
  markFiredStmt.run(id);
}
