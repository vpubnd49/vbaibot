/**
 * User feedback: lưu đánh giá 👍/👎 của người dùng cho từng lượt bot trả lời.
 *
 * Dữ liệu dùng cho:
 * - Dashboard: satisfaction score trên trang Overview
 * - Cải tiến: xem lại lượt nào bị 👎 để tìm vấn đề
 */

import { db } from "./database.js";

// ============ DB prepared statements ============

const insertStmt = db.prepare(`
  INSERT INTO user_feedback (account_id, thread_id, turn_id, rating, user_id)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (account_id, turn_id) DO UPDATE SET
    rating = excluded.rating,
    user_id = excluded.user_id,
    created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
`);

const statsStmt = db.prepare(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS positive,
    SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) AS negative
  FROM user_feedback
  WHERE (? = '' OR account_id = ?)
`);

const listStmt = db.prepare(`
  SELECT id, account_id, thread_id, turn_id, rating, user_id, created_at
  FROM user_feedback
  WHERE (? = '' OR account_id = ?)
  ORDER BY id DESC
  LIMIT ? OFFSET ?
`);

// ============ Types ============

export type FeedbackRow = {
  id: number;
  accountId: string;
  threadId: string;
  turnId: number;
  rating: 1 | -1;
  userId: string;
  createdAt: string;
};

export type FeedbackStats = {
  total: number;
  positive: number;
  negative: number;
  /** Phần trăm hài lòng (0–100). null khi chưa có feedback */
  satisfactionPct: number | null;
};

// ============ CRUD ============

export function saveFeedback(params: {
  accountId: string;
  threadId: string;
  turnId: number;
  rating: 1 | -1;
  userId: string;
}): void {
  insertStmt.run(params.accountId, params.threadId, params.turnId, params.rating, params.userId);
}

export function getFeedbackStats(accountId?: string): FeedbackStats {
  const acc = accountId ?? "";
  const row = statsStmt.get(acc, acc) as { total: number; positive: number; negative: number };

  return {
    total: row.total,
    positive: row.positive,
    negative: row.negative,
    satisfactionPct: row.total > 0 ? Math.round((row.positive / row.total) * 100) : null,
  };
}

export function listFeedback(params: {
  accountId?: string;
  limit?: number;
  offset?: number;
}): FeedbackRow[] {
  const acc = params.accountId ?? "";
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  type Row = {
    id: number; account_id: string; thread_id: string; turn_id: number;
    rating: number; user_id: string; created_at: string;
  };
  const rows = listStmt.all(acc, acc, limit, offset) as Row[];

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    threadId: r.thread_id,
    turnId: r.turn_id,
    rating: r.rating as 1 | -1,
    userId: r.user_id,
    createdAt: r.created_at,
  }));
}
