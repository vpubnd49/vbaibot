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
  assert.equal(isSupportedDocument("test.jpg"), true);
  assert.equal(isSupportedDocument("test.jpeg"), true);
  assert.equal(isSupportedDocument("test.png"), true);
  assert.equal(isSupportedDocument("test.bmp"), true);
  assert.equal(isSupportedDocument("test.tiff"), true);
  assert.equal(isSupportedDocument("test.webp"), true);
  assert.equal(isSupportedDocument("test.exe"), false);
  assert.equal(isSupportedDocument("test.zip"), false);

  // Tạo file TXT tạm và đọc
  const tempDir = os.tmpdir();
  const testTxtPath = path.join(tempDir, "test_doc_reader_" + Date.now() + ".txt");
  fs.writeFileSync(testTxtPath, "Nội dung văn bản thử nghiệm ZaloAgent 2026", "utf-8");

  const result = await readDocument(testTxtPath);
  assert.equal(result.fileType, ".txt");
  assert.ok(result.text.includes("Nội dung văn bản thử nghiệm"));
  assert.equal(result.truncated, false);

  // Dọn dẹp file TXT
  fs.unlinkSync(testTxtPath);

  // Tạo file ảnh giả lập và kiểm tra readDocument không crash (fallback thông báo khi sidecar chưa cấu hình)
  const testImgPath = path.join(tempDir, "test_scan_" + Date.now() + ".jpg");
  fs.writeFileSync(testImgPath, Buffer.from("fake-image-bytes"));

  const imgResult = await readDocument(testImgPath);
  assert.equal(imgResult.fileType, ".jpg");
  assert.equal(imgResult.pageCount, 1);
  assert.ok(typeof imgResult.text === "string" && imgResult.text.length > 0);

  // Dọn dẹp file ảnh
  fs.unlinkSync(testImgPath);
});
