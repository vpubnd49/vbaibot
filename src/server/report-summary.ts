import { listAccounts } from "../config/account-store.js";
import { botTimeZone } from "../config/runtime-tuning-settings.js";
import { db } from "../conversation/database.js";
import { listIncidents, listLogDays } from "../shared/log-incidents.js";
import { logDir } from "../shared/logger.js";
import { dayKeyOf, startOfDayUtc } from "../shared/zone-time.js";

/**
 * Trang Báo cáo 7/30 ngày: tin khách vs bot theo ngày, lượt AI, token, liên hệ
 * mới, cảnh báo, thời gian phản hồi, bảng theo account.
 * Gom ngày bằng `dayKeyOf` (theo BOT_TIMEZONE) như usage-store - không cắt ngày
 * theo UTC trong SQL (lệch 7 tiếng với giờ VN).
 */

const MOT_NGAY_MS = 86_400_000;
export const REPORT_DAYS = [7, 30] as const;

const msgStmt = db.prepare(`SELECT account_id, role, created_at FROM messages WHERE created_at >= ?`);
const turnStmt = db.prepare(
  `SELECT account_id, total_tokens, response_time_ms, created_at FROM agent_turns WHERE created_at >= ?`,
);
const contactStmt = db.prepare(`SELECT account_id, first_seen FROM contacts WHERE first_seen >= ?`);

export type ReportDay = {
  day: string;
  user: number;
  bot: number;
  turns: number;
  tokens: number;
  newContacts: number;
  errors: number;
  warnings: number;
};

export type ReportAccount = {
  accountId: string;
  label: string;
  user: number;
  bot: number;
  turns: number;
  tokens: number;
  newContacts: number;
};

export type ReportSummary = {
  days: number;
  totals: Omit<ReportDay, "day"> & { avgResponseMs: number };
  daily: ReportDay[];
  byAccount: ReportAccount[];
  /** Số ngày có file log - cảnh báo chỉ đếm được trong khoảng này */
  logDaysAvailable: number;
};

export function getReport(daysRaw: number): ReportSummary {
  const days = (REPORT_DAYS as readonly number[]).includes(daysRaw) ? daysRaw : 7;
  const tz = botTimeZone();
  const now = Date.now();
  const since = startOfDayUtc(tz, new Date(now - (days - 1) * MOT_NGAY_MS));

  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) dayKeys.push(dayKeyOf(new Date(now - i * MOT_NGAY_MS).toISOString(), tz));
  const daily = new Map<string, ReportDay>(
    dayKeys.map((d) => [d, { day: d, user: 0, bot: 0, turns: 0, tokens: 0, newContacts: 0, errors: 0, warnings: 0 }]),
  );

  const accounts = listAccounts();
  const byAcc = new Map<string, ReportAccount>(
    accounts.map((a) => [a.id, { accountId: a.id, label: a.label, user: 0, bot: 0, turns: 0, tokens: 0, newContacts: 0 }]),
  );
  const acc = (id: string): ReportAccount => {
    let r = byAcc.get(id);
    if (!r) byAcc.set(id, (r = { accountId: id, label: id, user: 0, bot: 0, turns: 0, tokens: 0, newContacts: 0 }));
    return r;
  };

  for (const m of msgStmt.all(since) as { account_id: string; role: string; created_at: string }[]) {
    const d = daily.get(dayKeyOf(m.created_at, tz));
    const key = m.role === "user" ? "user" : "bot";
    if (d) d[key]++;
    acc(m.account_id)[key]++;
  }

  let rtSum = 0;
  let rtCount = 0;
  type TurnRow = { account_id: string; total_tokens: number; response_time_ms: number | null; created_at: string };
  for (const t of turnStmt.all(since) as TurnRow[]) {
    const d = daily.get(dayKeyOf(t.created_at, tz));
    if (d) {
      d.turns++;
      d.tokens += t.total_tokens;
    }
    const a = acc(t.account_id);
    a.turns++;
    a.tokens += t.total_tokens;
    if (t.response_time_ms && t.response_time_ms > 0) {
      rtSum += t.response_time_ms;
      rtCount++;
    }
  }

  for (const c of contactStmt.all(since) as { account_id: string; first_seen: string }[]) {
    const d = daily.get(dayKeyOf(c.first_seen, tz));
    if (d) d.newContacts++;
    acc(c.account_id).newContacts++;
  }

  for (const i of listIncidents(logDir, Date.parse(since), now)) {
    const d = daily.get(dayKeyOf(new Date(i.time).toISOString(), tz));
    if (!d) continue;
    if (i.level >= 50) d.errors++;
    else d.warnings++;
  }
  const firstDay = dayKeys[0]!;
  const logDaysAvailable = listLogDays(logDir).filter((d) => d >= firstDay).length;

  const list = [...daily.values()];
  const sum = (k: keyof Omit<ReportDay, "day">) => list.reduce((s, d) => s + d[k], 0);
  return {
    days,
    totals: {
      user: sum("user"),
      bot: sum("bot"),
      turns: sum("turns"),
      tokens: sum("tokens"),
      newContacts: sum("newContacts"),
      errors: sum("errors"),
      warnings: sum("warnings"),
      avgResponseMs: rtCount ? Math.round(rtSum / rtCount) : 0,
    },
    daily: list,
    byAccount: [...byAcc.values()].sort((a, b) => b.user + b.bot - (a.user + a.bot)),
    logDaysAvailable,
  };
}
