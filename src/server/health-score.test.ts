import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tinhSucKhoe } from "./health-score.js";

const tot = { accountsEnabled: 3, accountsOnline: 3, llmConfigured: true, errors24h: 0 };

describe("tinhSucKhoe", () => {
  it("mọi thứ ổn thì 100% và không có lý do", () => {
    assert.deepEqual(tinhSucKhoe(tot), { score: 100, level: "ok", reasons: [] });
  });

  it("account mất kết nối trừ nặng và nêu rõ số lượng", () => {
    const r = tinhSucKhoe({ ...tot, accountsOnline: 2 });
    assert.equal(r.score, 70);
    assert.equal(r.level, "warn");
    assert.match(r.reasons[0]!, /1 tài khoản/);
  });

  it("lỗi lẻ tẻ trừ ít, nhiều lỗi có trần 20 điểm", () => {
    assert.equal(tinhSucKhoe({ ...tot, errors24h: 2 }).score, 99);
    assert.equal(tinhSucKhoe({ ...tot, errors24h: 500 }).score, 80);
  });

  it("chưa cấu hình LLM + mất hết account => đỏ, không âm điểm", () => {
    const r = tinhSucKhoe({ ...tot, accountsOnline: 0, llmConfigured: false, errors24h: 100, cpuPercent: 99 });
    assert.equal(r.score, 0);
    assert.equal(r.level, "bad");
  });

  it("tài nguyên VPS vượt 90% bị trừ, thiếu số liệu VPS thì bỏ qua", () => {
    assert.equal(tinhSucKhoe({ ...tot, diskPercent: 95 }).score, 90);
    assert.equal(tinhSucKhoe({ ...tot, cpuPercent: undefined }).score, 100);
  });
});
