import { Hono } from "hono";
import { listAccounts } from "../../config/account-store.js";
import { botTimeZone } from "../../config/runtime-tuning-settings.js";
import {
  getDailyUsage,
  getGroupedUsage,
  getTokenSummary,
  type UsageGranularity,
} from "../../conversation/usage-store.js";
import { getFeedbackStats } from "../../conversation/feedback-store.js";
import { db } from "../../conversation/database.js";
import {
  startOfDayUtc,
  startOfMonthUtc,
  startOfWeekUtc,
  todayKey,
} from "../../shared/zone-time.js";
import { getRunningAccounts } from "../../zalo/account-manager.js";
import { getAccountStats, getSystemInfo } from "../overview-stats.js";

const MOT_NGAY_MS = 24 * 60 * 60 * 1000;

const SO_NGAY_CHO_PHEP = [7, 14, 30] as const;
const SO_NGAY_MAC_DINH = 7;

function soNgayTu(raw: string | undefined): number {
  const n = Number(raw);
  return (SO_NGAY_CHO_PHEP as readonly number[]).includes(n) ? n : SO_NGAY_MAC_DINH;
}

const GRANULARITY_CHO_PHEP: UsageGranularity[] = ["day", "week", "month", "year"];

// ===== Response Time Stats =====
const responseTimeStmt = db.prepare(`
  SELECT response_time_ms FROM agent_turns
  WHERE account_id = ? AND response_time_ms > 0
  ORDER BY response_time_ms ASC
`);

function getResponseTimeStats(accountId: string): {
  avg: number; p50: number; p95: number; count: number;
} {
  const rows = responseTimeStmt.all(accountId) as { response_time_ms: number }[];
  if (rows.length === 0) return { avg: 0, p50: 0, p95: 0, count: 0 };

  const times = rows.map((r) => r.response_time_ms);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / times.length);
  const p50 = times[Math.floor(times.length * 0.5)]!;
  const p95 = times[Math.floor(times.length * 0.95)]!;

  return { avg, p50, p95, count: times.length };
}

/**
 * /api/overview - trang tổng quan:
 * - account (DB + trạng thái online)
 * - stats (threads, contacts, messages)
 * - tokenSummary (hôm nay, tuần này, tháng này, năm này, toàn thời gian)
 * - groupedUsage (thống kê theo Ngày / Tuần / Tháng / Năm)
 */
export const overviewRoutes = new Hono().get("/", (c) => {
  const runningById = new Map(getRunningAccounts().map((a) => [a.id, a]));

  const accounts = listAccounts().map((a) => ({
    id: a.id,
    label: a.label,
    enabled: a.enabled,
    online: runningById.has(a.id),
  }));

  const tz = botTimeZone();
  const soNgay = soNgayTu(c.req.query("days"));
  const startOfToday = startOfDayUtc(tz);

  const rawGran = c.req.query("granularity") as UsageGranularity | undefined;
  const granularity: UsageGranularity =
    rawGran && GRANULARITY_CHO_PHEP.includes(rawGran) ? rawGran : "day";

  // Mốc bắt đầu quét tùy theo granularity
  let since: string;
  if (granularity === "day") {
    since = startOfDayUtc(tz, new Date(Date.now() - soNgay * MOT_NGAY_MS));
  } else if (granularity === "week") {
    // 12 tuần qua
    since = startOfWeekUtc(tz, new Date(Date.now() - 12 * 7 * MOT_NGAY_MS));
  } else if (granularity === "month") {
    // 12 tháng qua
    since = startOfMonthUtc(tz, new Date(Date.now() - 365 * MOT_NGAY_MS));
  } else {
    // Năm: toàn bộ lịch sử từ 2000
    since = "2000-01-01T00:00:00.000Z";
  }

  const usageByAccount = accounts.map((a) => ({
    accountId: a.id,
    daily: getDailyUsage(a.id, since, tz),
  }));

  const statsByAccount = accounts.map((a) => ({
    accountId: a.id,
    stats: getAccountStats(a.id, startOfToday),
  }));

  const tokenSummaryByAccount = accounts.map((a) => ({
    accountId: a.id,
    summary: getTokenSummary(a.id, tz),
  }));

  const groupedUsageByAccount = accounts.map((a) => ({
    accountId: a.id,
    items: getGroupedUsage(a.id, granularity, since, tz),
  }));

  // Phase 3A: Response time stats (avg/p50/p95)
  const responseTimeByAccount = accounts.map((a) => ({
    accountId: a.id,
    stats: getResponseTimeStats(a.id),
  }));

  // Phase 3B: User feedback satisfaction score
  const feedbackByAccount = accounts.map((a) => ({
    accountId: a.id,
    stats: getFeedbackStats(a.id),
  }));

  return c.json({
    accounts,
    usageByAccount,
    statsByAccount,
    tokenSummaryByAccount,
    groupedUsageByAccount,
    responseTimeByAccount,
    feedbackByAccount,
    system: getSystemInfo(),
    todayKey: todayKey(tz),
    timezone: tz,
    days: soNgay,
    granularity,
  });
});

