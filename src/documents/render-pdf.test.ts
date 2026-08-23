import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderPdf } from "./render-pdf.js";

describe("renderPdf", () => {
  it("tạo file PDF 1.4 hợp lệ có header và bảng biểu", () => {
    const pdfBuf = renderPdf("Bao cao Tong hop Lam Dong", [
      {
        title: "1. Tinh hinh kinh te xa hoi",
        paragraphs: ["Kinh te tinh Lam Dong tiep tuc tang truong on dinh."],
        table: {
          headers: ["Chi tieu", "Ke hoach", "Uoc thuc hien"],
          rows: [
            ["GRDP", "8.5%", "8.7%"],
            ["Thu ngan sach", "14.500 ty", "15.200 ty"],
          ],
        },
      },
    ]);

    assert.ok(pdfBuf.length > 100);
    const text = pdfBuf.toString("binary");
    assert.ok(text.startsWith("%PDF-1.4"));
    assert.ok(text.includes("%%EOF"));
    assert.ok(text.includes("Bao cao Tong hop Lam Dong"));
  });
});
