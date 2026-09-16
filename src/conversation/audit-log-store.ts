/**
 * Audit trail: log mọi hành động quan trọng.
 *
 * Ghi vào SQLite — không phụ thuộc dịch vụ bên ngoài, query được từ dashboard.
 * Tự dọn entries > 90 ngày khi ghi mới (fire-and-forget).
 */

import { db } from "./database.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("audit-log");

/** Các loại hành động được audit */
export type AuditAction =
  | "config_change"
  | "account_toggle"
  | "bot_toggle"
  | "knowledge_approve"
  | "knowledge_reject"
  | "override_save"
  | "override_delete"
  | "login"
  | "login_fail"
  | "broadcast_send"
  | "agent_update"
  | "tuning_change"
  | "password_change"
  | "feedback_save";

export type AuditActor = "admin" | "user" | "system";

// ============ DB prepared statements ============

const insertStmt = db.prepare(`
  INSERT INTO audit_logs (actor, action, account_id, thread_id, details, ip)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const listStmt = db.prepare(`
  SELECT id, created_at, actor, action, account_id, thread_id, details, ip
  FROM audit_logs
  WHERE (? = '' OR action = ?)
    AND (? = '' OR actor = ?)
    AND (? = '' OR account_id = ?)
  ORDER BY id DESC
  LIMIT ? OFFSET ?
`);

const countStmt = db.prepare(`
  SELECT COUNT(*) AS total FROM audit_logs
  WHERE (? = '' OR action = ?)
    AND (? = '' OR actor = ?)
    AND (? = '' OR account_id = ?)
`);

/** Dọn entries cũ hơn 90 ngày — chạy fire-and-forget */
const pruneStmt = db.prepare(`
  DELETE FROM audit_logs
  WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')
`);

// Đếm bao nhiêu lần insert từ khi dọn lần cuối — dọn mỗi 100 lần insert
let insertsSincePrune = 0;

// ============ API ============

export function logAudit(params: {
  actor: AuditActor;
  action: AuditAction;
  accountId?: string;
  threadId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}): void {
  try {
    insertStmt.run(
      params.actor,
      params.action,
      params.accountId ?? "",
      params.threadId ?? "",
      params.details ? JSON.stringify(params.details) : null,
      params.ip ?? "",
    );

    // Dọn entries cũ mỗi 100 lần insert
    insertsSincePrune++;
    if (insertsSincePrune >= 100) {
      insertsSincePrune = 0;
      pruneStmt.run();
    }
  } catch (err) {
    // Không để audit lỗi làm crash flow chính
    log.error({ err }, "Lỗi ghi audit log");
  }
}

export type AuditLogRow = {
  id: number;
  createdAt: string;
  actor: string;
  action: string;
  accountId: string;
  threadId: string;
  details: Record<string, unknown> | null;
  ip: string;
};

export function listAuditLogs(params: {
  action?: string;
  actor?: string;
  accountId?: string;
  limit?: number;
  offset?: number;
}): { items: AuditLogRow[]; total: number } {
  const action = params.action ?? "";
  const actor = params.actor ?? "";
  const accountId = params.accountId ?? "";
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  type Row = {
    id: number; created_at: string; actor: string; action: string;
    account_id: string; thread_id: string; details: string | null; ip: string;
  };

  const rows = listStmt.all(action, action, actor, actor, accountId, accountId, limit, offset) as Row[];
  const { total } = countStmt.get(action, action, actor, actor, accountId, accountId) as { total: number };

  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      actor: r.actor,
      action: r.action,
      accountId: r.account_id,
      threadId: r.thread_id,
      details: r.details ? JSON.parse(r.details) : null,
      ip: r.ip,
    })),
  };
}
