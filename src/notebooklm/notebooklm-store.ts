import { db } from "../conversation/database.js";

/**
 * Lưu notebook của từng cuộc chat + đếm lượt TẠO nội dung mỗi ngày.
 *
 * Mỗi cuộc chat (account + thread) có đúng MỘT notebook riêng: nguồn của
 * nhóm này không bao giờ lẫn sang nhóm khác. Lượt đếm theo ngày giờ Việt Nam.
 */

db.exec(`
  CREATE TABLE IF NOT EXISTS notebooklm_notebooks (
    thread_key TEXT PRIMARY KEY,
    notebook_url TEXT NOT NULL,
    notebook_id TEXT NOT NULL,
    source_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS notebooklm_usage (
    day TEXT NOT NULL,
    thread_key TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, thread_key)
  )
`);

export type ThreadNotebook = { notebookUrl: string; notebookId: string; sourceCount: number };

const getNbStmt = db.prepare(
  "SELECT notebook_url, notebook_id, source_count FROM notebooklm_notebooks WHERE thread_key = ?",
);
const saveNbStmt = db.prepare(`
  INSERT INTO notebooklm_notebooks (thread_key, notebook_url, notebook_id) VALUES (?, ?, ?)
  ON CONFLICT (thread_key) DO UPDATE SET notebook_url = excluded.notebook_url,
    notebook_id = excluded.notebook_id, source_count = 0
`);
const addSrcStmt = db.prepare(
  "UPDATE notebooklm_notebooks SET source_count = source_count + ? WHERE thread_key = ?",
);

export function getThreadNotebook(threadKey: string): ThreadNotebook | null {
  const row = getNbStmt.get(threadKey) as
    | { notebook_url: string; notebook_id: string; source_count: number }
    | undefined;
  return row ? { notebookUrl: row.notebook_url, notebookId: row.notebook_id, sourceCount: row.source_count } : null;
}

export function saveThreadNotebook(threadKey: string, notebookUrl: string, notebookId: string): void {
  saveNbStmt.run(threadKey, notebookUrl, notebookId);
}

export function addSourceCount(threadKey: string, n = 1): void {
  addSrcStmt.run(n, threadKey);
}

export function countNotebooks(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM notebooklm_notebooks").get() as { n: number }).n;
}

/** Ngày theo giờ Việt Nam (YYYY-MM-DD) */
export function vnDay(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

const threadUsageStmt = db.prepare("SELECT count FROM notebooklm_usage WHERE day = ? AND thread_key = ?");
const globalUsageStmt = db.prepare("SELECT COALESCE(SUM(count), 0) AS n FROM notebooklm_usage WHERE day = ?");
const bumpStmt = db.prepare(`
  INSERT INTO notebooklm_usage (day, thread_key, count) VALUES (?1, ?2, MAX(0, ?3))
  ON CONFLICT (day, thread_key) DO UPDATE SET count = MAX(0, count + ?3)
`);

export function usageToday(threadKey: string, day = vnDay()): { thread: number; global: number } {
  const t = (threadUsageStmt.get(day, threadKey) as { count: number } | undefined)?.count ?? 0;
  const g = (globalUsageStmt.get(day) as { n: number }).n;
  return { thread: t, global: g };
}

/**
 * Giữ chỗ 1 lượt tạo. Kiểm và ghi liền nhau, KHÔNG có await ở giữa - SQLite
 * đồng bộ trên luồng chính nên hai yêu cầu đến cùng lúc không cùng lọt trần.
 */
export function reserveGeneration(
  threadKey: string,
  maxPerDay: number,
  maxGlobal: number,
): { ok: true } | { ok: false; reason: string } {
  const day = vnDay();
  const used = usageToday(threadKey, day);
  if (maxGlobal > 0 && used.global >= maxGlobal) {
    return { ok: false, reason: `Bot đã dùng hết ${maxGlobal} lượt tạo NotebookLM hôm nay. Mai thử lại nhé.` };
  }
  if (maxPerDay > 0 && used.thread >= maxPerDay) {
    return { ok: false, reason: `Cuộc chat này đã tạo ${used.thread}/${maxPerDay} lượt hôm nay. Mai thử lại nhé.` };
  }
  bumpStmt.run(day, threadKey, 1);
  return { ok: true };
}

/** Hoàn lượt khi việc tạo hỏng - người dùng không mất lượt vì lỗi phía máy chủ */
export function refundGeneration(threadKey: string): void {
  bumpStmt.run(vnDay(), threadKey, -1);
}
