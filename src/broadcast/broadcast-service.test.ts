import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../shared/test-env-setup.js";
import {
  DEFAULT_BROADCAST_TEMPLATES,
  getBroadcastHistory,
  listBroadcastTargets,
} from "./broadcast-service.js";

let dataDir: string;
let database: typeof import("../conversation/database.js");

before(async () => {
  dataDir = setupTestEnv();
  database = await import("../conversation/database.js");

  // Insert mock threads
  database.db.exec(`
    INSERT OR REPLACE INTO threads (account_id, thread_id, thread_type, display_name, bot_enabled, message_count, last_message_at)
    VALUES
      ('acc-main', 'g-101', 1, 'Nhóm Hành chính & Văn thư', 1, 50, datetime('now', '-1 day')),
      ('acc-main', 'g-102', 1, 'Nhóm Tiếp công dân', 0, 10, datetime('now', '-10 days')),
      ('acc-main', 'u-201', 0, 'Nguyễn Văn B', 1, 30, datetime('now', '-2 hours')),
      ('acc-sub', 'g-301', 1, 'Nhóm CNTT', 1, 100, datetime('now', '-5 minutes'));
  `);
});

after(() => {
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

describe("broadcast-service", () => {
  it("DEFAULT_BROADCAST_TEMPLATES có đầy đủ mẫu cơ bản và format chuẩn Zalo", () => {
    assert.ok(DEFAULT_BROADCAST_TEMPLATES.length >= 3);
    const updateTpl = DEFAULT_BROADCAST_TEMPLATES.find((t) => t.id === "feature_update");
    assert.ok(updateTpl);
    assert.ok(updateTpl.content.includes("VBAI BOT"));
    assert.ok(updateTpl.content.includes("NĐ 30"));
  });

  it("listBroadcastTargets lọc chính xác theo accountId, type, botEnabled và activeWithinDays", () => {
    const allMain = listBroadcastTargets({ accountId: "acc-main" });
    assert.equal(allMain.length, 3);

    const groupsMain = listBroadcastTargets({ accountId: "acc-main", type: "group" });
    assert.equal(groupsMain.length, 2);
    assert.equal(groupsMain[0]?.threadId, "g-101");

    const directMain = listBroadcastTargets({ accountId: "acc-main", type: "direct" });
    assert.equal(directMain.length, 1);
    assert.equal(directMain[0]?.threadId, "u-201");

    const botEnabledMain = listBroadcastTargets({ accountId: "acc-main", botEnabledOnly: true });
    assert.equal(botEnabledMain.length, 2);

    const active7Days = listBroadcastTargets({ accountId: "acc-main", activeWithinDays: 7 });
    assert.equal(active7Days.length, 2); // g-101 (1 day) & u-201 (2 hours)
  });

  it("getBroadcastHistory trả về danh sách lịch sử khi có bản ghi", () => {
    database.db.exec(`
      INSERT INTO broadcast_logs (account_id, thread_id, thread_name, message, status, error)
      VALUES ('acc-main', 'g-101', 'Nhóm Hành chính', 'Nội dung test', 'success', null);
    `);

    const history = getBroadcastHistory("acc-main", 10);
    assert.ok(history.length >= 1);
    assert.equal(history[0]?.threadId, "g-101");
    assert.equal(history[0]?.status, "success");
  });
});
