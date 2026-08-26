import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Hono } from "hono";
import { cleanupTestEnv, setupTestEnv } from "../../shared/test-env-setup.js";

const PASSWORD = "mat-khau-broadcast-123";

let dataDir: string;
let app: Hono;
let cookie: string;
let database: typeof import("../../conversation/database.js");

before(async () => {
  dataDir = setupTestEnv({ DASHBOARD_PASSWORD: PASSWORD });
  const { buildDashboardApp } = await import("../dashboard-server.js");
  app = buildDashboardApp();
  database = await import("../../conversation/database.js");

  // Tạo dữ liệu thread mẫu trong SQLite
  database.db.exec(`
    INSERT OR REPLACE INTO threads (account_id, thread_id, thread_type, display_name, bot_enabled, message_count, last_message_at)
    VALUES
      ('acc-test', 'group-1', 1, 'Nhóm Kế toán & Tài chính', 1, 15, '2026-08-26T10:00:00.000Z'),
      ('acc-test', 'group-2', 1, 'Nhóm Lãnh đạo UBND', 0, 5, '2026-08-20T10:00:00.000Z'),
      ('acc-test', 'user-1', 0, 'Nguyễn Văn A', 1, 25, '2026-08-26T11:00:00.000Z');
  `);

  const login = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password: PASSWORD }),
    headers: { "content-type": "application/json" },
  });
  cookie = login.headers.get("set-cookie")!.split(";")[0]!;
});

after(() => {
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

describe("Broadcast routes (/api/broadcast)", () => {
  it("GET /api/broadcast/templates trả về danh sách mẫu thông báo có sẵn", async () => {
    const res = await app.request("/api/broadcast/templates", { headers: { cookie } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { templates: Array<{ id: string; title: string }> };
    assert.ok(body.templates.length >= 2);
    assert.ok(body.templates.some((t) => t.id === "feature_update"));
  });

  it("GET /api/broadcast/targets lọc đúng nhóm và user", async () => {
    const resAll = await app.request("/api/broadcast/targets?accountId=acc-test", { headers: { cookie } });
    assert.equal(resAll.status, 200);
    const bodyAll = (await resAll.json()) as { targets: Array<{ threadId: string }> };
    assert.equal(bodyAll.targets.length, 3);

    const resGroups = await app.request("/api/broadcast/targets?accountId=acc-test&type=group", { headers: { cookie } });
    const bodyGroups = (await resGroups.json()) as { targets: Array<{ threadId: string }> };
    assert.equal(bodyGroups.targets.length, 2);

    const resBotEnabled = await app.request("/api/broadcast/targets?accountId=acc-test&botEnabledOnly=true", { headers: { cookie } });
    const bodyBotEnabled = (await resBotEnabled.json()) as { targets: Array<{ threadId: string }> };
    assert.equal(bodyBotEnabled.targets.length, 2);
  });

  it("POST /api/broadcast/send báo lỗi khi thiếu tham số hoặc account offline", async () => {
    const resEmpty = await app.request("/api/broadcast/send", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({}),
    });
    assert.equal(resEmpty.status, 400);

    const resOffline = await app.request("/api/broadcast/send", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        accountId: "acc-test",
        threadIds: ["group-1"],
        message: "Nội dung thử nghiệm",
      }),
    });
    assert.equal(resOffline.status, 500);
    const bodyOffline = (await resOffline.json()) as { error: string };
    assert.ok(bodyOffline.error.includes("chưa kết nối") || bodyOffline.error.includes("offline"));
  });
});
