import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { db } from "../conversation/database.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("research-cache");

export const RESEARCH_TTL = {
  wikipedia: 24 * 3600, // 24 giờ
  arxiv: 6 * 3600, // 6 giờ
  arxiv_id: 24 * 3600, // 24 giờ cho ID cụ thể
  semantic_scholar: 6 * 3600, // 6 giờ
  crossref: 24 * 3600, // 24 giờ
  pubmed: 12 * 3600, // 12 giờ
  github: 15 * 60, // 15 phút
  stackoverflow: 3600, // 1 giờ
  hacker_news: 5 * 60, // 5 phút
} as const;

export function hashCacheKey(key: string): string {
  return createHash("sha256").update(key.trim().toLowerCase()).digest("hex");
}

type CacheRow = {
  provider: string;
  cache_key_hash: string;
  response_json: string;
  created_at: string;
  expires_at: string;
  stale_until: string | null;
};

const getStmt = db.prepare(`
  SELECT provider, cache_key_hash, response_json, created_at, expires_at, stale_until
  FROM research_cache
  WHERE provider = ? AND cache_key_hash = ?
`);

const setStmt = db.prepare(`
  INSERT INTO research_cache (provider, cache_key_hash, response_json, created_at, expires_at, stale_until)
  VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?, ?)
  ON CONFLICT (provider, cache_key_hash) DO UPDATE SET
    response_json = excluded.response_json,
    created_at = excluded.created_at,
    expires_at = excluded.expires_at,
    stale_until = excluded.stale_until
`);

const cleanupStmt = db.prepare(`
  DELETE FROM research_cache
  WHERE datetime(COALESCE(stale_until, expires_at)) < datetime('now')
`);

export function getResearchCache<T>(
  provider: string,
  key: string,
  options: { allowStale?: boolean } = {},
): { data: T; isStale: boolean } | null {
  if (!env.RESEARCH_CACHE_ENABLED) return null;

  try {
    const hash = hashCacheKey(key);
    const row = getStmt.get(provider, hash) as CacheRow | undefined;
    if (!row) return null;

    const now = Date.now();
    const expiresAt = new Date(row.expires_at).getTime();
    const staleUntil = row.stale_until ? new Date(row.stale_until).getTime() : expiresAt;

    if (now <= expiresAt) {
      return { data: JSON.parse(row.response_json) as T, isStale: false };
    }

    if (options.allowStale && now <= staleUntil) {
      log.debug({ provider }, "Phục vụ stale cache do upstream lỗi/chậm");
      return { data: JSON.parse(row.response_json) as T, isStale: true };
    }

    return null;
  } catch (err) {
    log.debug({ err, provider }, "Lỗi đọc research cache");
    return null;
  }
}

export function setResearchCache<T>(
  provider: string,
  key: string,
  data: T,
  ttlSeconds: number,
  staleGraceSeconds = ttlSeconds * 2,
): void {
  if (!env.RESEARCH_CACHE_ENABLED) return;

  try {
    const hash = hashCacheKey(key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const staleUntil = new Date(now.getTime() + (ttlSeconds + staleGraceSeconds) * 1000).toISOString();

    setStmt.run(provider, hash, JSON.stringify(data), expiresAt, staleUntil);
  } catch (err) {
    log.debug({ err, provider }, "Lỗi ghi research cache");
  }
}

export function cleanupExpiredResearchCache(): number {
  try {
    const res = cleanupStmt.run();
    return Number(res.changes);
  } catch (err) {
    log.debug({ err }, "Lỗi dọn dẹp research cache");
    return 0;
  }
}
