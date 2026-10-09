import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Hono } from "hono";
import { cleanupTestEnv, setupTestEnv } from "../../shared/test-env-setup.js";

/** /api/home, /api/reports, /api/journal - số liệu đọc từ DB test có dữ liệu mồi */

const PASSWORD = "mat-khau-home-123";
let dataDir: string;
let app: Hono;
let cookie: string;
let database: typeof import("../../conversation/database.js");

before(async () => {
  dataDir = setupTestEnv({ DASHBOARD_PASSWORD: PASSWORD, BOT_TIMEZONE: "Asia/Ho_Chi_Minh" });
  const { buildDashboardApp } = await import("../dashboard-server.js");
  app = buildDashboardApp();
  database = await import("../../conversation/database.js");
  const login = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password: PASSWORD }),
    headers: { "content-type": "application/json" },
  });
  cookie = login.headers.get("set-cookie")!.split(";")[0]!;

  const { db } = database;
  const now = new Date().toISOString();
  const insMsg = db.prepare("INSERT INTO messages (account_id, thread_id, role, content, created_at) VALUES (?, 't1', ?, 'x', ?)");
  insMsg.run("acc-a", "user", now);
  insMsg.run("acc-a", "user", now);
  insMsg.run("acc-a", "assistant", now);
  db.prepare("INSERT INTO contacts (account_id, user_id, display_name, first_seen) VALUES ('acc-a', 'u1', 'Lan', ?)").run(now);
  db.prepare("INSERT INTO agent_turns (account_id, thread_id, total_tokens, created_at) VALUES ('acc-a', 't1', 1234, ?)").run(now);
  const future = new Date(Date.now() + 3_600_000).toISOString();
  db.prepare(
    `INSERT INTO scheduled_jobs (id, account_id, thread_id, thread_type, name, kind, payload, schedule_kind, run_at, next_run_at)
     VALUES ('j1', 'acc-a', 't1', 0, 'Nhắc họp', 'message', 'hi', 'once', ?, ?)`,
  ).run(future, future);
});

after(() => {
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

const get = async <T>(path: string) => {
  const r = await app.request(path, { headers: { cookie } });
  return { status: r.status, body: (await r.json()) as T };
};

describe("home-routes", () => {
  it("cần đăng nhập", async () => {
    assert.equal((await app.request("/api/home")).status, 401);
  });

  it("/api/home: tin khách hôm nay, lượt AI, việc sắp tới, điểm sức khỏe", async () => {
    const r = await get<{
      messagesToday: number; turnsToday: number; upcoming: { name: string }[];
      health: { score: number }; errors24h: number;
    }>("/api/home");
    assert.equal(r.status, 200);
    assert.equal(r.body.messagesToday, 2, "chỉ đếm tin của khách");
    assert.equal(r.body.turnsToday, 1);
    assert.deepEqual(r.body.upcoming.map((j) => j.name), ["Nhắc họp"]);
    assert.ok(r.body.health.score >= 0 && r.body.health.score <= 100);
    assert.equal(r.body.errors24h, 0, "test tắt file log nên không có sự cố");
  });

  it("/api/reports: tổng và chuỗi ngày đủ độ dài, days lạ kẹp về 7", async () => {
    const r = await get<{ days: number; daily: unknown[]; totals: { user: number; bot: number; tokens: number; newContacts: number } }>("/api/reports?days=30");
    assert.equal(r.body.days, 30);
    assert.equal(r.body.daily.length, 30);
    assert.deepEqual(
      { u: r.body.totals.user, b: r.body.totals.bot, t: r.body.totals.tokens, c: r.body.totals.newContacts },
      { u: 2, b: 1, t: 1234, c: 1 },
    );
    assert.equal((await get<{ days: number }>("/api/reports?days=9999")).body.days, 7);
  });

  it("/api/journal: sai tham số trả 400, khoảng ngày bị chặn trần", async () => {
    assert.equal((await get("/api/journal")).status, 400);
    assert.equal((await get("/api/journal?from=2026-13-40")).status, 400);
    const r = await get<{ days: unknown[] }>("/api/journal?from=2026-01-01&to=2027-12-31");
    assert.ok(r.body.days.length <= 93);
  });

  it("/api/journal/events: có sự kiện tin nhắn + liên hệ mới của hôm nay", async () => {
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    const days = await get<{ days: { day: string; userMsgs: number; newContacts: number }[] }>(`/api/journal?from=${today}&to=${today}`);
    assert.deepEqual(days.body.days.map((d) => [d.userMsgs, d.newContacts]), [[2, 1]]);
    const ev = await get<{ events: { type: string; title: string }[] }>(`/api/journal/events?date=${today}`);
    const titles = ev.body.events.map((e) => e.title);
    assert.ok(titles.includes("2 tin khách · 1 bot trả lời"), titles.join(" | "));
    assert.ok(titles.includes("1 liên hệ mới"));
  });
});
