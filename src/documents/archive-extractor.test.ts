import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { extractArchiveFile, parseTar, detectArchiveKind } from "./archive-extractor.js";
import { cleanupZipTemp } from "./zip-extractor.js";

function tarEntry(name: string, content: string): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, "utf-8");
  header.write(content.length.toString(8).padStart(11, "0") + "\0", 124, "latin1");
  header[156] = 48;
  header.write("ustar", 257, "latin1");
  const body = Buffer.alloc(Math.ceil(content.length / 512) * 512);
  body.write(content, 0, "utf-8");
  return Buffer.concat([header, body]);
}
const makeTar = () => Buffer.concat([tarEntry("a/ghi-chu.txt", "xin chao"), tarEntry("b/bo-qua.exe", "x"), Buffer.alloc(1024)]);

function tmpFile(name: string, data: Buffer): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arc-test-"));
  const p = path.join(dir, name);
  fs.writeFileSync(p, data);
  return p;
}

describe("archive-extractor", () => {
  it("parseTar đọc entry file thường", () => {
    const entries = parseTar(makeTar());
    assert.equal(entries.length, 2);
    assert.equal(entries[0]!.name, "a/ghi-chu.txt");
    assert.equal(Buffer.from(entries[0]!.data).toString(), "xin chao");
  });

  it("giải nén .tar và lọc đuôi không hỗ trợ", async () => {
    const r = await extractArchiveFile(tmpFile("x.tar", makeTar()));
    try {
      assert.equal(r.filePaths.length, 1);
      assert.equal(r.skippedCount, 1);
      assert.equal(fs.readFileSync(r.filePaths[0]!, "utf-8"), "xin chao");
    } finally { cleanupZipTemp(r.tempDir); }
  });

  it("giải nén .tgz", async () => {
    const r = await extractArchiveFile(tmpFile("x.tgz", zlib.gzipSync(makeTar())));
    try { assert.equal(r.filePaths.length, 1); } finally { cleanupZipTemp(r.tempDir); }
  });

  it("giải nén .txt.gz đơn lẻ", async () => {
    const r = await extractArchiveFile(tmpFile("bao-cao.txt.gz", zlib.gzipSync(Buffer.from("noi dung"))));
    try {
      assert.equal(path.extname(r.filePaths[0]!), ".txt");
      assert.equal(fs.readFileSync(r.filePaths[0]!, "utf-8"), "noi dung");
    } finally { cleanupZipTemp(r.tempDir); }
  });

  it("RAR hỏng báo lỗi tiếng Việt, không để rác tạm", async () => {
    await assert.rejects(
      () => extractArchiveFile(tmpFile("hong.rar", Buffer.from("khong phai rar"))),
      /Không đọc được file nén|mật khẩu/,
    );
  });

  it("nhận diện theo đuôi", () => {
    assert.equal(detectArchiveKind("a.RAR"), "rar");
    assert.equal(detectArchiveKind("a.docx"), null);
  });
});
