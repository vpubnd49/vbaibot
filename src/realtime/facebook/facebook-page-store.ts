/**
 * facebook-page-store.ts
 * Lưu trữ cấu hình các Facebook Page cần cào + bài viết đã cào.
 *
 * Dùng SQLite (node:sqlite, shared db instance) giống các store khác:
 * - thanhtra-store.ts, scheduled-job-store.ts, ...
 *
 * 2 bảng:
 * - facebook_pages: danh sách page cào (id, token mã hoá, tên, chuyên mục)
 * - facebook_posts: cache bài viết đã cào
 */
import { db } from "../../conversation/database.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("facebook-page-store");

// ───── Types ─────────────────────────────────────────────────────────────────

export type FacebookPageConfig = {
  pageId: string;
  pageName: string;
  pageUrl: string;
  /** Token mã hoá AES (decrypt khi cần gọi API) — rỗng nếu chưa có token */
  encryptedToken: string;
  category: string;
  enabled: boolean;
  lastCrawledAt: string | null;
};

export type FacebookPostRow = {
  postId: string;
  pageId: string;
  pageName: string;
  message: string;
  permalink: string;
  imageUrl: string | null;
  createdAt: string;
  fetchedAt: string;
  category: string;
};

// ───── Prepared Statements (lazy) ────────────────────────────────────────────

const upsertPageStmt = db.prepare(`
  INSERT INTO facebook_pages (page_id, page_name, page_url, encrypted_token, category, enabled)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (page_id) DO UPDATE SET
    page_name = COALESCE(NULLIF(excluded.page_name, ''), facebook_pages.page_name),
    page_url = COALESCE(NULLIF(excluded.page_url, ''), facebook_pages.page_url),
    encrypted_token = CASE WHEN excluded.encrypted_token != '' THEN excluded.encrypted_token ELSE facebook_pages.encrypted_token END,
    category = excluded.category,
    enabled = excluded.enabled
`);

const listPagesStmt = db.prepare("SELECT * FROM facebook_pages ORDER BY page_name");
const listEnabledPagesStmt = db.prepare("SELECT * FROM facebook_pages WHERE enabled = 1 ORDER BY page_name");
const getPageStmt = db.prepare("SELECT * FROM facebook_pages WHERE page_id = ?");
const deletePageStmt = db.prepare("DELETE FROM facebook_pages WHERE page_id = ?");

const updateLastCrawledStmt = db.prepare(`
  UPDATE facebook_pages SET last_crawled_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE page_id = ?
`);

const upsertPostStmt = db.prepare(`
  INSERT INTO facebook_posts (post_id, page_id, page_name, message, permalink, image_url, created_at, category)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (post_id) DO UPDATE SET
    message = excluded.message,
    image_url = COALESCE(excluded.image_url, facebook_posts.image_url)
`);

const listRecentPostsStmt = db.prepare(`
  SELECT * FROM facebook_posts ORDER BY created_at DESC LIMIT ?
`);

const listPostsByPageStmt = db.prepare(`
  SELECT * FROM facebook_posts WHERE page_id = ? ORDER BY created_at DESC LIMIT ?
`);

const listPostsByCategoryStmt = db.prepare(`
  SELECT * FROM facebook_posts WHERE category = ? ORDER BY created_at DESC LIMIT ?
`);

const getLatestPostTimeStmt = db.prepare(`
  SELECT MAX(created_at) as latest FROM facebook_posts WHERE page_id = ?
`);

const countPostsStmt = db.prepare("SELECT COUNT(*) as count FROM facebook_posts");

const cleanupOldPostsStmt = db.prepare(`
  DELETE FROM facebook_posts WHERE created_at < datetime('now', '-30 days')
`);

// ───── Page CRUD ─────────────────────────────────────────────────────────────

type RawPageRow = {
  page_id: string;
  page_name: string;
  page_url: string;
  encrypted_token: string;
  category: string;
  enabled: number;
  last_crawled_at: string | null;
  created_at: string;
};

