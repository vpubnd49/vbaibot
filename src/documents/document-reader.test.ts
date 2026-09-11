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
  assert.equal(isSupportedDocument("test.doc"), true);
  assert.equal(isSupportedDocument("test.xls"), true);
  assert.equal(isSupportedDocument("test.ods"), true);
  assert.equal(isSupportedDocument("test.json"), true);
  assert.equal(isSupportedDocument("test.xml"), true);
  assert.equal(isSupportedDocument("test.html"), true);
  assert.equal(isSupportedDocument("test.htm"), true);
  assert.equal(isSupportedDocument("test.rtf"), true);
  assert.equal(isSupportedDocument("test.tsv"), true);
  assert.equal(isSupportedDocument("test.exe"), false);
  assert.equal(isSupportedDocument("test.zip"), false);

  const tempDir = os.tmpdir();

  // 1. Tạo file TXT tạm và đọc
  const testTxtPath = path.join(tempDir, "test_doc_reader_" + Date.now() + ".txt");
  fs.writeFileSync(testTxtPath, "Nội dung văn bản thử nghiệm ZaloAgent 2026", "utf-8");
  const result = await readDocument(testTxtPath);
  assert.equal(result.fileType, ".txt");
  assert.ok(result.text.includes("Nội dung văn bản thử nghiệm"));
  assert.equal(result.truncated, false);
  fs.unlinkSync(testTxtPath);

  // 2. Kiểm tra đọc JSON
  const testJsonPath = path.join(tempDir, "test_doc_reader_" + Date.now() + ".json");
  fs.writeFileSync(testJsonPath, JSON.stringify({ name: "ZaloBot", version: "2.0" }), "utf-8");
  const jsonRes = await readDocument(testJsonPath);
  assert.equal(jsonRes.fileType, ".json");
  assert.ok(jsonRes.text.includes("ZaloBot"));
  fs.unlinkSync(testJsonPath);

  // 3. Kiểm tra đọc XML
  const testXmlPath = path.join(tempDir, "test_doc_reader_" + Date.now() + ".xml");
  fs.writeFileSync(testXmlPath, "<root><item>Hóa đơn điện tử</item></root>", "utf-8");
  const xmlRes = await readDocument(testXmlPath);
  assert.equal(xmlRes.fileType, ".xml");
  assert.ok(xmlRes.text.includes("Hóa đơn điện tử"));
  fs.unlinkSync(testXmlPath);

  // 4. Kiểm tra đọc HTML
  const testHtmlPath = path.join(tempDir, "test_doc_reader_" + Date.now() + ".html");
  fs.writeFileSync(testHtmlPath, "<h1>Báo cáo tháng 8</h1><p>Nội dung chi tiết</p>", "utf-8");
  const htmlRes = await readDocument(testHtmlPath);
  assert.equal(htmlRes.fileType, ".html");
  assert.ok(htmlRes.text.includes("Báo cáo tháng 8"));
  fs.unlinkSync(testHtmlPath);

  // 5. Kiểm tra đọc RTF
  const testRtfPath = path.join(tempDir, "test_doc_reader_" + Date.now() + ".rtf");
  fs.writeFileSync(testRtfPath, "{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Courier;}}\\f0\\fs20 Văn bản định dạng RTF\\par}", "utf-8");
  const rtfRes = await readDocument(testRtfPath);
  assert.equal(rtfRes.fileType, ".rtf");
  assert.ok(rtfRes.text.includes("Văn bản định dạng RTF"));
  fs.unlinkSync(testRtfPath);

  // 6. Tạo file ảnh giả lập và kiểm tra readDocument không crash
  const testImgPath = path.join(tempDir, "test_scan_" + Date.now() + ".jpg");
  fs.writeFileSync(testImgPath, Buffer.from("fake-image-bytes"));
  const imgResult = await readDocument(testImgPath);
  assert.equal(imgResult.fileType, ".jpg");
  assert.equal(imgResult.pageCount, 1);
  assert.ok(typeof imgResult.text === "string" && imgResult.text.length > 0);
  fs.unlinkSync(testImgPath);
});
