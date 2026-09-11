import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createQpplArchive } from "./qppl-archive.js";

void describe("createQpplArchive", () => {
  it("tạo ZIP có file Unicode và MANIFEST.csv", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qppl-archive-"));
    const input = path.join(dir, "quyet-dinh.pdf");
    const output = path.join(dir, "result.zip");
    fs.writeFileSync(input, Buffer.from("%PDF-1.7 test"));

    const result = await createQpplArchive(output, [
      { filePath: input, entryName: "2026/BCĐ/Quyết định.pdf" },
    ], [{
      documentId: 1,
      soKyHieu: "4480/QĐ-BDD",
      loaiVanBan: "Quyết định",
      ngayBanHanh: "2026-01-01",
      trichYeu: "Thành lập Ban Chỉ đạo",
      fileName: "Quyết định.pdf",
      entryName: "2026/BCĐ/Quyết định.pdf",
      status: "downloaded",
    }]);

    assert.equal(result.path, output);
    assert.ok(result.bytes > 0);
    assert.ok(fs.statSync(output).size > 0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
