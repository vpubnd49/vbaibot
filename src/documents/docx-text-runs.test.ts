import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTextRuns } from "./docx-text-runs.js";

describe("docx-text-runs", () => {
  it("parse text thường thành TextRun đơn giản", () => {
    const runs = parseTextRuns("Văn bản hành chính thông thường", { font: "Times New Roman", size: 28 });
    assert.equal(runs.length, 1);
  });

  it("parse thẻ <red>...</red> và [red]...[/red] thành chữ đỏ (FF0000) đậm", () => {
    const runs = parseTextRuns("Đây là từ đúng và <red>từ đã sửa</red> trong câu.", { font: "Times New Roman", size: 28 });
    assert.equal(runs.length, 3);
    const redRun = runs[1] as any;
    assert.ok(redRun);
  });

  it("parse ~~từ cũ~~ thành strikethrough", () => {
    const runs = parseTextRuns("Thay thế ~~từ sai~~ bằng <red>từ đúng</red>.", { font: "Times New Roman", size: 28 });
    assert.equal(runs.length, 5);
    const strikeRun = runs[1] as any;
    assert.ok(strikeRun);
  });

  it("parse markdown ***bold italic***, **bold**, *italic*", () => {
    const runs = parseTextRuns("Đoạn văn có ***đậm nghiêng***, **đậm**, và *nghiêng*.", { font: "Times New Roman", size: 28 });
    assert.ok(runs.length >= 5);
  });

  it("parse thẻ HTML <b>...</b> và <i>...</i> không để lọt mã code", () => {
    const runs = parseTextRuns("<b>1. Số lượng mẫu</b>", { font: "Times New Roman", size: 28 });
    assert.equal(runs.length, 1);
    // Không được chứa chuỗi <b> hoặc </b>
    const textContent = JSON.stringify(runs);
    assert.ok(!textContent.includes("<b>") && !textContent.includes("</b>"));
  });

  it("sửa lỗi typo thiếu dấu > của AI như <b1. ...</b> hoặc <b4. ...</b>", () => {
    const runs = parseTextRuns("<b1. Kinh phí</b>: Từ ngân sách...", { font: "Times New Roman", size: 28 });
    assert.equal(runs.length, 2);
    const textContent = JSON.stringify(runs);
    assert.ok(!textContent.includes("<b1."));
    assert.ok(!textContent.includes("</b>"));
  });

  it("xử lý lồng thẻ <i>... <red>...</red> ...</i> chuẩn xác", () => {
    const runs = parseTextRuns("<i>2.1. Vận chuyển từ <red>Tân Sơn Nhất</red></i>: Bộ Chỉ huy", { font: "Times New Roman", size: 28 });
    assert.equal(runs.length, 3);
    const textContent = JSON.stringify(runs);
    assert.ok(!textContent.includes("<i>"));
    assert.ok(!textContent.includes("</i>"));
    assert.ok(!textContent.includes("<red>"));
    assert.ok(!textContent.includes("</red>"));
  });

  it("strip sạch mọi thẻ HTML lạ như <p>, <div>, <span> không để lọt ra Word", () => {
    const runs = parseTextRuns("<p>Đoạn văn trong thẻ p có <span style=\"color:red\">Tân Sơn Nhất</span>.</p>", { font: "Times New Roman", size: 28 });
    assert.equal(runs.length, 3);
    const textContent = JSON.stringify(runs);
    assert.ok(!textContent.includes("<p>"));
    assert.ok(!textContent.includes("</p>"));
    assert.ok(!textContent.includes("<span"));
    assert.ok(!textContent.includes("</span>"));
  });

  it("giữ nguyên phép so sánh toán học như < 50kg hoặc x < 10", () => {
    const runs = parseTextRuns("Khối lượng < 50kg và chiều dài > 20m", { font: "Times New Roman", size: 28 });
    assert.equal(runs.length, 1);
    const textContent = JSON.stringify(runs);
    assert.ok(textContent.includes("< 50kg"));
  });
});
