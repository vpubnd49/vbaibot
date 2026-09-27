/**
 * disaster-alert-store.ts
 * Lưu trữ các cảnh báo thiên tai đã phát hiện vào SQLite.
 *
 * Bảng: disaster_alerts
 * - Dedup theo source_url (không lưu trùng cùng bài viết)
 * - Tự xóa cảnh báo cũ hơn 7 ngày
 * - Hỗ trợ truy vấn theo mức cảnh báo, loại, khu vực
 */
import { db } from "../../conversation/database.js";
import { createLogger } from "../../shared/logger.js";
import type { DisasterType } from "./disaster-keywords.js";

const log = createLogger("disaster-alert-store");

// ───── Types ─────────────────────────────────────────────────────────────────

export type AlertLevel = "green" | "yellow" | "orange" | "red";

export type DisasterAlertRow = {
  id: string;
  level: AlertLevel;
  type: DisasterType;
  area: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: string;
  weatherRainMm: number | null;
  weatherSoilMoisture: number | null;
  createdAt: string;
  expiresAt: string;
};

// ───── Schema (gọi 1 lần khi import) ────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS disaster_alerts (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL DEFAULT 'yellow',
    type TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT 'Lâm Đồng',
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    source_name TEXT NOT NULL DEFAULT '',
    published_at TEXT NOT NULL,
    weather_rain_mm REAL,
    weather_soil_moisture REAL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_disaster_alerts_level
    ON disaster_alerts (level, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_disaster_alerts_type
    ON disaster_alerts (type, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_disaster_alerts_area
    ON disaster_alerts (area, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_disaster_alerts_source
    ON disaster_alerts (source_url);
  CREATE INDEX IF NOT EXISTS idx_disaster_alerts_expires
    ON disaster_alerts (expires_at);
`);

// ───── Prepared Statements ──────────────────────────────────────────────────

const upsertStmt = db.prepare(`
  INSERT INTO disaster_alerts (id, level, type, area, title, summary, source_url, source_name, published_at, weather_rain_mm, weather_soil_moisture, expires_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    level = CASE WHEN excluded.level > disaster_alerts.level THEN excluded.level ELSE disaster_alerts.level END,
    summary = excluded.summary,
    weather_rain_mm = COALESCE(excluded.weather_rain_mm, disaster_alerts.weather_rain_mm),
    weather_soil_moisture = COALESCE(excluded.weather_soil_moisture, disaster_alerts.weather_soil_moisture)
`);

const existsBySourceUrlStmt = db.prepare(`
  SELECT 1 FROM disaster_alerts WHERE source_url = ? LIMIT 1
`);

const listActiveStmt = db.prepare(`
  SELECT * FROM disaster_alerts
  WHERE expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ORDER BY
    CASE level WHEN 'red' THEN 0 WHEN 'orange' THEN 1 WHEN 'yellow' THEN 2 ELSE 3 END,
    created_at DESC
  LIMIT ?
`);

const listByLevelStmt = db.prepare(`
  SELECT * FROM disaster_alerts
  WHERE level = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ORDER BY created_at DESC
  LIMIT ?
`);

const listByAreaStmt = db.prepare(`
  SELECT * FROM disaster_alerts
  WHERE area LIKE ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ORDER BY created_at DESC
  LIMIT ?
`);

const highestLevelStmt = db.prepare(`
  SELECT level FROM disaster_alerts
  WHERE expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ORDER BY
    CASE level WHEN 'red' THEN 0 WHEN 'orange' THEN 1 WHEN 'yellow' THEN 2 ELSE 3 END
  LIMIT 1
`);

const countActiveStmt = db.prepare(`
  SELECT COUNT(*) as count FROM disaster_alerts
  WHERE expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
`);

const cleanupExpiredStmt = db.prepare(`
  DELETE FROM disaster_alerts WHERE expires_at < datetime('now', '-7 days')
`);

// ───── Raw row type ─────────────────────────────────────────────────────────

type RawRow = {
  id: string;
  level: string;
  type: string;
  area: string;
  title: string;
  summary: string;
  source_url: string;
  source_name: string;
  published_at: string;
  weather_rain_mm: number | null;
  weather_soil_moisture: number | null;
  created_at: string;
  expires_at: string;
};

function toAlertRow(row: RawRow): DisasterAlertRow {
  return {
    id: row.id,
    level: row.level as AlertLevel,
    type: row.type as DisasterType,
    area: row.area,
    title: row.title,
    summary: row.summary,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    publishedAt: row.published_at,
    weatherRainMm: row.weather_rain_mm,
    weatherSoilMoisture: row.weather_soil_moisture,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

// ───── CRUD ─────────────────────────────────────────────────────────────────

/**
 * Lưu hoặc cập nhật 1 cảnh báo thiên tai.
 * Dedup theo `id` (hash từ source_url + type).
 */
export function upsertDisasterAlert(alert: {
  id: string;
  level: AlertLevel;
  type: DisasterType;
  area: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: string;
  weatherRainMm?: number | null;
  weatherSoilMoisture?: number | null;
  expiresAt: string;
}): void {
  upsertStmt.run(
    alert.id,
    alert.level,
    alert.type,
    alert.area,
    alert.title,
    alert.summary,
    alert.sourceUrl,
    alert.sourceName,
    alert.publishedAt,
    alert.weatherRainMm ?? null,
    alert.weatherSoilMoisture ?? null,
    alert.expiresAt,
  );
}

/**
 * Kiểm tra xem bài viết với URL đã có trong store chưa (dedup).
 */
export function alertExistsBySourceUrl(url: string): boolean {
  return existsBySourceUrlStmt.get(url) !== undefined;
}

/**
 * Lấy danh sách cảnh báo đang còn hiệu lực, sắp theo mức nghiêm trọng.
 */
export function listActiveAlerts(limit = 20): DisasterAlertRow[] {
  return (listActiveStmt.all(limit) as RawRow[]).map(toAlertRow);
}

/**
 * Lấy cảnh báo theo mức cụ thể.
 */
export function listAlertsByLevel(level: AlertLevel, limit = 10): DisasterAlertRow[] {
  return (listByLevelStmt.all(level, limit) as RawRow[]).map(toAlertRow);
}

/**
 * Lấy cảnh báo theo khu vực (LIKE match).
 */
export function listAlertsByArea(area: string, limit = 10): DisasterAlertRow[] {
  return (listByAreaStmt.all(`%${area}%`, limit) as RawRow[]).map(toAlertRow);
}

/**
 * Mức cảnh báo cao nhất hiện tại (dùng để quyết định broadcast).
 */
export function getHighestAlertLevel(): AlertLevel {
  const row = highestLevelStmt.get() as { level: string } | undefined;
  return (row?.level as AlertLevel) ?? "green";
}

/**
 * Số cảnh báo đang hoạt động.
 */
export function countActiveAlerts(): number {
  const row = countActiveStmt.get() as { count: number };
  return row.count;
}

/**
 * Xóa cảnh báo đã hết hạn hơn 7 ngày.
 */
export function cleanupExpiredAlerts(): number {
  const result = cleanupExpiredStmt.run();
  const deleted = Number(result.changes);
  if (deleted > 0) {
    log.info({ deleted }, "Đã xóa cảnh báo thiên tai cũ hơn 7 ngày");
  }
  return deleted;
}
