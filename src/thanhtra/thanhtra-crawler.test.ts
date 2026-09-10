import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPdfUrl } from "./thanhtra-crawler.js";

describe("thanhtra-crawler", () => {
  it("bóc tách đúng link PDF tương đối và gắn domain cổng tỉnh", () => {
    const html = `<p><a href="/sites/thanhtra/Shared%20Documents/TB%2074%20KLTT%20KET%20LUAN%2080.signed.pdf">Xem chi tiết</a></p>`;
    const url = extractPdfUrl(html);
    assert.equal(
      url,
      "https://lamdong.gov.vn/sites/thanhtra/Shared%20Documents/TB%2074%20KLTT%20KET%20LUAN%2080.signed.pdf",
    );
  });

  it("giải mã HTML entities trong CanvasContent1 của SharePoint SPFx", () => {
    const rawSpfx = `&lt;div&gt;&lt;a href=&quot;/sites/thanhtra/Shared Documents/KL 58 2026.pdf&quot;&gt;Tải về&lt;/a&gt;`;
    const url = extractPdfUrl(rawSpfx);
    assert.equal(url, "https://lamdong.gov.vn/sites/thanhtra/Shared Documents/KL 58 2026.pdf");
  });

  it("giữ nguyên URL tuyệt đối nếu đã có https://", () => {
    const html = `<a href="https://lamdong.gov.vn/sites/thanhtra/Shared%20Documents/KL_68.pdf">File</a>`;
    const url = extractPdfUrl(html);
    assert.equal(url, "https://lamdong.gov.vn/sites/thanhtra/Shared%20Documents/KL_68.pdf");
  });

  it("trả về null nếu không có link PDF", () => {
    assert.equal(extractPdfUrl(""), null);
    assert.equal(extractPdfUrl(undefined), null);
    assert.equal(extractPdfUrl("<p>Không có văn bản đính kèm</p>"), null);
    assert.equal(extractPdfUrl('<a href="/sites/thanhtra/hinh-anh.jpg">Ảnh</a>'), null);
  });
});
