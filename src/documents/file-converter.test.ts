import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { unzipSync } from "fflate";
import { convertFile, ConvertError } from "./file-converter.js";
import { jpegsToPdf } from "./converter-binaries.js";

function tmp(name: string, data: Buffer | string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "conv-test-"));
  const p = path.join(dir, name);
  fs.writeFileSync(p, data);
  return p;
}

// JPEG 1x1 tối thiểu hợp lệ về cấu trúc SOF
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

describe("file-converter", () => {
  it("TXT → PDF tạo PDF hợp lệ", async () => {
    const r = await convertFile(tmp("a.txt", "Xin chào\nDòng hai"), "pdf");
    assert.equal(r.fileName, "a.pdf");
    assert.equal(r.data.subarray(0, 5).toString(), "%PDF-");
  });

  it("CSV → XLSX bằng thư viện bảng tính", async () => {
    const r = await convertFile(tmp("b.csv", "a,b\n1,2\n"), "xlsx");
    assert.equal(r.data.subarray(0, 2).toString(), "PK");
  });

  it("TXT → DOCX", async () => {
    const r = await convertFile(tmp("c.txt", "Một\nHai"), "docx");
    assert.equal(r.data.subarray(0, 2).toString(), "PK");
  });

  it("JPEG → PDF nhúng ảnh", async () => {
    const r = await convertFile(tmp("d.jpg", TINY_JPEG), "pdf");
    assert.match(r.data.toString("latin1"), /DCTDecode/);
    assert.ok(jpegsToPdf([TINY_JPEG, TINY_JPEG]).toString("latin1").includes("/Count 2"));
  });

  it("file bất kỳ → ZIP", async () => {
    const r = await convertFile(tmp("e.txt", "noi dung"), "zip");
    assert.equal(Buffer.from(unzipSync(new Uint8Array(r.data))["e.txt"]!).toString(), "noi dung");
  });

  it("TGZ → ZIP giữ mọi loại file", async () => {
    const hdr = Buffer.alloc(512);
    hdr.write("x.bin", 0);
    hdr.write("00000000003\0", 124, "latin1");
    hdr[156] = 48;
    hdr.write("ustar", 257, "latin1");
    const body = Buffer.alloc(512); body.write("abc");
    const tgz = zlib.gzipSync(Buffer.concat([hdr, body, Buffer.alloc(1024)]));
    const r = await convertFile(tmp("p.tgz", tgz), "zip");
    assert.ok(unzipSync(new Uint8Array(r.data))["x.bin"]);
  });

  it("chuyển cùng định dạng hoặc không hỗ trợ thì báo lỗi tiếng Việt", async () => {
    await assert.rejects(() => convertFile(tmp("f.txt", "x"), "txt"), ConvertError);
    await assert.rejects(() => convertFile(tmp("g.txt", "x"), "mp3"), ConvertError);
  });
});
