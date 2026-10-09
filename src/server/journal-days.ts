import { botTimeZone } from "../config/runtime-tuning-settings.js";
import { db } from "../conversation/database.js";
// Bảng disaster_alerts do module này tạo - import trước khi prepare câu truy vấn
import "../realtime/disaster/disaster-alert-store.js";
import { listIncidents, listLogDays } from "../shared/log-incidents.js";
import { logDir } from "../shared/logger.js";
import { dayKeyOf, zonedWallClockToUtc } from "../shared/zone-time.js";

/**
 * Nhật ký dạng lịch - phần TÓM TẮT theo ngày (để vẽ chấm vàng/đỏ trên lịch).
 * Chi tiết từng ngày nằm ở `journal-events.ts`.
 *
 * Nguồn: DB (tin nhắn, liên hệ mới, lượt lịch hẹn, thay đổi cấu hình, gửi thông
 * báo, cảnh báo thiên tai) + file log (warn/error). DB giữ lâu; log chỉ còn theo
 * LOG_FILE_KEEP_DAYS nên `logDays` cho UI biết ngày nào có số liệu sự cố.
 */

export const JOURNAL_MAX_DAYS = 92;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(s: string | undefined): s is string {
  return !!s && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** [start, end) UTC ISO của khoảng ngày theo BOT_TIMEZONE (to tính trọn ngày) */
export function rangeUtc(from: string, to: string, tz: string): { start: string; end: string } {
  return {
    start: zonedWallClockToUtc(from, "00:00", tz) ?? `${from}T00:00:00.000Z`,
    end: zonedWallClockToUtc(addDays(to, 1), "00:00", tz) ?? `${addDays(to, 1)}T00:00:00.000Z`,
  };
}

export type JournalDay = {
  day: string;
  userMsgs: number;
  newContacts: number;
  scheduleRuns: number;
  scheduleErrors: number;
  systemEvents: number;
  warnings: number;
  errors: number;
};

const q = (sql: string) => db.prepare(sql);
const msgStmt = q(`SELECT created_at AS t FROM messages WHERE role = 'user' AND created_at >= ? AND created_at < ?`);
const contactStmt = q(`SELECT first_seen AS t FROM contacts WHERE first_seen >= ? AND first_seen < ?`);
const runStmt = q(`SELECT started_at AS t, status FROM scheduled_job_runs WHERE started_at >= ? AND started_at < ?`);
const auditStmt = q(`SELECT created_at AS t FROM audit_logs WHERE created_at >= ? AND created_at < ?`);
const bcStmt = q(`SELECT created_at AS t FROM broadcast_logs WHERE created_at >= ? AND created_at < ?`);
const disasterStmt = q(`SELECT created_at AS t FROM disaster_alerts WHERE created_at >= ? AND created_at < ?`);

export type JournalDaysResult = { days: JournalDay[]; logDays: string[]; timezone: string };

export function getJournalDays(fromRaw: string, toRaw: string): JournalDaysResult {
  const tz = botTimeZone();
  const from = fromRaw;
  let to = toRaw < fromRaw ? fromRaw : toRaw;
  if (addDays(from, JOURNAL_MAX_DAYS) < to) to = addDays(from, JOURNAL_MAX_DAYS);
  const { start, end } = rangeUtc(from, to, tz);

  const map = new Map<string, JournalDay>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    map.set(d, { day: d, userMsgs: 0, newContacts: 0, scheduleRuns: 0, scheduleErrors: 0, systemEvents: 0, warnings: 0, errors: 0 });
  }
  const bump = (iso: string, f: (d: JournalDay) => void) => {
    const d = map.get(dayKeyOf(iso, tz));
    if (d) f(d);
  };

  for (const r of msgStmt.all(start, end) as { t: string }[]) bump(r.t, (d) => d.userMsgs++);
  for (const r of contactStmt.all(start, end) as { t: string }[]) bump(r.t, (d) => d.newContacts++);
  for (const r of runStmt.all(start, end) as { t: string; status: string }[]) {
    bump(r.t, (d) => {
      d.scheduleRuns++;
      if (r.status === "error" || r.status === "interrupted") d.scheduleErrors++;
    });
  }
  for (const stmt of [auditStmt, bcStmt]) {
    for (const r of stmt.all(start, end) as { t: string }[]) bump(r.t, (d) => d.systemEvents++);
  }
  for (const r of disasterStmt.all(start, end) as { t: string }[]) bump(r.t, (d) => d.warnings++);
  for (const i of listIncidents(logDir, Date.parse(start), Date.parse(end))) {
    bump(new Date(i.time).toISOString(), (d) => (i.level >= 50 ? d.errors++ : d.warnings++));
  }

  const logDays = listLogDays(logDir).filter((d) => d >= from && d <= to);
  return { days: [...map.values()], logDays, timezone: tz };
}
