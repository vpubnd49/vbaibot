import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPhapLuatDetailUrl, buildPhapLuatSearchUrl } from "./phapluat-crawler.js";

describe("Cổng Pháp luật quốc gia URL adapter", () => {
  it("tạo deep-link chi tiết với tab nội dung", () => {
    assert.equal(
      buildPhapLuatDetailUrl("abc-123"),
      "https://phapluat.gov.vn/legal-documents/abc-123?tabName=noidung",
    );
  });

  it("mã hóa id và tab", () => {
    assert.equal(
      buildPhapLuatDetailUrl("id có dấu /", "general info"),
      "https://phapluat.gov.vn/legal-documents/id%20c%C3%B3%20d%E1%BA%A5u%20%2F?tabName=general%20info",
    );
  });

  it("làm sạch từ khóa và tạo link tra cứu", () => {
    assert.equal(
      buildPhapLuatSearchUrl("  Luật\n đất đai\u0000  "),
      "https://phapluat.gov.vn/he-thong-van-ban-phap-luat?search=Lu%E1%BA%ADt%20%C4%91%E1%BA%A5t%20%C4%91ai",
    );
    assert.equal(buildPhapLuatSearchUrl(""), "https://phapluat.gov.vn/he-thong-van-ban-phap-luat");
  });
});
