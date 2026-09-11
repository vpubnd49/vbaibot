import { db } from "../conversation/database.js";
import type { QpplDoc, QpplFileLink, QpplNguon } from "./qppl-types.js";

function mergeFileUrls(existingJson: string | undefined, incomingJson: string | undefined): string {
  const parse = (value: string | undefined): QpplFileLink[] => {
    if (!value) return [];
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is QpplFileLink =>
            typeof item === "object" && item !== null &&
            typeof (item as QpplFileLink).url === "string" &&
            typeof (item as QpplFileLink).name === "string",
          )
        : [];
    } catch {
      return [];
    }
  };

  const merged = new Map<string, QpplFileLink>();
  for (const link of [...parse(existingJson), ...parse(incomingJson)]) {
    if (!merged.has(link.url)) merged.set(link.url, link);
  }
  return JSON.stringify([...merged.values()]);
}

type Row = {
  id: number;
  so_ky_hieu: string;
  trich_yeu: string;
  loai_van_ban: string;
  co_quan: string;
  linh_vuc: string;
  hieu_luc: string;
  ngay_ban_hanh: string;
  nguon: string;
  file_urls: string;
  local_path: string | null;
  file_size: number;
  sp_id: number | null;
  modified_at: string;
  created_at: string;
};

function toDoc(row: Row): QpplDoc {
  return {
    id: row.id,
    soKyHieu: row.so_ky_hieu,
    trichYeu: row.trich_yeu,
    loaiVanBan: row.loai_van_ban,
    coQuanBanHanh: row.co_quan,
    linhVuc: row.linh_vuc,
    hieuLuc: row.hieu_luc,
    ngayBanHanh: row.ngay_ban_hanh,
    nguon: row.nguon,
    fileUrls: row.file_urls,
    localPath: row.local_path,
    fileSize: row.file_size,
    spId: row.sp_id,
    modifiedAt: row.modified_at,
    createdAt: row.created_at,
  };
}

export function upsertQpplDoc(doc: {
  soKyHieu: string;
  trichYeu?: string;
  loaiVanBan?: string;
  coQuanBanHanh?: string;
  linhVuc?: string;
  hieuLuc?: string;
  ngayBanHanh?: string;
  nguon: QpplNguon;
  fileUrls?: string;
  localPath?: string | null;
  fileSize?: number;
  spId?: number | null;
  modifiedAt?: string;
}): QpplDoc {
  const existing = doc.spId == null
    ? undefined
    : db.prepare("SELECT file_urls FROM qppl_documents WHERE nguon = ? AND sp_id = ?").get(doc.nguon, doc.spId) as { file_urls?: string } | undefined;
  const mergedFileUrls = mergeFileUrls(existing?.file_urls, doc.fileUrls);

  const stmt = db.prepare(`
    INSERT INTO qppl_documents (
      so_ky_hieu, trich_yeu, loai_van_ban, co_quan, linh_vuc, hieu_luc,
      ngay_ban_hanh, nguon, file_urls, local_path, file_size, sp_id, modified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (nguon, sp_id) DO UPDATE SET
      so_ky_hieu = excluded.so_ky_hieu,
      trich_yeu = excluded.trich_yeu,
      loai_van_ban = excluded.loai_van_ban,
      co_quan = excluded.co_quan,
      linh_vuc = excluded.linh_vuc,
      hieu_luc = excluded.hieu_luc,
      ngay_ban_hanh = excluded.ngay_ban_hanh,
      file_urls = CASE WHEN length(excluded.file_urls) > 2
                 THEN excluded.file_urls
                 ELSE qppl_documents.file_urls END,
      local_path = COALESCE(excluded.local_path, qppl_documents.local_path),
      file_size = CASE WHEN excluded.file_size > 0 THEN excluded.file_size ELSE qppl_documents.file_size END,
      modified_at = excluded.modified_at
    RETURNING *
  `);

  const row = stmt.get(
    doc.soKyHieu,
    doc.trichYeu ?? "",
    doc.loaiVanBan ?? "",
    doc.coQuanBanHanh ?? "",
    doc.linhVuc ?? "",
    doc.hieuLuc ?? "Còn",
    doc.ngayBanHanh ?? null,
    doc.nguon,
    mergedFileUrls,
    doc.localPath ?? null,
    doc.fileSize ?? 0,
    doc.spId ?? null,
    doc.modifiedAt ?? new Date().toISOString(),
  ) as Row;

  return toDoc(row);
}

/**
 * Tìm kiếm văn bản QPPL theo từ khóa, loại VB và nguồn.
 *
 * Tìm LIKE trên: số ký hiệu, trích yếu, cơ quan, lĩnh vực.
 */
export function searchQpplDocs(opts?: {
  keyword?: string;
  loaiVanBan?: string;
  nguon?: QpplNguon;
  limit?: number;
}): QpplDoc[] {
  const max = Math.max(1, Math.min(opts?.limit ?? 10, 30));
  const kw = opts?.keyword?.trim();
  const loai = opts?.loaiVanBan?.trim();
  const nguon = opts?.nguon;

  const conditions: string[] = [];
  const params: (string | number | null)[] = [];

  if (kw && kw.toLowerCase() !== "mới nhất" && kw.toLowerCase() !== "latest") {
    const term = `%${kw}%`;
    conditions.push(
      "(so_ky_hieu LIKE ? OR trich_yeu LIKE ? OR co_quan LIKE ? OR linh_vuc LIKE ?)",
    );
    params.push(term, term, term, term);
  }

  if (loai) {
    conditions.push("loai_van_ban LIKE ?");
    params.push(`%${loai}%`);
  }

  if (nguon) {
    conditions.push("nguon = ?");
    params.push(nguon);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(max);

  const rows = db
    .prepare(
      `SELECT * FROM qppl_documents ${where}
       ORDER BY ngay_ban_hanh DESC, modified_at DESC, id DESC
       LIMIT ?`,
    )
    .all(...(params as import("node:sqlite").SQLInputValue[])) as Row[];

  return rows.map(toDoc);
}

export function getQpplDocById(id: number): QpplDoc | null {
  const row = db
    .prepare("SELECT * FROM qppl_documents WHERE id = ?")
    .get(id) as Row | undefined;
  return row ? toDoc(row) : null;
}

export function countQpplDocs(nguon?: QpplNguon): number {
  if (nguon) {
    const row = db
      .prepare("SELECT COUNT(*) as count FROM qppl_documents WHERE nguon = ?")
      .get(nguon) as { count: number };
    return row?.count ?? 0;
  }
  const row = db
    .prepare("SELECT COUNT(*) as count FROM qppl_documents")
    .get() as { count: number };
  return row?.count ?? 0;
}

/**
 * Cập nhật đường dẫn file đã tải cho một văn bản.
 * Dùng khi tải on-demand: chỉ cập nhật local_path + file_size.
 */
export function updateQpplLocalPath(
  id: number,
  localPath: string,
  fileSize: number,
): void {
  db.prepare(
    "UPDATE qppl_documents SET local_path = ?, file_size = ? WHERE id = ?",
  ).run(localPath, fileSize, id);
}
