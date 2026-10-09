import { listAccounts } from "../config/account-store.js";
import { botTimeZone } from "../config/runtime-tuning-settings.js";
import { db } from "../conversation/database.js";
import "../realtime/disaster/disaster-alert-store.js";
import { listIncidents } from "../shared/log-incidents.js";
import { logDir } from "../shared/logger.js";
import { rangeUtc } from "./journal-days.js";

/**
 * Nhật ký - CHI TIẾT một ngày: danh sách sự kiện đã gom cho người đọc.
 * Cảnh báo (warn) gom theo scope+msg kèm số lần, không đổ hàng trăm dòng giống
 * nhau; lỗi (error) liệt kê riêng nhưng có trần. Tin nhắn chỉ tóm tắt theo
 * account (nội dung chat không đưa vào nhật ký).
 */

export type JournalEventType = "canh-bao" | "khach" | "lich" | "he-thong";
export type JournalEvent = {
  time: string;
  type: JournalEventType;
  level: "info" | "warn" | "error";
  title: string;
  detail?: string;
  accountLabel?: string;
};

const MAX_ERRORS = 60;
const MAX_WARN_GROUPS = 40;

const q = (sql: string) => db.prepare(sql);
const msgByAcc = q(`
  SELECT account_id, SUM(role = 'user') AS u, SUM(role = 'assistant') AS b, MIN(created_at) AS t
  FROM messages WHERE created_at >= ? AND created_at < ? GROUP BY account_id`);
const contacts = q(`
  SELECT account_id, display_name, first_seen AS t FROM contacts
  WHERE first_seen >= ? AND first_seen < ? ORDER BY first_seen`);
const runs = q(`
  SELECT r.started_at AS t, r.status, r.detail, j.name, j.account_id
  FROM scheduled_job_runs r LEFT JOIN scheduled_jobs j ON j.id = r.job_id
  WHERE r.started_at >= ? AND r.started_at < ? ORDER BY r.started_at`);
const audits = q(`SELECT created_at AS t, actor, action, account_id FROM audit_logs WHERE created_at >= ? AND created_at < ?`);
const broadcasts = q(`
  SELECT created_at AS t, account_id, thread_name, status, error FROM broadcast_logs
  WHERE created_at >= ? AND created_at < ?`);
const disasters = q(`SELECT created_at AS t, level, title, area FROM disaster_alerts WHERE created_at >= ? AND created_at < ?`);

const NHAN_TRANG_THAI: Record<string, string> = {
  ok: "đã chạy", silent: "chạy (không gửi)", skipped: "bỏ qua", error: "lỗi", interrupted: "bị gián đoạn", running: "đang chạy",
};

export function getJournalEvents(date: string): JournalEvent[] {
  const tz = botTimeZone();
  const { start, end } = rangeUtc(date, date, tz);
  const label = new Map(listAccounts().map((a) => [a.id, a.label]));
  const lbl = (id: string | null | undefined) => (id ? label.get(id) ?? id : undefined);
  const out: JournalEvent[] = [];

  type MsgRow = { account_id: string; u: number; b: number; t: string };
  for (const r of msgByAcc.all(start, end) as MsgRow[]) {
    out.push({ time: r.t, type: "khach", level: "info", title: `${r.u} tin khách · ${r.b} bot trả lời`, accountLabel: lbl(r.account_id) });
  }

  const moiTheoAcc = new Map<string, { t: string; names: string[] }>();
  for (const c of contacts.all(start, end) as { account_id: string; display_name: string; t: string }[]) {
    const g = moiTheoAcc.get(c.account_id) ?? { t: c.t, names: [] };
    g.names.push(c.display_name || "(chưa rõ tên)");
    moiTheoAcc.set(c.account_id, g);
  }
  for (const [acc, g] of moiTheoAcc) {
    const more = g.names.length > 5 ? ` và ${g.names.length - 5} người khác` : "";
    out.push({ time: g.t, type: "khach", level: "info", title: `${g.names.length} liên hệ mới`, detail: g.names.slice(0, 5).join(", ") + more, accountLabel: lbl(acc) });
  }

  type RunRow = { t: string; status: string; detail: string; name: string | null; account_id: string | null };
  for (const r of runs.all(start, end) as RunRow[]) {
    const loi = r.status === "error" || r.status === "interrupted";
    out.push({
      time: r.t, type: "lich", level: loi ? "error" : "info",
      title: `Lịch hẹn "${r.name ?? "đã xóa"}" ${NHAN_TRANG_THAI[r.status] ?? r.status}`,
      detail: loi && r.detail ? r.detail.slice(0, 200) : undefined, accountLabel: lbl(r.account_id),
    });
  }

  for (const a of audits.all(start, end) as { t: string; actor: string; action: string; account_id: string }[]) {
    out.push({ time: a.t, type: "he-thong", level: "info", title: `Thay đổi cấu hình (${a.action})`, detail: `Bởi ${a.actor}`, accountLabel: lbl(a.account_id) });
  }
  type BcRow = { t: string; account_id: string; thread_name: string; status: string; error: string | null };
  for (const b of broadcasts.all(start, end) as BcRow[]) {
    out.push({ time: b.t, type: "he-thong", level: b.error ? "warn" : "info", title: `Gửi thông báo tới ${b.thread_name} (${b.status})`, detail: b.error ?? undefined, accountLabel: lbl(b.account_id) });
  }
  for (const d of disasters.all(start, end) as { t: string; level: string; title: string; area: string }[]) {
    out.push({ time: d.t, type: "canh-bao", level: d.level === "red" ? "error" : "warn", title: `Cảnh báo thiên tai: ${d.title}`, detail: d.area });
  }

  const incidents = listIncidents(logDir, Date.parse(start), Date.parse(end));
  for (const e of incidents.filter((i) => i.level >= 50).slice(0, MAX_ERRORS)) {
    out.push({ time: new Date(e.time).toISOString(), type: "canh-bao", level: "error", title: e.msg || "Lỗi không rõ", detail: [e.scope, e.detail].filter(Boolean).join(" · "), accountLabel: lbl(e.accountId) });
  }
  const nhom = new Map<string, { time: number; n: number; scope: string; msg: string }>();
  for (const w of incidents.filter((i) => i.level < 50)) {
    const k = `${w.scope}|${w.msg}`;
    const g = nhom.get(k) ?? { time: w.time, n: 0, scope: w.scope, msg: w.msg };
    g.n++;
    nhom.set(k, g);
  }
  for (const g of [...nhom.values()].sort((a, b) => b.n - a.n).slice(0, MAX_WARN_GROUPS)) {
    out.push({ time: new Date(g.time).toISOString(), type: "canh-bao", level: "warn", title: g.n > 1 ? `${g.msg} (×${g.n})` : g.msg, detail: g.scope });
  }

  return out.sort((a, b) => b.time.localeCompare(a.time));
}
