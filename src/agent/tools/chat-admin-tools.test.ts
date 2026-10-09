import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type { ParsedMessage } from "../../zalo/zalo-message-parser.js";
import { fakeAgentProfile } from "../../shared/fake-agent-profile.js";
import { cleanupTestEnv, setupTestEnv } from "../../shared/test-env-setup.js";
import { loiCuaTool } from "./tool-failure-result-test-helper.js";

/**
 * recall_message + group_admin với API Zalo giả: kiểm đúng tin được thu hồi,
 * lỗi API thành `ketQuaLoi` (không ném), và group_admin từ chối ngoài nhóm.
 */

let dataDir: string;
let database: typeof import("../../conversation/database.js");
let tracker: typeof import("../../zalo/sent-message-tracker.js");
let recall: typeof import("./recall-message-tool.js");
let groupAdmin: typeof import("./group-admin-tool.js");
type ToolContext = import("./tool-registry.js").ToolContext;

before(async () => {
  dataDir = setupTestEnv();
  database = await import("../../conversation/database.js");
  tracker = await import("../../zalo/sent-message-tracker.js");
  recall = await import("./recall-message-tool.js");
  groupAdmin = await import("./group-admin-tool.js");
});

after(() => {
  tracker.resetSentMessageTracker();
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

beforeEach(() => tracker.resetSentMessageTracker());

type Call = { fn: string; args: unknown[] };

function ctxOf(threadId: string, isGroup: boolean, api: Record<string, unknown>): ToolContext {
  const m = {
    accountId: "acc-ca", threadId, threadType: isGroup ? 1 : 0, isGroup,
    senderId: "u1", senderName: "Hải", text: "x", images: [], msgId: "user-msg", cliMsgId: "c1",
    isSelf: false, mentionsMe: false, rawData: {},
  } as ParsedMessage;
  return {
    api: api as never,
    account: { id: "acc-ca", disabledTools: [] } as never,
    agent: fakeAgentProfile(),
    message: m,
    batch: [m],
  };
}

function fakeApi(calls: Call[], failOn: string[] = []) {
  const make = (fn: string) => async (...args: unknown[]) => {
    calls.push({ fn, args });
    if (failOn.includes(fn)) throw new Error(`${fn} bị từ chối`);
    return {};
  };
  return { undo: make("undo"), changeGroupName: make("changeGroupName"), removeUserFromGroup: make("removeUserFromGroup") };
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const run = (t: any, input: Record<string, unknown>) =>
  t.execute(input, { toolCallId: "tc", messages: [], context: {} as never });

describe("recall_message", () => {
  it("chưa có tin bot nào → ketQuaLoi, không gọi undo", async () => {
    const calls: Call[] = [];
    const r = await run(recall.createRecallMessageTool(ctxOf("t-r0", false, fakeApi(calls))), {});
    assert.match(loiCuaTool(r), /Không có tin nào của bot/);
    assert.equal(calls.length, 0);
  });

  it("thu hồi tin BOT mới nhất (không phải tin người dùng) rồi quên nó", async () => {
    const calls: Call[] = [];
    tracker.recordSentMessage("acc-ca:t-r1", { message: { msgId: 111 } });
    tracker.recordSelfMessage("acc-ca:t-r1", "222", "cli-222");
    const r = await run(recall.createRecallMessageTool(ctxOf("t-r1", false, fakeApi(calls))), {});
    assert.equal(r.success, true);
    assert.deepEqual(calls[0]!.args[0], { msgId: "222", cliMsgId: "cli-222" });
    assert.deepEqual(tracker.recentSentMessages("acc-ca:t-r1").map((m) => m.msgId), ["111"]);
  });

  it("count=2, thiếu cliMsgId → truyền 0", async () => {
    const calls: Call[] = [];
    tracker.recordSentMessage("acc-ca:t-r2", { message: { msgId: 1 } });
    tracker.recordSentMessage("acc-ca:t-r2", { attachment: [{ msgId: 2 }] });
    const r = await run(recall.createRecallMessageTool(ctxOf("t-r2", false, fakeApi(calls))), { count: 2 });
    assert.match(r.message, /Đã thu hồi 2 tin/);
    assert.deepEqual(calls.map((c) => (c.args[0] as { msgId: string }).msgId), ["2", "1"]);
    assert.equal((calls[0]!.args[0] as { cliMsgId: unknown }).cliMsgId, 0);
  });

  it("API từ chối mọi tin → ketQuaLoi, tin vẫn còn để thử lại", async () => {
    const calls: Call[] = [];
    tracker.recordSentMessage("acc-ca:t-r3", { message: { msgId: 9 } });
    const r = await run(recall.createRecallMessageTool(ctxOf("t-r3", false, fakeApi(calls, ["undo"]))), {});
    assert.match(loiCuaTool(r), /undo bị từ chối/);
    assert.equal(tracker.recentSentMessages("acc-ca:t-r3").length, 1);
  });

  it("tin quá 1 giờ không được thu hồi", async () => {
    const calls: Call[] = [];
    tracker.recordSentMessage("acc-ca:t-r4", { message: { msgId: 5 } }, Date.now() - tracker.RECALL_WINDOW_MS - 1000);
    const r = await run(recall.createRecallMessageTool(ctxOf("t-r4", false, fakeApi(calls))), {});
    loiCuaTool(r);
    assert.equal(calls.length, 0);
  });
});

describe("group_admin", () => {
  it("chat riêng → ketQuaLoi, không gọi API", async () => {
    const calls: Call[] = [];
    const r = await run(groupAdmin.createGroupAdminTool(ctxOf("t-g0", false, fakeApi(calls))), { action: "kick", memberId: "x" });
    assert.match(loiCuaTool(r), /chỉ dùng được trong nhóm/);
    assert.equal(calls.length, 0);
  });

  it("rename thiếu tên / kick thiếu memberId → ketQuaLoi", async () => {
    const calls: Call[] = [];
    const t = groupAdmin.createGroupAdminTool(ctxOf("t-g1", true, fakeApi(calls)));
    assert.match(loiCuaTool(await run(t, { action: "rename", newName: "  " })), /Thiếu tên mới/);
    assert.match(loiCuaTool(await run(t, { action: "kick" })), /Thiếu ID/);
    assert.equal(calls.length, 0);
  });

  it("rename hợp lệ → gọi changeGroupName(tên đã trim, groupId)", async () => {
    const calls: Call[] = [];
    const r = await run(groupAdmin.createGroupAdminTool(ctxOf("g-123", true, fakeApi(calls))), { action: "rename", newName: " Tổ Nội chính " });
    assert.equal(r.success, true);
    assert.deepEqual(calls[0], { fn: "changeGroupName", args: ["Tổ Nội chính", "g-123"] });
  });

  it("bot không phải admin (API ném) → ketQuaLoi gợi ý quyền", async () => {
    const calls: Call[] = [];
    const t = groupAdmin.createGroupAdminTool(ctxOf("g-124", true, fakeApi(calls, ["removeUserFromGroup"])));
    assert.match(loiCuaTool(await run(t, { action: "kick", memberId: "u9" })), /chưa phải admin/);
  });
});
