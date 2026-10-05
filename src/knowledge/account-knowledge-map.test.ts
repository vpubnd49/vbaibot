import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_KNOWLEDGE_MAP,
  ACC_CONG_THUONG,
  ACC_P_BOT,
  ACC_CHAU_PBS,
  getAccountKnowledge,
} from "./account-knowledge-map.js";

describe("account-knowledge-map", () => {
  // ─── Hằng số account ──────────────────────────────────────────────────────

  it("3 hằng số account đúng ID trên dashboard", () => {
    assert.equal(ACC_CONG_THUONG, "acc-0818000827");
    assert.equal(ACC_P_BOT, "acc-0924343838");
    assert.equal(ACC_CHAU_PBS, "acc-0984310011");
  });

  // ─── Mapping ──────────────────────────────────────────────────────────────

  it("Công Thương nhận 2 lớp tri thức (Nội chính + Công Thương)", () => {
    const layers = ACCOUNT_KNOWLEDGE_MAP.get(ACC_CONG_THUONG);
    assert.ok(layers, "phải có mapping cho Công Thương");
    assert.equal(layers.length, 2, "phải có đúng 2 lớp tri thức");
  });

  it("Châu PBS nhận 2 lớp tri thức (Nội chính + Công Thương)", () => {
    const layers = ACCOUNT_KNOWLEDGE_MAP.get(ACC_CHAU_PBS);
    assert.ok(layers, "phải có mapping cho Châu PBS");
    assert.equal(layers.length, 2, "phải có đúng 2 lớp tri thức");
  });

  it("P-Bot không có trong map (không nhận tri thức chuyên ngành)", () => {
    assert.equal(ACCOUNT_KNOWLEDGE_MAP.has(ACC_P_BOT), false);
  });

  // ─── getAccountKnowledge ──────────────────────────────────────────────────

  it("Công Thương + tool soạn VB bật → nhận đủ 2 lớp", () => {
    const layers = getAccountKnowledge(ACC_CONG_THUONG, true);
    assert.equal(layers.length, 2);
  });

  it("Châu PBS + tool soạn VB bật → nhận đủ 2 lớp", () => {
    const layers = getAccountKnowledge(ACC_CHAU_PBS, true);
    assert.equal(layers.length, 2);
  });

  it("Công Thương + tool soạn VB TẮT → không nhận tri thức (dù có mapping)", () => {
    const layers = getAccountKnowledge(ACC_CONG_THUONG, false);
    assert.equal(layers.length, 0);
  });

  it("P-Bot + tool soạn VB bật → không nhận tri thức (không có mapping)", () => {
    const layers = getAccountKnowledge(ACC_P_BOT, true);
    assert.equal(layers.length, 0);
  });

  it("account lạ không có trong map → trả mảng rỗng", () => {
    const layers = getAccountKnowledge("acc-khong-ton-tai", true);
    assert.equal(layers.length, 0);
  });

  // ─── Bất biến cấu trúc ────────────────────────────────────────────────────

  it("mỗi entry trong map chứa mảng string non-empty", () => {
    for (const [id, layers] of ACCOUNT_KNOWLEDGE_MAP) {
      assert.ok(Array.isArray(layers), `entry ${id} phải là mảng`);
      for (const layer of layers) {
        assert.ok(typeof layer === "string" && layer.length > 100,
          `layer của ${id} phải là string dài (tri thức thật, không phải placeholder)`);
      }
    }
  });

  it("Công Thương tri thức lớp 2 phải chứa từ khóa công thương", () => {
    const layers = ACCOUNT_KNOWLEDGE_MAP.get(ACC_CONG_THUONG)!;
    const congThuongLayer = layers[1]!;
    assert.ok(
      congThuongLayer.toLowerCase().includes("công thương"),
      "lớp 2 phải là tri thức Công Thương",
    );
  });
});
