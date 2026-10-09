import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getAdminUserIds, notifyAccountDisconnect, notifyAccountRecovered, resetAlertStatesForTest } from "./owner-notifier.js";

describe("owner-notifier", () => {
  beforeEach(() => {
    resetAlertStatesForTest();
  });

  it("trả về danh sách admin id từ cấu hình hoặc fallback env", () => {
    const ids = getAdminUserIds();
    assert.ok(Array.isArray(ids));
    // Ít nhất có admin từ env.ANTIGRAVITY_ADMIN_USER_IDS mặc định
    assert.ok(ids.includes("1049933544839800796"));
  });

  it("notifyAccountRecovered trả false nếu account chưa từng bị disconnect", async () => {
    const res = await notifyAccountRecovered("acc-test-random");
    assert.equal(res, false);
  });

  it("notifyAccountDisconnect không ném lỗi dù không có tài khoản online trong môi trường test", async () => {
    const res = await notifyAccountDisconnect("acc-test", "Thử nghiệm ngắt kết nối");
    // Không có tài khoản nào online để gửi tin nên trả về false một cách an toàn
    assert.equal(res, false);
  });
});
