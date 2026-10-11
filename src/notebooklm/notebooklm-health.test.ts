import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextHealthStep, type NlmState, type WatchMemory } from "./notebooklm-health.js";

/** Chuỗi kiểm tra -> các câu báo phát ra (null = im lặng) */
function run(states: NlmState[]): (string | null)[] {
  let mem: WatchMemory = { alerted: "ok", pending: null };
  return states.map((s) => {
    const r = nextHealthStep(mem, s);
    mem = r.mem;
    return r.alert;
  });
}

describe("notebooklm-health", () => {
  it("khỏe liên tục -> không báo gì", () => {
    assert.deepEqual(run(["ok", "ok", "ok"]), [null, null, null]);
  });

  it("chập chờn 1 lần (restart) -> không báo", () => {
    assert.deepEqual(run(["ok", "down", "ok"]), [null, null, null]);
  });

  it("tắt 2 lần liên tiếp -> báo đúng 1 lần, khỏi thì báo đã hoạt động lại", () => {
    const out = run(["down", "down", "down", "ok", "ok"]);
    assert.equal(out[0], null);
    assert.match(out[1] ?? "", /không phản hồi/);
    assert.equal(out[2], null);
    assert.match(out[3] ?? "", /hoạt động lại/);
    assert.equal(out[4], null);
  });

  it("bị đăng xuất -> hướng dẫn đăng nhập lại trên dashboard", () => {
    const out = run(["logged_out", "logged_out"]);
    assert.match(out[1] ?? "", /ĐĂNG XUẤT[\s\S]*Đăng nhập Google/);
  });
});
