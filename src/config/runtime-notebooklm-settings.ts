import { db } from "../conversation/database.js";

/**
 * Cấu hình tool NotebookLM, sửa từ modal Settings trên trang Tools.
 * Lưu bảng runtime_settings dùng chung (cùng nếp runtime-image-settings).
 *
 * Máy chủ notebooklm-mcp chạy trong Docker trên chính VPS, REST chỉ nghe
 * 127.0.0.1:3000 và KHÔNG có xác thực - vì vậy URL mặc định là localhost và
 * không bao giờ nên trỏ ra ngoài.
 */

export type NotebooklmSettings = {
  enabled: boolean;
  apiUrl: string;
  /** true = mọi người dùng được; false = chỉ Admin (adminUserIds) */
  publicAccess: boolean;
  /** Trần số lần TẠO nội dung Studio mỗi cuộc chat mỗi ngày */
  maxPerDay: number;
  /** Trần toàn bot mỗi ngày - chặn người lạ dùng hết hạn mức Google */
  maxPerDayGlobal: number;
};

const DEFAULTS: NotebooklmSettings = {
  enabled: false,
  apiUrl: "http://127.0.0.1:3000",
  publicAccess: true,
  maxPerDay: 10,
  maxPerDayGlobal: 30,
};

const KEYS = {
  enabled: "notebooklm_enabled",
  apiUrl: "notebooklm_api_url",
  publicAccess: "notebooklm_public",
  maxPerDay: "notebooklm_max_per_day",
  maxPerDayGlobal: "notebooklm_max_per_day_global",
} as const;

const getStmt = db.prepare("SELECT value FROM runtime_settings WHERE key = ?");
const setStmt = db.prepare(`
  INSERT INTO runtime_settings (key, value, updated_at)
  VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

function read(key: string): string | undefined {
  return (getStmt.get(key) as { value: string } | undefined)?.value;
}

function readBool(key: string, fallback: boolean): boolean {
  const v = read(key);
  return v === undefined ? fallback : v === "1" || v === "true";
}

function readInt(key: string, fallback: number): number {
  const n = Number(read(key));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function getNotebooklmSettings(): NotebooklmSettings {
  return {
    enabled: readBool(KEYS.enabled, DEFAULTS.enabled),
    apiUrl: (read(KEYS.apiUrl) || DEFAULTS.apiUrl).replace(/\/+$/, ""),
    publicAccess: readBool(KEYS.publicAccess, DEFAULTS.publicAccess),
    maxPerDay: readInt(KEYS.maxPerDay, DEFAULTS.maxPerDay),
    maxPerDayGlobal: readInt(KEYS.maxPerDayGlobal, DEFAULTS.maxPerDayGlobal),
  };
}

/** Tool vào schema khi Admin đã BẬT và có URL máy chủ */
export function isNotebooklmConfigured(s = getNotebooklmSettings()): boolean {
  return s.enabled && Boolean(s.apiUrl);
}

export function updateNotebooklmSettings(update: Partial<NotebooklmSettings>): NotebooklmSettings {
  for (const [field, key] of Object.entries(KEYS) as [keyof NotebooklmSettings, string][]) {
    const value = update[field];
    if (value === undefined) continue;
    setStmt.run(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  return getNotebooklmSettings();
}
