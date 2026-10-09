import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  RECALL_WINDOW_MS,
  extractSentMsgId,
  flushSentMessageTracker,
  forgetSentMessage,
  initSentMessageTracker,
  recentSentMessages,
  recordSelfMessage,
  recordSentMessage,
  resetSentMessageTracker,
} from "./sent-message-tracker.js";

describe("sent-message-tracker", () => {
  beforeEach(() => resetSentMessageTracker());

  it("rút msgId từ kết quả sendMessage", () => {
    assert.equal(extractSentMsgId({ message: { msgId: 123 }, attachment: [] }), "123");
    assert.equal(extractSentMsgId({ message: null, attachment: [{ msgId: 7 }] }), "7");
    assert.equal(extractSentMsgId(undefined), undefined);
    assert.equal(extractSentMsgId({ message: null, attachment: [] }), undefined);
  });

  it("trả tin mới nhất trước và bỏ tin quá hạn 1 giờ", () => {
    const t0 = 1_000_000;
    recordSentMessage("a:1", { message: { msgId: 1 } }, t0);
    recordSentMessage("a:1", { message: { msgId: 2 } }, t0 + 1000);
    const now = t0 + RECALL_WINDOW_MS + 500;
    assert.deepEqual(recentSentMessages("a:1", now).map((m) => m.msgId), ["2"]);
    assert.deepEqual(recentSentMessages("a:1", t0 + 2000).map((m) => m.msgId), ["2"]);
  });

  it("tách theo thread và quên tin đã thu hồi", () => {
    recordSentMessage("a:1", { message: { msgId: 1 } });
    recordSentMessage("a:2", { message: { msgId: 2 } });
    forgetSentMessage("a:1", "1");
    assert.equal(recentSentMessages("a:1").length, 0);
    assert.equal(recentSentMessages("a:2").length, 1);
  });

  it("gộp tin từ sendMessage với sự kiện selfListen theo msgId và lấy cliMsgId", () => {
    recordSentMessage("a:1", { message: { msgId: 5 } });
    recordSelfMessage("a:1", "5", "999");
    const list = recentSentMessages("a:1");
    assert.equal(list.length, 1);
    assert.equal(list[0]!.cliMsgId, "999");
  });

  it("tin chỉ có từ selfListen (file, ảnh, tin do tool gửi) vẫn được ghi nhận", () => {
    recordSelfMessage("a:1", "8", "123");
    recordSelfMessage("a:1", "9", "0");
    const list = recentSentMessages("a:1");
    assert.deepEqual(list.map((m) => m.msgId), ["9", "8"]);
    assert.equal(list[0]!.cliMsgId, undefined);
    assert.equal(list[1]!.cliMsgId, "123");
  });

  it("lưu xuống đĩa và nạp lại sau restart, bỏ tin quá hạn", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sent-tracker-"));
    const file = path.join(dir, "sent.json");
    try {
      const t0 = Date.now();
      initSentMessageTracker(file, t0);
      recordSelfMessage("a:1", "1", "11", t0 - RECALL_WINDOW_MS - 1000);
      recordSelfMessage("a:1", "2", "22", t0);
      flushSentMessageTracker();

      resetSentMessageTracker(); // giả lập restart
      initSentMessageTracker(file, t0 + 1000);
      const list = recentSentMessages("a:1", t0 + 1000);
      assert.deepEqual(list.map((m) => m.msgId), ["2"]);
      assert.equal(list[0]!.cliMsgId, "22");
    } finally {
      resetSentMessageTracker();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
