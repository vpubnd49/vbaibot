import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../shared/test-env-setup.js";

/**
 * Trần lượt tạo NotebookLM phải chặn bằng MÃ: Google có hạn mức riêng cho mỗi
 * tài khoản, mở cho mọi người mà trần sai là người lạ dùng hết trong ngày.
 */

let dataDir: string;
let store: typeof import("./notebooklm-store.js");
let settings: typeof import("../config/runtime-notebooklm-settings.js");
let database: typeof import("../conversation/database.js");

before(async () => {
  dataDir = setupTestEnv({});
  store = await import("./notebooklm-store.js");
  settings = await import("../config/runtime-notebooklm-settings.js");
  database = await import("../conversation/database.js");
});

after(() => {
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

beforeEach(() => {
  database.db.exec("DELETE FROM notebooklm_usage; DELETE FROM notebooklm_notebooks;");
  database.db.exec("DELETE FROM runtime_settings WHERE key LIKE 'notebooklm_%';");
});

describe("reserveGeneration - trần mỗi chat và toàn bot", () => {
  it("chặn khi cuộc chat dùng hết trần ngày", () => {
    assert.equal(store.reserveGeneration("a:1", 2, 0).ok, true);
    assert.equal(store.reserveGeneration("a:1", 2, 0).ok, true);
    const third = store.reserveGeneration("a:1", 2, 0);
    assert.equal(third.ok, false);
    // Chat khác không bị ảnh hưởng
    assert.equal(store.reserveGeneration("a:2", 2, 0).ok, true);
  });

  it("trần toàn bot chặn cả chat chưa dùng lượt nào", () => {
    store.reserveGeneration("a:1", 10, 2);
    store.reserveGeneration("a:2", 10, 2);
    const r = store.reserveGeneration("a:3", 10, 2);
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.reason : "", /toàn|Bot đã dùng hết/);
  });

  it("hoàn lượt khi tạo hỏng - người dùng dùng lại được", () => {
    store.reserveGeneration("a:1", 1, 0);
    assert.equal(store.reserveGeneration("a:1", 1, 0).ok, false);
    store.refundGeneration("a:1");
    assert.equal(store.reserveGeneration("a:1", 1, 0).ok, true);
  });

  it("hoàn lượt không làm số đếm âm", () => {
    store.refundGeneration("a:9");
    assert.equal(store.usageToday("a:9").thread, 0);
  });

  it("0 = không giới hạn", () => {
    for (let i = 0; i < 20; i++) assert.equal(store.reserveGeneration("a:1", 0, 0).ok, true);
  });
});

describe("notebook riêng cho từng cuộc chat", () => {
  it("lưu và đọc lại đúng notebook của chat", () => {
    assert.equal(store.getThreadNotebook("a:1"), null);
    store.saveThreadNotebook("a:1", "https://notebooklm.google.com/notebook/x", "x");
    store.addSourceCount("a:1", 2);
    assert.deepEqual(store.getThreadNotebook("a:1"), {
      notebookUrl: "https://notebooklm.google.com/notebook/x",
      notebookId: "x",
      sourceCount: 2,
    });
    assert.equal(store.getThreadNotebook("a:2"), null);
  });
});

describe("cấu hình NotebookLM", () => {
  it("mặc định TẮT - chưa đăng nhập Google thì không được vào schema", () => {
    const s = settings.getNotebooklmSettings();
    assert.equal(s.enabled, false);
    assert.equal(settings.isNotebooklmConfigured(s), false);
    assert.equal(s.maxPerDay, 10);
    assert.equal(s.maxPerDayGlobal, 30);
  });

  it("bật từ dashboard có hiệu lực ngay", () => {
    settings.updateNotebooklmSettings({ enabled: true, maxPerDay: 3, publicAccess: false });
    const s = settings.getNotebooklmSettings();
    assert.equal(settings.isNotebooklmConfigured(s), true);
    assert.equal(s.maxPerDay, 3);
    assert.equal(s.publicAccess, false);
  });
});
