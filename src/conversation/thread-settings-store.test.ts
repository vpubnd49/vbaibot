import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../shared/test-env-setup.js";

let dataDir: string;
let threads: typeof import("./thread-store.js");
let settingsStore: typeof import("./thread-settings-store.js");
let history: typeof import("./history-store.js");

before(async () => {
  dataDir = setupTestEnv();
  threads = await import("./thread-store.js");
  settingsStore = await import("./thread-settings-store.js");
  history = await import("./history-store.js");
});

after(() => {
  history.closeHistoryStore();
  cleanupTestEnv(dataDir);
});

describe("thread-settings-store", () => {
  it("trả về cấu hình mặc định khi thread chưa được lưu cài đặt riêng", () => {
    const s = settingsStore.getThreadSettings("acc-1", "t-default");
    assert.equal(s.accountId, "acc-1");
    assert.equal(s.threadId, "t-default");
    assert.equal(s.botEnabled, true);
    assert.deepEqual(s.disabledTools, []);
    assert.equal(s.customModel, null);
    assert.equal(s.isVip, false);
    assert.equal(s.notes, "");
  });

  it("lưu và đọc lại cài đặt riêng cho thread", () => {
    threads.recordThreadActivity({
      accountId: "acc-1",
      threadId: "t-custom",
      threadType: 0,
      displayName: "VIP Client",
      lastSenderName: "VIP",
    });

    const updated = settingsStore.updateThreadSettings("acc-1", "t-custom", {
      botEnabled: false,
      disabledTools: ["web_search", "calculator"],
      customModel: "openai/gpt-4o-mini",
      isVip: true,
      notes: "Ưu tiên hỗ trợ",
    });

    assert.equal(updated.botEnabled, false);
    assert.deepEqual(updated.disabledTools, ["web_search", "calculator"]);
    assert.equal(updated.customModel, "openai/gpt-4o-mini");
    assert.equal(updated.isVip, true);
    assert.equal(updated.notes, "Ưu tiên hỗ trợ");

    // Đọc lại từ hàm độc lập
    assert.equal(settingsStore.isThreadVip("acc-1", "t-custom"), true);
    assert.equal(settingsStore.getThreadCustomModel("acc-1", "t-custom"), "openai/gpt-4o-mini");

    // Kiểm tra đồng bộ sang threads table
    assert.equal(threads.isBotEnabled("acc-1", "t-custom"), false);
  });
});