function toPageConfig(row: RawPageRow): FacebookPageConfig {
  return {
    pageId: row.page_id,
    pageName: row.page_name,
    pageUrl: row.page_url,
    encryptedToken: row.encrypted_token,
    category: row.category,
    enabled: row.enabled === 1,
    lastCrawledAt: row.last_crawled_at,
  };
}

export function upsertFacebookPage(page: {
  pageId: string;
  pageName: string;
  pageUrl?: string;
  encryptedToken?: string;
  category?: string;
  enabled?: boolean;
}): void {
  upsertPageStmt.run(
    page.pageId,
    page.pageName,
    page.pageUrl ?? "",
    page.encryptedToken ?? "",
    page.category ?? "tong_hop",
    page.enabled !== false ? 1 : 0,
  );
  log.info({ pageId: page.pageId, pageName: page.pageName }, "Đã upsert Facebook page");
}

export function listFacebookPages(): FacebookPageConfig[] {
  return (listPagesStmt.all() as RawPageRow[]).map(toPageConfig);
}

export function listEnabledFacebookPages(): FacebookPageConfig[] {
  return (listEnabledPagesStmt.all() as RawPageRow[]).map(toPageConfig);
}

export function getFacebookPage(pageId: string): FacebookPageConfig | null {
  const row = getPageStmt.get(pageId) as RawPageRow | undefined;
  return row ? toPageConfig(row) : null;
}

export function deleteFacebookPage(pageId: string): void {
  deletePageStmt.run(pageId);
}

export function markPageCrawled(pageId: string): void {
  updateLastCrawledStmt.run(pageId);
}

// ───── Post CRUD ─────────────────────────────────────────────────────────────

type RawPostRow = {
  post_id: string;
  page_id: string;
  page_name: string;
  message: string;
  permalink: string;
  image_url: string | null;
  created_at: string;
  fetched_at: string;
  category: string;
};

function toPostRow(row: RawPostRow): FacebookPostRow {
  return {
    postId: row.post_id,
    pageId: row.page_id,
    pageName: row.page_name,
    message: row.message,
    permalink: row.permalink,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    fetchedAt: row.fetched_at,
    category: row.category,
  };
}

export function upsertFacebookPost(post: {
  postId: string;
  pageId: string;
  pageName: string;
  message: string;
  permalink: string;
  imageUrl?: string | null;
  createdAt: string;
  category?: string;
}): void {
  upsertPostStmt.run(
    post.postId,
    post.pageId,
    post.pageName,
    post.message,
    post.permalink,
    post.imageUrl ?? null,
    post.createdAt,
    post.category ?? "tong_hop",
  );
}

export function listRecentPosts(limit = 10): FacebookPostRow[] {
  return (listRecentPostsStmt.all(limit) as RawPostRow[]).map(toPostRow);
}

export function listPostsByPage(pageId: string, limit = 10): FacebookPostRow[] {
  return (listPostsByPageStmt.all(pageId, limit) as RawPostRow[]).map(toPostRow);
}

export function listPostsByCategory(category: string, limit = 10): FacebookPostRow[] {
  return (listPostsByCategoryStmt.all(category, limit) as RawPostRow[]).map(toPostRow);
}

export function getLatestPostTime(pageId: string): string | null {
  const row = getLatestPostTimeStmt.get(pageId) as { latest: string | null } | undefined;
  return row?.latest ?? null;
}

export function countPosts(): number {
  const row = countPostsStmt.get() as { count: number };
  return row.count;
}

export function cleanupOldPosts(): number {
  const result = cleanupOldPostsStmt.run();
  const deleted = Number(result.changes);
  if (deleted > 0) {
    log.info({ deleted }, "Đã xoá bài Facebook cũ hơn 30 ngày");
  }
  return deleted;
}
