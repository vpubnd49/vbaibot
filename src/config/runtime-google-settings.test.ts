import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../shared/test-env-setup.js";

let dataDir: string;
let store: typeof import("./runtime-google-settings.js");
let database: typeof import("../conversation/database.js");

before(async () => {
  dataDir = setupTestEnv();
  store = await import("./runtime-google-settings.js");
  database = await import("../conversation/database.js");
});

after(() => {
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

describe("runtime-google-settings", () => {
  it("chưa có trong DB: cấu hình mặc định, chưa configured", () => {
    const s = store.getGoogleSettings();
    assert.equal(s.model, "gemini-2.5-flash");
    assert.equal(store.isGoogleConfigured(s), false);
  });

  it("lưu apiKey và lấy lại thành công sau khi mã hóa", () => {
    store.updateGoogleSettings({ apiKey: "AQ.fake-google-key" });
    const s = store.getGoogleSettings();
    assert.equal(store.isGoogleConfigured(s), true);
    assert.equal(s.apiKey, "AQ.fake-google-key");
  });

  it("trả về API view che apiKey", () => {
    const apiView = store.getGoogleSettingsForApi();
    assert.equal(apiView.hasApiKey, true);
    assert.equal(apiView.configured, true);
    assert.notEqual(apiView.apiKeyMasked, "AQ.fake-google-key");
  });

  it("xóa apiKey khi truyền chuỗi rỗng", () => {
    store.updateGoogleSettings({ apiKey: "" });
    assert.equal(store.isGoogleConfigured(), false);
  });
});
