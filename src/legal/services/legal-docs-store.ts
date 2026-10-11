/**
 * legal-docs-store.ts
 * Kho văn bản pháp luật tự cào + tải (bảng legal_docs).
 *
 * Dùng chung cho:
 * - legal-docs-crawler: cào văn bản mới, xếp hàng chờ tải, tải PDF chính thức
 * - national-legal-service: tra cache trước khi tải theo yêu cầu người dùng,
 *   ghi lại lượt tải theo yêu cầu (origin = 'user')
 * - Dashboard: thống kê đã cào / chờ tải / đã tải
 */
import fs from "node:fs";
import { db } from "../../conversation/database.js";

export type LegalDocStatus = "pending" | "downloaded" | "failed" | "no_file" | "duplicate" | "purged";
export type LegalDocSource = "chinhphu" | "congbao" | "vbpl" | "phapluat" | "tvpl";

export type LegalDocRow = {
  id: string;
  source: LegalDocSource;
  soHieu: string;
  trichYeu: string;
  loaiVb: string;
  ngayBanHanh: string;
  detailUrl: string;
  fileUrl: string;
  status: LegalDocStatus;
  origin: "crawler" | "user";
  filePath: string | null;
  fileSize: number;
  attempts: number;
  lastError: string | null;
  discoveredAt: string;
  downloadedAt: string | null;
};

type Raw = {
  id: string;
  source: string;
  so_hieu: string;
  trich_yeu: string;
  loai_vb: string;
  ngay_ban_hanh: string;
  detail_url: string;
  file_url: string;
  status: string;
  origin: string;
  file_path: string | null;
  file_size: number;
  attempts: number;
  last_error: string | null;
  discovered_at: string;
  downloaded_at: string | null;
};

function toRow(r: Raw): LegalDocRow {
  return {
    id: r.id,
    source: r.source as LegalDocSource,
    soHieu: r.so_hieu,
    trichYeu: r.trich_yeu,
    loaiVb: r.loai_vb,
    ngayBanHanh: r.ngay_ban_hanh,
    detailUrl: r.detail_url,
    fileUrl: r.file_url,
    status: r.status as LegalDocStatus,
    origin: r.origin as "crawler" | "user",
    filePath: r.file_path,
    fileSize: r.file_size,
    attempts: r.attempts,
    lastError: r.last_error,
    discoveredAt: r.discovered_at,
    downloadedAt: r.downloaded_at,
  };
}

/** Chuẩn hoá số hiệu để so trùng giữa các nguồn: "48/2026/QĐ-TTg" -> "482026QDTTG" */
export function normalizeSoHieu(s: string): string {
  return s.replace(/[\s/._-]/g, "").toUpperCase().replace(/Đ/g, "D");
}

// ───── Statements ─────

const insertStmt = db.prepare(`
  INSERT INTO legal_docs (id, source, so_hieu, so_hieu_norm, trich_yeu, loai_vb, ngay_ban_hanh, detail_url, file_url, origin)
  VALUES (@id, @source, @soHieu, @soHieuNorm, @trichYeu, @loaiVb, @ngayBanHanh, @detailUrl, @fileUrl, @origin)
  ON CONFLICT (id) DO UPDATE SET
    file_url = CASE WHEN legal_docs.file_url = '' THEN excluded.file_url ELSE legal_docs.file_url END,
    trich_yeu = CASE WHEN legal_docs.trich_yeu = '' THEN excluded.trich_yeu ELSE legal_docs.trich_yeu END
`);
const existsStmt = db.prepare("SELECT 1 FROM legal_docs WHERE id = ?");
const pendingStmt = db.prepare(`
  SELECT * FROM legal_docs
  WHERE status = 'pending' OR (status = 'failed' AND attempts < 3)
  ORDER BY discovered_at DESC LIMIT ?
`);
const markDownloadedStmt = db.prepare(`
  UPDATE legal_docs SET status = @status, file_path = @filePath, file_size = @fileSize, file_url = COALESCE(NULLIF(@fileUrl, ''), file_url),
    last_error = NULL, attempts = attempts + 1, downloaded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = @id
`);
const markFailedStmt = db.prepare(`
  UPDATE legal_docs SET status = @status, last_error = @error, attempts = attempts + 1 WHERE id = @id
`);
const findDownloadedBySoHieuStmt = db.prepare(`
  SELECT * FROM legal_docs WHERE so_hieu_norm = ? AND status IN ('downloaded','duplicate') AND file_path IS NOT NULL
  ORDER BY downloaded_at DESC LIMIT 5
`);
const getStmt = db.prepare("SELECT * FROM legal_docs WHERE id = ?");
const retryStmt = db.prepare("UPDATE legal_docs SET status = 'pending', attempts = 0, last_error = NULL WHERE id = ?");
const retryAllFailedStmt = db.prepare("UPDATE legal_docs SET status = 'pending', attempts = 0, last_error = NULL WHERE status = 'failed'");

