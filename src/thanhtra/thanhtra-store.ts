import { db } from "../conversation/database.js";
import type { ThanhtraDoc } from "./thanhtra-types.js";

type Row = {
  id: number;
  title: string;
  description: string;
  file_ref: string;
  pdf_url: string | null;
  local_path: string | null;
  file_size: number;
  modified_at: string;
  created_at: string;
};

function toDoc(row: Row): ThanhtraDoc {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    fileRef: row.file_ref,
    pdfUrl: row.pdf_url,
    localPath: row.local_path,
    fileSize: row.file_size,
    modifiedAt: row.modified_at,
    createdAt: row.created_at,
  };
}

export function upsertThanhtraDoc(doc: {
  title: string;
  description?: string;
  fileRef: string;
  pdfUrl?: string | null;
  localPath?: string | null;
  fileSize?: number;
  modifiedAt?: string;
}): ThanhtraDoc {
  const stmt = db.prepare(`
    INSERT INTO thanhtra_documents (
      title, description, file_ref, pdf_url, local_path, file_size, modified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (file_ref) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      pdf_url = COALESCE(excluded.pdf_url, thanhtra_documents.pdf_url),
      local_path = COALESCE(excluded.local_path, thanhtra_documents.local_path),
      file_size = CASE WHEN excluded.file_size > 0 THEN excluded.file_size ELSE thanhtra_documents.file_size END,
      modified_at = excluded.modified_at
    RETURNING id, title, description, file_ref, pdf_url, local_path, file_size, modified_at, created_at
  `);

  const row = stmt.get(
    doc.title,
    doc.description ?? "",
    doc.fileRef,
    doc.pdfUrl ?? null,
    doc.localPath ?? null,
    doc.fileSize ?? 0,
    doc.modifiedAt ?? new Date().toISOString(),
  ) as Row;

  return toDoc(row);
}

export function searchThanhtraDocs(keyword?: string, limit = 10): ThanhtraDoc[] {
  const max = Math.max(1, Math.min(limit, 30));
  const kw = keyword?.trim();

  if (!kw || kw.toLowerCase() === "mới nhất" || kw.toLowerCase() === "latest") {
    const rows = db.prepare(`
      SELECT id, title, description, file_ref, pdf_url, local_path, file_size, modified_at, created_at
      FROM thanhtra_documents
      ORDER BY modified_at DESC, id DESC
      LIMIT ?
    `).all(max) as Row[];
    return rows.map(toDoc);
  }

  // Tìm kiếm theo từ khóa trong tiêu đề và mô tả
  const term = `%${kw}%`;
  const rows = db.prepare(`
    SELECT id, title, description, file_ref, pdf_url, local_path, file_size, modified_at, created_at
    FROM thanhtra_documents
    WHERE title LIKE ? OR description LIKE ? OR file_ref LIKE ?
    ORDER BY modified_at DESC, id DESC
    LIMIT ?
  `).all(term, term, term, max) as Row[];

  return rows.map(toDoc);
}

export function getThanhtraDocById(id: number): ThanhtraDoc | null {
  const row = db.prepare(`
    SELECT id, title, description, file_ref, pdf_url, local_path, file_size, modified_at, created_at
    FROM thanhtra_documents
    WHERE id = ?
  `).get(id) as Row | undefined;

  return row ? toDoc(row) : null;
}

export function countThanhtraDocs(): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM thanhtra_documents").get() as { count: number };
  return row?.count ?? 0;
}
