import fs from "node:fs";
import path from "node:path";
import { tachDong } from "./log-file-lines.js";

/**
 * Gom các dòng log mức WARN trở lên (sự cố) từ file log ndjson của pino.
 *
 * Phục vụ Trang chủ (lỗi 24 giờ), Báo cáo (cảnh báo theo ngày) và Nhật ký.
 * Khác `read-log-file.ts` (phân trang cho trang Logs): ở đây cần MỌI sự cố trong
 * một khoảng thời gian, nên:
 * - Lọc thô bằng chuỗi `"level":4x/5x/6x` TRƯỚC khi JSON.parse - log info chiếm
 *   >95% dòng, parse hết thì mỗi lần vào trang tốn cả giây.
 * - Cache theo file (tên + kích thước + mtime): file ngày cũ không đổi nên chỉ
 *   đọc một lần; file hôm nay đọc lại khi có dòng mới.
 *
 * Module THUẦN: nhận thư mục qua tham số, không đụng env.
 */

export type LogIncident = {
  time: number;
  /** 40 warn, 50 error, 60 fatal (quy ước pino) */
  level: number;
  scope: string;
  msg: string;
  accountId?: string;
  /** Thông điệp lỗi gốc nếu có (err.message) - đã cắt ngắn */
  detail?: string;
};

/** Một ngày bất thường không được kéo sập bộ nhớ: giữ tối đa chừng này sự cố/file */
const MAX_PER_FILE = 5000;
const DAU_HIEU_SU_CO = /"level":(4\d|5\d|6\d)[,}]/;

type CacheEntry = { key: string; items: LogIncident[] };
const cache = new Map<string, CacheEntry>();

function rutGon(o: Record<string, unknown>): Pick<LogIncident, "accountId" | "detail"> {
  const accountId = typeof o.accountId === "string" ? o.accountId : undefined;
  const err = o.err as { message?: unknown } | undefined;
  const raw = typeof err?.message === "string" ? err.message : typeof o.error === "string" ? o.error : "";
  return { accountId, detail: raw ? raw.slice(0, 200) : undefined };
}

function docFile(filePath: string): LogIncident[] {
  let st: fs.Stats;
  try {
    st = fs.statSync(filePath);
  } catch {
    return [];
  }
  const key = `${st.size}:${st.mtimeMs}`;
  const hit = cache.get(filePath);
  if (hit?.key === key) return hit.items;

  const items: LogIncident[] = [];
  let text = "";
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  for (const raw of text.split("\n")) {
    if (!DAU_HIEU_SU_CO.test(raw)) continue;
    const e = tachDong(raw);
    if (!e || e.level < 40) continue;
    items.push({ time: e.time, level: e.level, scope: e.scope, msg: e.msg, ...rutGon(e.fields) });
  }
  const kept = items.length > MAX_PER_FILE ? items.slice(-MAX_PER_FILE) : items;
  cache.set(filePath, { key, items: kept });
  return kept;
}

/**
 * Sự cố trong [sinceMs, untilMs). Tên file pino-roll dạng `bot.<YYYY-MM-DD>.<n>.log`
 * nên bỏ qua được file nằm ngoài khoảng mà không cần mở (lệch múi giờ ±1 ngày).
 */
export function listIncidents(dir: string, sinceMs: number, untilMs = Date.now()): LogIncident[] {
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => /^bot\..*\.log$/.test(f));
  } catch {
    return [];
  }
  const ngayTu = new Date(sinceMs - 86_400_000).toISOString().slice(0, 10);
  const ngayDen = new Date(untilMs + 86_400_000).toISOString().slice(0, 10);
  const out: LogIncident[] = [];
  for (const f of files) {
    const day = /(\d{4}-\d{2}-\d{2})/.exec(f)?.[1];
    if (day && (day < ngayTu || day > ngayDen)) continue;
    for (const it of docFile(path.join(dir, f))) {
      if (it.time >= sinceMs && it.time < untilMs) out.push(it);
    }
  }
  return out.sort((a, b) => b.time - a.time);
}

/** Ngày (YYYY-MM-DD, theo tên file) đang còn file log - cho biết số liệu sự cố phủ bao xa */
export function listLogDays(dir: string): string[] {
  try {
    const days = fs.readdirSync(dir).map((f) => /^bot\.(\d{4}-\d{2}-\d{2})/.exec(f)?.[1]).filter(Boolean);
    return [...new Set(days as string[])].sort();
  } catch {
    return [];
  }
}

/** Chỉ dành cho test */
export function clearIncidentCache(): void {
  cache.clear();
}