// ───── API ─────

export type NewLegalDoc = {
  id: string;
  source: LegalDocSource;
  soHieu: string;
  trichYeu: string;
  loaiVb?: string;
  ngayBanHanh?: string;
  detailUrl: string;
  fileUrl?: string;
  origin?: "crawler" | "user";
};

/** Thêm văn bản mới vào hàng đợi. Trả true nếu là văn bản CHƯA từng thấy. */
export function upsertLegalDoc(doc: NewLegalDoc): boolean {
  const isNew = !existsStmt.get(doc.id);
  insertStmt.run({
    id: doc.id,
    source: doc.source,
    soHieu: doc.soHieu,
    soHieuNorm: normalizeSoHieu(doc.soHieu),
    trichYeu: doc.trichYeu,
    loaiVb: doc.loaiVb ?? "",
    ngayBanHanh: doc.ngayBanHanh ?? "",
    detailUrl: doc.detailUrl,
    fileUrl: doc.fileUrl ?? "",
    origin: doc.origin ?? "crawler",
  });
  return isNew;
}

export function listPendingLegalDocs(limit: number): LegalDocRow[] {
  return (pendingStmt.all(limit) as Raw[]).map(toRow);
}

export function markLegalDocDownloaded(id: string, filePath: string, fileSize: number, fileUrl = "", status: "downloaded" | "duplicate" = "downloaded"): void {
  markDownloadedStmt.run({ id, filePath, fileSize, fileUrl, status });
}

export function markLegalDocFailed(id: string, error: string, status: "failed" | "no_file" = "failed"): void {
  markFailedStmt.run({ id, error: error.slice(0, 500), status });
}

/** File đã tải (còn trên đĩa) của văn bản có cùng số hiệu - dùng làm cache khi người dùng hỏi */
export function findCachedLegalFile(soHieu: string): LegalDocRow | null {
  if (!soHieu.trim()) return null;
  const rows = (findDownloadedBySoHieuStmt.all(normalizeSoHieu(soHieu)) as Raw[]).map(toRow);
  return rows.find((r) => r.filePath && fs.existsSync(r.filePath)) ?? null;
}

export function getLegalDoc(id: string): LegalDocRow | null {
  const r = getStmt.get(id) as Raw | undefined;
  return r ? toRow(r) : null;
}

export function retryLegalDoc(id: string): void {
  retryStmt.run(id);
}

export function retryAllFailedLegalDocs(): number {
  return Number(retryAllFailedStmt.run().changes);
}

// ───── Dọn file (giới hạn dung lượng / số ngày lưu) ─────

export type PurgeCandidate = { id: string; filePath: string; fileSize: number; downloadedAt: string };

/** File do bộ cào tải (origin=crawler), cũ nhất trước */
export function listCrawlerFilesOldestFirst(): PurgeCandidate[] {
  return (
    db
      .prepare(`
        SELECT id, file_path AS filePath, file_size AS fileSize, downloaded_at AS downloadedAt FROM legal_docs
        WHERE status = 'downloaded' AND origin = 'crawler' AND file_path IS NOT NULL
        ORDER BY downloaded_at ASC
      `)
      .all() as PurgeCandidate[]
  );
}

export function crawlerFilesTotalBytes(): number {
  return Number(
    (db.prepare("SELECT COALESCE(SUM(file_size),0) v FROM legal_docs WHERE status = 'downloaded' AND origin = 'crawler'").get() as { v: number }).v,
  );
}

/** Đánh dấu đã xoá file - kèm các bản 'duplicate' trỏ cùng file. Văn bản vẫn còn trong danh mục. */
export function markLegalFilePurged(filePath: string): void {
  db.prepare(
    "UPDATE legal_docs SET status = 'purged', file_path = NULL WHERE file_path = ? AND status IN ('downloaded','duplicate')",
  ).run(filePath);
}

