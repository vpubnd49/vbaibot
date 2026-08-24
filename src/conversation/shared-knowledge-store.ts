import { db } from "./database.js";
import { getTuning } from "../config/runtime-tuning-settings.js";

export type SharedKnowledgeFact = {
  id: number;
  accountId: string;
  category: string;
  content: string;
  source: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  learnedInThreadId: string;
  createdAt: string;
  approvedAt: string | null;
  expiresAt: string | null;
};

export type KnowledgeCategory = "legal" | "policy" | "procedure" | "correction" | "general";

const VALID_CATEGORIES = new Set<string>(["legal", "policy", "procedure", "correction", "general"]);

// Prepared statements
const insertStmt = db.prepare(`
  INSERT INTO shared_knowledge (account_id, category, content, source, status, learned_in_thread_id)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const trungStmt = db.prepare(`
  SELECT id FROM shared_knowledge
  WHERE account_id = ? AND content = ? AND status != 'rejected'
  LIMIT 1
`);

const approveStmt = db.prepare(`
  UPDATE shared_knowledge
  SET status = 'approved', reviewed_by = ?, approved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ? AND account_id = ?
`);

const rejectStmt = db.prepare(`
  UPDATE shared_knowledge
  SET status = 'rejected', reviewed_by = ?
  WHERE id = ? AND account_id = ?
`);

const deleteStmt = db.prepare(`
  DELETE FROM shared_knowledge WHERE id = ? AND account_id = ?
`);

// Query approved facts for injection into prompt — respects expiry and max items
const approvedStmt = db.prepare(`
  SELECT id, account_id, category, content, source, status, reviewed_by,
         learned_in_thread_id, created_at, approved_at, expires_at
  FROM shared_knowledge
  WHERE account_id = ? AND status = 'approved'
    AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ORDER BY id DESC
  LIMIT ?
`);

const listStmt = db.prepare(`
  SELECT id, account_id, category, content, source, status, reviewed_by,
         learned_in_thread_id, created_at, approved_at, expires_at
  FROM shared_knowledge
  WHERE account_id = ? AND (? = '' OR status = ?)
    AND (content LIKE ? OR source LIKE ?)
  ORDER BY id DESC
  LIMIT ? OFFSET ?
`);

const countPendingStmt = db.prepare(`
  SELECT COUNT(*) as cnt FROM shared_knowledge
  WHERE account_id = ? AND status = 'pending'
`);

function mapRow(r: any): SharedKnowledgeFact {
  return {
    id: r.id,
    accountId: r.account_id,
    category: r.category,
    content: r.content,
    source: r.source,
    status: r.status,
    reviewedBy: r.reviewed_by ?? null,
    learnedInThreadId: r.learned_in_thread_id,
    createdAt: r.created_at,
    approvedAt: r.approved_at ?? null,
    expiresAt: r.expires_at ?? null,
  };
}

export type KetQuaDeXuat =
  | { ghi: true; id: number }
  | { ghi: false; lyDo: "trung" | "loai_khong_hop_le" };

/**
 * Bot hoặc admin đề xuất thêm tri thức dùng chung.
 * Bot đề xuất → status='pending', admin đề xuất → status='approved'.
 */
export function proposeKnowledge(params: {
  accountId: string;
  category: string;
  content: string;
  source: string;
  learnedInThreadId: string;
  autoApprove?: boolean;
}): KetQuaDeXuat {
  if (!VALID_CATEGORIES.has(params.category)) {
    return { ghi: false, lyDo: "loai_khong_hop_le" };
  }
  const noiDung = params.content.trim();
  if (trungStmt.get(params.accountId, noiDung)) {
    return { ghi: false, lyDo: "trung" };
  }
  const status = params.autoApprove ? "approved" : "pending";
  const result = insertStmt.run(
    params.accountId,
    params.category,
    noiDung,
    params.source,
    status,
    params.learnedInThreadId,
  );
  return { ghi: true, id: Number(result.lastInsertRowid) };
}

const approveAllStmt = db.prepare(`
  UPDATE shared_knowledge
  SET status = 'approved', reviewed_by = ?, approved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE account_id = ? AND status = 'pending'
`);

/** Duyệt tri thức — chỉ admin gọi từ dashboard */
export function approveKnowledge(accountId: string, id: number, reviewedBy: string): boolean {
  return approveStmt.run(reviewedBy, id, accountId).changes > 0;
}

/** Duyệt TẤT CẢ tri thức chờ duyệt của account — chỉ admin gọi từ dashboard */
export function approveAllKnowledge(accountId: string, reviewedBy: string): number {
  return Number(approveAllStmt.run(reviewedBy, accountId).changes);
}

/** Từ chối tri thức — chỉ admin gọi từ dashboard */
export function rejectKnowledge(accountId: string, id: number, reviewedBy: string): boolean {
  return rejectStmt.run(reviewedBy, id, accountId).changes > 0;
}

/** Xóa hẳn tri thức */
export function deleteKnowledge(accountId: string, id: number): boolean {
  return deleteStmt.run(id, accountId).changes > 0;
}

/**
 * Lấy danh sách tri thức ĐÃ DUYỆT để inject vào system prompt.
 * Tôn trọng trần SHARED_KNOWLEDGE_MAX_ITEMS và expires_at.
 */
export function getApprovedKnowledge(accountId: string): SharedKnowledgeFact[] {
  const maxItems = getTuning("SHARED_KNOWLEDGE_MAX_ITEMS");
  const rows = approvedStmt.all(accountId, maxItems) as unknown as any[];
  return rows.map(mapRow);
}

/** Đếm số mục chờ duyệt (hiện badge trên dashboard) */
export function countPending(accountId: string): number {
  return (countPendingStmt.get(accountId) as any)?.cnt ?? 0;
}

/** Liệt kê cho dashboard — lọc theo status và tìm kiếm */
export function listKnowledge(params: {
  accountId: string;
  status?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): SharedKnowledgeFact[] {
  const statusFilter = params.status ?? "";
  const like = `%${params.query ?? ""}%`;
  const rows = listStmt.all(
    params.accountId,
    statusFilter, statusFilter,
    like, like,
    params.limit ?? 50,
    params.offset ?? 0,
  ) as unknown as any[];
  return rows.map(mapRow);
}
