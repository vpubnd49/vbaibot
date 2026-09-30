import { db } from "./database.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("ticket-store");

// Tạo bảng tickets
db.exec(`
  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT DEFAULT '',
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'normal',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT,
    notes TEXT DEFAULT ''
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tickets_account_status ON support_tickets(account_id, status)
`);

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface SupportTicket {
  id: number;
  accountId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  notes: string;
}

const createStmt = db.prepare(`
  INSERT INTO support_tickets (account_id, thread_id, sender_id, sender_name, subject, priority)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const updateStatusStmt = db.prepare(`
  UPDATE support_tickets SET status = ?, updated_at = datetime('now'),
  closed_at = CASE WHEN ? IN ('resolved','closed') THEN datetime('now') ELSE closed_at END
  WHERE id = ? AND account_id = ?
`);

const addNoteStmt = db.prepare(`
  UPDATE support_tickets SET notes = notes || ? || char(10), updated_at = datetime('now')
  WHERE id = ? AND account_id = ?
`);

const listStmt = db.prepare(`
  SELECT * FROM support_tickets
  WHERE account_id = ? AND (? = '' OR status = ?)
  ORDER BY
    CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
    created_at DESC
  LIMIT ? OFFSET ?
`);

const getStmt = db.prepare(`
  SELECT * FROM support_tickets WHERE id = ? AND account_id = ?
`);

const countStmt = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
    SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) as resolved
  FROM support_tickets WHERE account_id = ?
`);

function toTicket(row: Record<string, unknown>): SupportTicket {
  return {
    id: row.id as number,
    accountId: row.account_id as string,
    threadId: row.thread_id as string,
    senderId: row.sender_id as string,
    senderName: row.sender_name as string,
    subject: row.subject as string,
    status: row.status as TicketStatus,
    priority: row.priority as TicketPriority,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    closedAt: row.closed_at as string | null,
    notes: row.notes as string,
  };
}

export function createTicket(data: {
  accountId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  subject: string;
  priority?: TicketPriority;
}): SupportTicket {
  const result = createStmt.run(
    data.accountId, data.threadId, data.senderId,
    data.senderName, data.subject, data.priority ?? "normal",
  );
  const id = Number(result.lastInsertRowid);
  log.info({ id, subject: data.subject }, "Ticket mới");
  return getTicket(data.accountId, id)!;
}

export function updateTicketStatus(
  accountId: string, id: number, status: TicketStatus,
): boolean {
  const changes = updateStatusStmt.run(status, status, id, accountId).changes;
  return Number(changes) > 0;
}

export function addTicketNote(
  accountId: string, id: number, note: string,
): boolean {
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const changes = addNoteStmt.run(`[${timestamp}] ${note}`, id, accountId).changes;
  return Number(changes) > 0;
}

export function listTickets(
  accountId: string,
  status = "",
  limit = 20,
  offset = 0,
): SupportTicket[] {
  const rows = listStmt.all(accountId, status, status, limit, offset) as Record<string, unknown>[];
  return rows.map(toTicket);
}

export function getTicket(accountId: string, id: number): SupportTicket | null {
  const row = getStmt.get(id, accountId) as Record<string, unknown> | undefined;
  return row ? toTicket(row) : null;
}

export function ticketStats(accountId: string) {
  return countStmt.get(accountId) as {
    total: number;
    open_count: number;
    in_progress: number;
    resolved: number;
  };
}
