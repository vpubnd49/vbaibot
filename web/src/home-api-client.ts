import { request } from "./dashboard-api-client";

/**
 * Client cho Trang chủ / Báo cáo / Nhật ký (src/server/routes/home-routes.ts).
 * Tách khỏi dashboard-api-client.ts (đã quá dài). Kiểu dữ liệu giữ KHỚP TAY với
 * backend: home-summary.ts, report-summary.ts, journal-days.ts, journal-events.ts.
 */

export type LogIncident = { time: number; level: number; scope: string; msg: string; accountId?: string; detail?: string };

export type UpcomingJob = {
  id: string;
  accountId: string;
  accountLabel: string;
  threadId: string;
  threadName: string;
  name: string;
  kind: string;
  scheduleKind: string;
  nextRunAt: string;
};

export type HomeSummary = {
  health: { score: number; level: "ok" | "warn" | "bad"; reasons: string[] };
  accounts: { total: number; enabled: number; online: number };
  messagesToday: number;
  turnsToday: number;
  errors24h: number;
  warnings24h: number;
  upcoming: UpcomingJob[];
  recentIncidents: LogIncident[];
  vps: { cpu?: number; mem?: number; disk?: number };
  generatedAt: number;
};

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

export type ReportSummary = {
  days: number;
  totals: Omit<ReportDay, "day"> & { avgResponseMs: number };
  daily: ReportDay[];
  byAccount: { accountId: string; label: string; user: number; bot: number; turns: number; tokens: number; newContacts: number }[];
  logDaysAvailable: number;
};

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

export type JournalEventType = "canh-bao" | "khach" | "lich" | "he-thong";
export type JournalEvent = {
  time: string;
  type: JournalEventType;
  level: "info" | "warn" | "error";
  title: string;
  detail?: string;
  accountLabel?: string;
};

export type ThreadInsight = {
  threadId: string;
  threadName: string;
  threadType: number;
  totalTurns: number;
  totalTokens: number;
  avgTokensPerTurn: number;
  firstActivity: string;
  lastActivity: string;
  activeDays: number;
};

export type OverallInsight = {
  totalThreads: number;
  totalTurns: number;
  totalTokens: number;
  averageResponseTimeMs: number;
  topThreads: ThreadInsight[];
  turnsByDay: { day: string; count: number }[];
};

export const homeApi = {
  home: () => request<HomeSummary>("/api/home"),
  reports: (days: 7 | 30) => request<ReportSummary>(`/api/reports?days=${days}`),
  sendVpsReport: () => request<{ ok: boolean; message: string }>("/api/reports/send-vps-report", { method: "POST" }),
  insights: (accountId?: string, days = 30) => {
    const q = new URLSearchParams();
    if (accountId && accountId !== "all") q.set("accountId", accountId);
    q.set("days", String(days));
    return request<OverallInsight>(`/api/insights?${q.toString()}`);
  },
  journalDays: (from: string, to: string) =>
    request<{ days: JournalDay[]; logDays: string[]; timezone: string }>(`/api/journal?from=${from}&to=${to}`),
  journalEvents: (date: string) => request<{ date: string; events: JournalEvent[] }>(`/api/journal/events?date=${date}`),
};

