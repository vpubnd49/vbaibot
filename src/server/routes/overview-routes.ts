import { Hono } from "hono";
import { listAccounts } from "../../config/account-store.js";
import { botTimeZone } from "../../config/runtime-tuning-settings.js";
import {
  getDailyUsage,
  getGroupedUsage,
  getTokenSummary,
  type UsageGranularity,
} from "../../conversation/usage-store.js";
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

  return c.json({
    accounts,
    usageByAccount,
    statsByAccount,
    tokenSummaryByAccount,
    groupedUsageByAccount,
    system: getSystemInfo(),
    todayKey: todayKey(tz),
    timezone: tz,
    days: soNgay,
    granularity,
  });
});

