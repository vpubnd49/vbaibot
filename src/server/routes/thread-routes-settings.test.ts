import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Hono } from "hono";
import { cleanupTestEnv, setupTestEnv } from "../../shared/test-env-setup.js";

let dataDir: string;
let app: Hono;
let cookie: string;
let accountStore: typeof import("../../config/account-store.js");
let threadStore: typeof import("../../conversation/thread-store.js");
let database: typeof import("../../conversation/database.js");

const ACC = "acc-settings-route";
const TH = "t-settings-1";
const PASSWORD = "mat-khau-test-456";

before(async () => {
  dataDir = setupTestEnv({ DASHBOARD_PASSWORD: PASSWORD });
  const { buildDashboardApp } = await import("../dashboard-server.js");
  app = buildDashboardApp();
  accountStore = await import("../../config/account-store.js");
  threadStore = await import("../../conversation/thread-store.js");
  database = await import("../../conversation/database.js");

  accountStore.createAccount({ id: ACC, label: "Test Account" });

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

describe("thread-routes /settings", () => {
  it("GET và PATCH /api/threads/:threadId/settings hoạt động chuẩn xác", async () => {
    threadStore.recordThreadActivity({
      accountId: ACC,
      threadId: TH,
      threadType: 0,
      displayName: "Khách VIP",
      lastSenderName: "Khách",
    });

    // 1. GET default settings
    const resGet1 = await app.request(`/api/threads/${TH}/settings?accountId=${ACC}`, {
      headers: { cookie },
    });
    assert.equal(resGet1.status, 200);
    const s1 = (await resGet1.json()) as any;
    assert.equal(s1.accountId, ACC);
    assert.equal(s1.threadId, TH);
    assert.equal(s1.botEnabled, true);
    assert.equal(s1.isVip, false);

    // 2. PATCH settings
    const resPatch = await app.request(`/api/threads/${TH}/settings`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        accountId: ACC,
        isVip: true,
        customModel: "google/gemini-2.5-flash",
        notes: "Khách hàng thân thiết",
        disabledTools: ["web_search"],
      }),
    });
    assert.equal(resPatch.status, 200);
    const patched = (await resPatch.json()) as any;
    assert.equal(patched.isVip, true);
    assert.equal(patched.customModel, "google/gemini-2.5-flash");
    assert.equal(patched.notes, "Khách hàng thân thiết");
    assert.deepEqual(patched.disabledTools, ["web_search"]);

    // 3. GET /api/threads list trả kèm isVip và customModel
    const resList = await app.request(`/api/threads?accountId=${ACC}`, {
      headers: { cookie },
    });
    assert.equal(resList.status, 200);
    const list = (await resList.json()) as any;
    const item = list.items.find((x: { threadId: string }) => x.threadId === TH);
    assert.ok(item);
    assert.equal(item.isVip, true);
    assert.equal(item.customModel, "google/gemini-2.5-flash");
  });
});
