import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import { dataDir } from "../config/env.js";
import { loadUploadedDocument } from "./load-uploaded-document.js";

describe("loadUploadedDocument", () => {
  const testDir = path.join(dataDir, "media", "test-acc", "test-thread");
  const testTxtPath = path.join(testDir, "test.txt");
  const relTxtPath = "media/test-acc/test-thread/test.txt";

  before(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testTxtPath, "Nội dung văn bản thử nghiệm để kiểm tra tính năng đọc file.", "utf-8");
  });

  after(() => {
    try {
      fs.rmSync(path.join(dataDir, "media", "test-acc"), { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("đọc thành công file text hợp lệ", async () => {
    const res = await loadUploadedDocument(relTxtPath, 1000);
    assert.ok(res);
    assert.equal(res.text, "Nội dung văn bản thử nghiệm để kiểm tra tính năng đọc file.");
    assert.equal(res.truncated, false);
    assert.equal(res.fileType, ".txt");
  });

  it("cắt ngắn nếu nội dung vượt trần maxChars", async () => {
    const res = await loadUploadedDocument(relTxtPath, 10);
    assert.ok(res);
    assert.equal(res.text.length, 10);
    assert.equal(res.truncated, true);
    assert.equal(res.originalLength > 10, true);
  });

  it("trả null khi file không tồn tại", async () => {
    const res = await loadUploadedDocument("media/test-acc/test-thread/non-existent.txt", 1000);
    assert.equal(res, null);
  });

  it("trả null khi đường dẫn cố tình path traversal", async () => {
    const res = await loadUploadedDocument("../../package.json", 1000);
    assert.equal(res, null);
  });
});
