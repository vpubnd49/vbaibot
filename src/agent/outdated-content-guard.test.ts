import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectOutdatedContent,
  guardOutdatedContent,
  replaceOutdatedOrgNamesInText,
  replaceOutdatedOrgNames,
} from "./outdated-content-guard.js";

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

  it("phát hiện 'Sở Lao động, Thương binh' (dấu phẩy)", () => {
    const r = detectOutdatedContent("do Sở Lao động, Thương binh và Xã hội chủ trì");
    assert.equal(r.found, true);
    assert.ok(r.groups.has("so_cu_lamdong"));
  });

  it("phát hiện 'Ban Dân tộc' (không có 'tỉnh')", () => {
    const r = detectOutdatedContent("Phối hợp với Ban Dân tộc triển khai");
    assert.equal(r.found, true);
    assert.ok(r.groups.has("so_cu_lamdong"));
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

describe("replaceOutdatedOrgNamesInText", () => {
  it("thay 'Sở Lao động - Thương binh và Xã hội' → 'Sở Nội vụ'", () => {
    const input = "Giao Sở Lao động - Thương binh và Xã hội chủ trì";
    const result = replaceOutdatedOrgNamesInText(input);
    assert.equal(result, "Giao Sở Nội vụ chủ trì");
  });

  it("thay 'Sở Lao động – Thương binh và Xã hội' (en-dash) → 'Sở Nội vụ'", () => {
    const input = "các Sở chuyên ngành (Sở Lao động – Thương binh và Xã hội)";
    const result = replaceOutdatedOrgNamesInText(input);
    assert.equal(result, "các Sở chuyên ngành (Sở Nội vụ)");
  });

  it("thay 'Sở Nông nghiệp và Phát triển nông thôn' → 'Sở Nông nghiệp và Môi trường'", () => {
    const result = replaceOutdatedOrgNamesInText("Phối hợp Sở Nông nghiệp và Phát triển nông thôn");
    assert.ok(result.includes("Sở Nông nghiệp và Môi trường"));
    assert.ok(!result.includes("Phát triển nông thôn"));
  });

  it("thay 'Sở Kế hoạch và Đầu tư' → 'Sở Tài chính'", () => {
    const result = replaceOutdatedOrgNamesInText("Sở Kế hoạch và Đầu tư chủ trì lập quy hoạch");
    assert.ok(result.includes("Sở Tài chính"));
  });

  it("thay 'Sở Giao thông vận tải' → 'Sở Xây dựng'", () => {
    const result = replaceOutdatedOrgNamesInText("Sở Giao thông vận tải tỉnh");
    assert.ok(result.includes("Sở Xây dựng"));
  });

  it("thay 'Sở Thông tin và Truyền thông' → 'Sở Khoa học và Công nghệ'", () => {
    const result = replaceOutdatedOrgNamesInText("Sở Thông tin và Truyền thông triển khai");
    assert.ok(result.includes("Sở Khoa học và Công nghệ"));
  });

  it("thay 'Ban Dân tộc tỉnh' → 'Sở Dân tộc và Tôn giáo'", () => {
    const result = replaceOutdatedOrgNamesInText("Ban Dân tộc tỉnh Lâm Đồng");
    assert.ok(result.includes("Sở Dân tộc và Tôn giáo"));
  });

  it("thay 'Ban Dân tộc' (không có 'tỉnh') → 'Sở Dân tộc và Tôn giáo'", () => {
    const result = replaceOutdatedOrgNamesInText("phối hợp với Ban Dân tộc triển khai");
    assert.ok(result.includes("Sở Dân tộc và Tôn giáo"));
  });

  it("thay nhiều Sở cùng lúc", () => {
    const input = "Sở Lao động - Thương binh và Xã hội, Sở Giao thông vận tải, Sở Thông tin và Truyền thông";
    const result = replaceOutdatedOrgNamesInText(input);
    assert.ok(result.includes("Sở Nội vụ"));
    assert.ok(result.includes("Sở Xây dựng"));
    assert.ok(result.includes("Sở Khoa học và Công nghệ"));
    assert.ok(!result.includes("Lao động"));
    assert.ok(!result.includes("Giao thông"));
    assert.ok(!result.includes("Truyền thông"));
  });

  it("NGOẠI LỆ: context so sánh → giữ nguyên", () => {
    const input = "Trước đây Sở Lao động - Thương binh và Xã hội quản lý việc này";
    const result = replaceOutdatedOrgNamesInText(input);
    assert.equal(result, input);
  });

  it("text ngắn → giữ nguyên", () => {
    const result = replaceOutdatedOrgNamesInText("OK");
    assert.equal(result, "OK");
  });

  it("text không có Sở cũ → giữ nguyên", () => {
    const input = "Sở Nội vụ chủ trì triển khai kế hoạch";
    assert.equal(replaceOutdatedOrgNamesInText(input), input);
  });
});

describe("replaceOutdatedOrgNames (deep-replace)", () => {
  it("thay tên Sở cũ trong AdminDocument-like struct", () => {
    const doc = {
      title: "Kế hoạch triển khai",
      sections: [
        { text: "Giao Sở Lao động - Thương binh và Xã hội chủ trì" },
        { text: "Phối hợp Sở Giao thông vận tải" },
      ],
    };
    const result = replaceOutdatedOrgNames(doc);
    assert.ok(JSON.stringify(result).includes("Sở Nội vụ"));
    assert.ok(JSON.stringify(result).includes("Sở Xây dựng"));
    assert.ok(!JSON.stringify(result).includes("Lao động"));
  });

  it("struct không có Sở cũ → trả ref gốc (không clone)", () => {
    const doc = { title: "Sở Nội vụ", text: "OK" };
    const result = replaceOutdatedOrgNames(doc);
    assert.equal(result, doc); // Cùng reference
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

  it("text có Sở cũ → THAY THẾ tên mới + append cảnh báo", () => {
    const text = "Giao Sở Thông tin và Truyền thông chủ trì.";
    const result = guardOutdatedContent(text);
    // Phải thay thế tên cũ
    assert.ok(result.includes("Sở Khoa học và Công nghệ"));
    assert.ok(!result.includes("Sở Thông tin và Truyền thông"));
    // Phải có cảnh báo
    assert.ok(result.includes("⚠️"));
    assert.ok(result.includes("hợp nhất"));
  });

  it("text có 'Sở Lao động - Thương binh' → thay bằng 'Sở Nội vụ'", () => {
    const text = "do Sở Lao động - Thương binh và Xã hội, Sở Văn hóa chủ trì";
    const result = guardOutdatedContent(text);
    assert.ok(result.includes("Sở Nội vụ"));
    assert.ok(!result.includes("Lao động"));
    assert.ok(result.includes("Sở Văn hóa")); // Sở mới giữ nguyên
  });

  it("text có CẢ cấp huyện VÀ Sở cũ → thay Sở + append cả 2 cảnh báo", () => {
    const text = "UBND huyện phối hợp Sở Kế hoạch và Đầu tư triển khai.";
    const result = guardOutdatedContent(text);
    assert.ok(result.includes("Sở Tài chính")); // Đã thay
    assert.ok(result.includes("02 cấp"));        // Cảnh báo huyện
    assert.ok(result.includes("tự động sửa"));   // Cảnh báo đã sửa Sở
  });

  it("NGOẠI LỆ: context so sánh → giữ nguyên, không cảnh báo", () => {
    const text = "Trước đây Sở Lao động - Thương binh quản lý việc làm";
    const result = guardOutdatedContent(text);
    assert.equal(result, text);
  });
});
