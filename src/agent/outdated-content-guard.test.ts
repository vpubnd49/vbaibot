import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectOutdatedContent, guardOutdatedContent } from "./outdated-content-guard.js";

describe("detectOutdatedContent", () => {
  it("text sạch → không phát hiện gì", () => {
    const r = detectOutdatedContent("Thi hành án hình sự là hoạt động của cơ quan có thẩm quyền");
    assert.equal(r.found, false);
    assert.equal(r.matches.length, 0);
  });

  it("phát hiện 'Chi cục THADS cấp huyện'", () => {
    const r = detectOutdatedContent("Chi cục Thi hành án dân sự cấp huyện có trách nhiệm...");
    assert.equal(r.found, true);
    assert.ok(r.groups.has("cap_huyen"));
  });

  it("phát hiện 'Phòng Tư pháp huyện'", () => {
    const r = detectOutdatedContent("Phòng Tư pháp huyện thực hiện chức năng quản lý...");
    assert.equal(r.found, true);
    assert.ok(r.groups.has("cap_huyen"));
  });

  it("phát hiện 'chính quyền 3 cấp'", () => {
    const r = detectOutdatedContent("Hệ thống chính quyền 3 cấp gồm tỉnh, huyện, xã");
    assert.equal(r.found, true);
  });

  it("phát hiện 'tỉnh–huyện–xã'", () => {
    const r = detectOutdatedContent("Tổ chức theo mô hình tỉnh - huyện - xã");
    assert.equal(r.found, true);
  });

  it("phát hiện Sở cũ Lâm Đồng", () => {
    const r = detectOutdatedContent("Sở Nông nghiệp và Phát triển nông thôn tỉnh Lâm Đồng");
    assert.equal(r.found, true);
    assert.ok(r.groups.has("so_cu_lamdong"));
  });

  it("phát hiện 'Sở Kế hoạch và Đầu tư'", () => {
    const r = detectOutdatedContent("Giao Sở Kế hoạch và Đầu tư chủ trì");
    assert.equal(r.found, true);
    assert.ok(r.groups.has("so_cu_lamdong"));
  });

  it("phát hiện 'Sở Lao động - Thương binh'", () => {
    const r = detectOutdatedContent("Sở Lao động – Thương binh và Xã hội");
    assert.equal(r.found, true);
  });

  it("NGOẠI LỆ: context so sánh cũ/mới → không phát hiện", () => {
    const r = detectOutdatedContent("So sánh mô hình cũ và mới: trước đây có Chi cục THADS cấp huyện, nay đã bỏ");
    assert.equal(r.found, false);
  });

  it("NGOẠI LỆ: 'trước đây' → không phát hiện", () => {
    const r = detectOutdatedContent("Trước đây Sở Nông nghiệp và Phát triển nông thôn quản lý lĩnh vực này");
    assert.equal(r.found, false);
  });

  it("NGOẠI LỆ: 'đã được hợp nhất' → không phát hiện", () => {
    const r = detectOutdatedContent("Sở Giao thông vận tải đã được hợp nhất vào Sở Xây dựng");
    assert.equal(r.found, false);
  });

  it("text quá ngắn → bỏ qua", () => {
    const r = detectOutdatedContent("OK");
    assert.equal(r.found, false);
  });

  it("text rỗng → bỏ qua", () => {
    const r = detectOutdatedContent("");
    assert.equal(r.found, false);
  });
});

describe("guardOutdatedContent", () => {
  it("text sạch → trả nguyên", () => {
    const text = "Thi hành án hình sự gồm 2 loại.";
    assert.equal(guardOutdatedContent(text), text);
  });

  it("text có cụm cấp huyện → append cảnh báo 02 cấp", () => {
    const text = "Công an cấp huyện xử lý vụ việc.";
    const result = guardOutdatedContent(text);
    assert.ok(result.includes("⚠️"));
    assert.ok(result.includes("02 cấp"));
    assert.ok(result.startsWith(text));
  });

  it("text có Sở cũ → append cảnh báo Sở mới", () => {
    const text = "Giao Sở Thông tin và Truyền thông chủ trì.";
    const result = guardOutdatedContent(text);
    assert.ok(result.includes("⚠️"));
    assert.ok(result.includes("hợp nhất"));
  });

  it("text có CẢ cấp huyện VÀ Sở cũ → append cả 2 cảnh báo", () => {
    const text = "UBND huyện phối hợp Sở Kế hoạch và Đầu tư triển khai.";
    const result = guardOutdatedContent(text);
    assert.ok(result.includes("02 cấp"));
    assert.ok(result.includes("hợp nhất"));
  });
});
