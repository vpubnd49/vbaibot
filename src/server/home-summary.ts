import { listAccounts } from "../config/account-store.js";
import { botTimeZone } from "../config/runtime-tuning-settings.js";
import { db } from "../conversation/database.js";
import { listIncidents, type LogIncident } from "../shared/log-incidents.js";
import { logDir } from "../shared/logger.js";
import { startOfDayUtc } from "../shared/zone-time.js";
import { getRunningAccounts } from "../zalo/account-manager.js";
import { tinhSucKhoe, type HealthResult } from "./health-score.js";
import { getSystemInfo } from "./overview-stats.js";
import { getVpsMetrics } from "./vps-monitor-service.js";

/** Dữ liệu Trang chủ: sức khỏe, 4 ô số, việc sắp tới, sự cố gần đây */

const MOT_NGAY_MS = 86_400_000;

const messagesSinceStmt = db.prepare(`SELECT COUNT(*) AS n FROM messages WHERE role = 'user' AND created_at >= ?`);
const turnsSinceStmt = db.prepare(`SELECT COUNT(*) AS n FROM agent_turns WHERE created_at >= ?`);
const upcomingStmt = db.prepare(`
  SELECT j.id, j.account_id, j.thread_id, j.name, j.kind, j.schedule_kind, j.next_run_at,
         t.display_name AS thread_name
  FROM scheduled_jobs j
  LEFT JOIN threads t ON t.account_id = j.account_id AND t.thread_id = j.thread_id
  WHERE j.enabled = 1 AND j.next_run_at IS NOT NULL AND j.next_run_at >= ?
  ORDER BY j.next_run_at ASC
  LIMIT ?
`);

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
  health: HealthResult;
  accounts: { total: number; enabled: number; online: number };
  messagesToday: number;
  turnsToday: number;
  errors24h: number;
  warnings24h: number;
  upcoming: UpcomingJob[];
  /** 10 lỗi mới nhất cho chuông thông báo */
  recentIncidents: LogIncident[];
  vps: { cpu?: number; mem?: number; disk?: number };
  generatedAt: number;
};

// getVpsMetrics gọi systemctl/ps - cache ngắn để trang tự làm mới không đè máy
let vpsCache: { at: number; value: HomeSummary["vps"] } | null = null;
async function layVps(): Promise<HomeSummary["vps"]> {
  if (vpsCache && Date.now() - vpsCache.at < 30_000) return vpsCache.value;
  try {
    const m = await getVpsMetrics();
    const value = { cpu: m.cpu.usagePercent, mem: m.memory.usagePercent, disk: m.disk.usagePercent };
    vpsCache = { at: Date.now(), value };
    return value;
  } catch {
    return {};
  }
}

export async function getHomeSummary(): Promise<HomeSummary> {
  const accounts = listAccounts();
  const running = new Set(getRunningAccounts().map((a) => a.id));
  const enabled = accounts.filter((a) => a.enabled);
  const online = enabled.filter((a) => running.has(a.id)).length;
  const labelOf = new Map(accounts.map((a) => [a.id, a.label]));

  const since24h = Date.now() - MOT_NGAY_MS;
  const incidents = listIncidents(logDir, since24h);
  const errors = incidents.filter((i) => i.level >= 50);
  const startToday = startOfDayUtc(botTimeZone());

  const vps = await layVps();
  const health = tinhSucKhoe({
    accountsEnabled: enabled.length,
    accountsOnline: online,
    llmConfigured: getSystemInfo().llm.daCauHinh,
    errors24h: errors.length,
    cpuPercent: vps.cpu,
    memPercent: vps.mem,
    diskPercent: vps.disk,
  });

  type JobRow = {
    id: string; account_id: string; thread_id: string; name: string; kind: string;
    schedule_kind: string; next_run_at: string; thread_name: string | null;
  };
  const rows = upcomingStmt.all(new Date().toISOString(), 6) as unknown as JobRow[];

  return {
    health,
    accounts: { total: accounts.length, enabled: enabled.length, online },
    messagesToday: (messagesSinceStmt.get(startToday) as { n: number }).n,
    turnsToday: (turnsSinceStmt.get(startToday) as { n: number }).n,
    errors24h: errors.length,
    warnings24h: incidents.length - errors.length,
    upcoming: rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      accountLabel: labelOf.get(r.account_id) ?? r.account_id,
      threadId: r.thread_id,
      threadName: r.thread_name || r.thread_id,
      name: r.name,
      kind: r.kind,
      scheduleKind: r.schedule_kind,
      nextRunAt: r.next_run_at,
    })),
    recentIncidents: errors.slice(0, 10),
    vps,
    generatedAt: Date.now(),
  };
}