/** Ghi nhận 1 lượt tải theo yêu cầu người dùng (để thống kê + làm cache lần sau) */
export function recordUserDownload(input: {
  source: LegalDocSource;
  soHieu: string;
  trichYeu?: string;
  detailUrl?: string;
  filePath: string;
  fileSize: number;
}): void {
  const key = normalizeSoHieu(input.soHieu) || input.filePath;
  const id = `user:${input.source}:${key}`;
  upsertLegalDoc({
    id,
    source: input.source,
    soHieu: input.soHieu,
    trichYeu: input.trichYeu ?? "",
    detailUrl: input.detailUrl ?? "",
    origin: "user",
  });
  markLegalDocDownloaded(id, input.filePath, input.fileSize);
}

// ───── Thống kê ─────

export type LegalDocsStats = {
  total: number;
  byStatus: Record<string, number>;
  bySource: Array<{ source: string; total: number; downloaded: number; pending: number; failed: number }>;
  byOrigin: Record<string, number>;
  newToday: number;
  downloadedToday: number;
  totalBytes: number;
  latestIssued: string | null;
};

/** Đầu ngày theo giờ máy chủ, cùng định dạng ISO với cột discovered_at/downloaded_at */
const START_OF_TODAY_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'localtime', 'start of day', 'utc')";

export function getLegalDocsStats(): LegalDocsStats {
  const byStatus: Record<string, number> = {};
  for (const r of db.prepare("SELECT status, COUNT(*) c FROM legal_docs GROUP BY status").all() as Array<{ status: string; c: number }>) {
    byStatus[r.status] = r.c;
  }
  const byOrigin: Record<string, number> = {};
  for (const r of db.prepare("SELECT origin, COUNT(*) c FROM legal_docs GROUP BY origin").all() as Array<{ origin: string; c: number }>) {
    byOrigin[r.origin] = r.c;
  }
  const bySource = db
    .prepare(`
      SELECT source, COUNT(*) total,
        SUM(CASE WHEN status IN ('downloaded','duplicate') THEN 1 ELSE 0 END) downloaded,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) pending,
        SUM(CASE WHEN status IN ('failed','no_file') THEN 1 ELSE 0 END) failed
      FROM legal_docs GROUP BY source ORDER BY total DESC
    `)
    .all() as LegalDocsStats["bySource"];
  const one = (sql: string) => (db.prepare(sql).get() as { v: number | string | null }).v;
  return {
    total: Number(one("SELECT COUNT(*) v FROM legal_docs") ?? 0),
    byStatus,
    bySource,
    byOrigin,
    newToday: Number(one(`SELECT COUNT(*) v FROM legal_docs WHERE discovered_at >= ${START_OF_TODAY_SQL}`) ?? 0),
    downloadedToday: Number(one(`SELECT COUNT(*) v FROM legal_docs WHERE downloaded_at >= ${START_OF_TODAY_SQL}`) ?? 0),
    totalBytes: Number(one("SELECT COALESCE(SUM(file_size),0) v FROM legal_docs WHERE status = 'downloaded'") ?? 0),
    latestIssued: (one("SELECT MAX(ngay_ban_hanh) v FROM legal_docs WHERE ngay_ban_hanh != ''") as string | null) ?? null,
  };
}

export function listLegalDocs(opts: { status?: string; source?: string; q?: string; limit?: number; offset?: number }): { items: LegalDocRow[]; total: number } {
  const where: string[] = [];
  const params: Record<string, string> = {};
  if (opts.status === "failed") where.push("status IN ('failed','no_file')");
  else if (opts.status === "downloaded") where.push("status IN ('downloaded','duplicate')");
  else if (opts.status) {
    where.push("status = @status");
    params.status = opts.status;
  }
  if (opts.source) {
    where.push("source = @source");
    params.source = opts.source;
  }
  if (opts.q?.trim()) {
    where.push("(so_hieu LIKE @q OR trich_yeu LIKE @q)");
    params.q = `%${opts.q.trim()}%`;
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const items = (db.prepare(`SELECT * FROM legal_docs ${w} ORDER BY discovered_at DESC, ngay_ban_hanh DESC LIMIT ${limit} OFFSET ${offset}`).all(params) as Raw[]).map(toRow);
  const total = Number((db.prepare(`SELECT COUNT(*) v FROM legal_docs ${w}`).get(params) as { v: number }).v);
  return { items, total };
}
