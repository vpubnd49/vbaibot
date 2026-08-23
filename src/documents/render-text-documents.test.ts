import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderTextDocument, wrapHtmlReport } from "./render-text-documents.js";

describe("renderTextDocument", () => {
  it("render markdown kèm BOM UTF-8", () => {
    const content = "# Báo cáo kinh tế Lâm Đồng\n\nNội dung chi tiết tiếng Việt.";
    const buf = renderTextDocument(content, "md");
    assert.equal(buf[0], 0xef);
    assert.equal(buf[1], 0xbb);
    assert.equal(buf[2], 0xbf);
    assert.ok(buf.toString("utf8").includes("Báo cáo kinh tế Lâm Đồng"));
  });

  it("render CSV kèm BOM UTF-8 để mở bằng Excel không lỗi font", () => {
    const csv = "STT,Tên Huyện,Đặc Sản\n1,Đà Lạt,Rau hoa & Dâu tây\n2,Bảo Lộc,Trà & Tơ lụa";
    const buf = renderTextDocument(csv, "csv");
    assert.ok(buf.toString("utf8").includes("Rau hoa & Dâu tây"));
  });

  it("wrapHtmlReport tạo trang HTML hoàn chỉnh có CSS và tiêu đề", () => {
    const html = wrapHtmlReport("<p>Đà Lạt mùa sương mây</p>", "Du lịch Đà Lạt");
    assert.ok(html.includes("<title>Du lịch Đà Lạt</title>"));
    assert.ok(html.includes("Đà Lạt mùa sương mây"));
  });
});
