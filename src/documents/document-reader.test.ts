import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { isSupportedDocument, readDocument } from "./document-reader.js";

test("Document reader: kiểm tra định dạng và đọc file văn bản", async () => {
  assert.equal(isSupportedDocument("test.pdf"), true);
  assert.equal(isSupportedDocument("test.docx"), true);
  assert.equal(isSupportedDocument("test.xlsx"), true);
  assert.equal(isSupportedDocument("test.csv"), true);
  assert.equal(isSupportedDocument("test.txt"), true);
  assert.equal(isSupportedDocument("test.md"), true);
  assert.equal(isSupportedDocument("test.exe"), false);
  assert.equal(isSupportedDocument("test.jpg"), false);

  // Tạo file TXT tạm và đọc
  const tempDir = os.tmpdir();
  const testTxtPath = path.join(tempDir, "test_doc_reader_" + Date.now() + ".txt");
  fs.writeFileSync(testTxtPath, "Nội dung văn bản thử nghiệm ZaloAgent 2026", "utf-8");

  const result = await readDocument(testTxtPath);
  assert.equal(result.fileType, ".txt");
  assert.ok(result.text.includes("Nội dung văn bản thử nghiệm"));
  assert.equal(result.truncated, false);

  // Dọn dẹp
  fs.unlinkSync(testTxtPath);
});
