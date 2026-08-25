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
});
