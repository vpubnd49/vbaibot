import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  hasTraversalMarkers,
  isSymbolicLink,
  assertSafePathInside,
} from "./path-security-guard.js";

describe("path-security-guard", () => {
  it("nhận diện dấu vết Path Traversal và Null bytes", () => {
    assert.equal(hasTraversalMarkers("../etc/passwd"), true);
    assert.equal(hasTraversalMarkers("sub/../../shadow"), true);
    assert.equal(hasTraversalMarkers("safe.txt\0.jpg"), true);
    assert.equal(hasTraversalMarkers("safe-file.docx"), false);
    assert.equal(hasTraversalMarkers("subfolder/file.pdf"), false);
  });

  it("assertSafePathInside chấp nhận file hợp lệ trong thư mục con", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sec-test-"));
    try {
      const validFile = path.join(tmpDir, "report.pdf");
      fs.writeFileSync(validFile, "sample data");

      const safe = assertSafePathInside(validFile, tmpDir);
      assert.ok(safe.includes("report.pdf"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("assertSafePathInside ném lỗi khi cố thoát khỏi thư mục cho phép", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sec-test-"));
    try {
      const outsideFile = path.join(tmpDir, "..", "outside.txt");
      assert.throws(() => {
        assertSafePathInside(outsideFile, tmpDir);
      }, /Path Traversal|nằm ngoài thư mục/i);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("chặn truy cập Symbolic Link trỏ đi nơi khác", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sec-test-"));
    const outsideTarget = path.join(os.tmpdir(), "target-secret.txt");
    fs.writeFileSync(outsideTarget, "secret data");

    const linkPath = path.join(tmpDir, "link-to-secret.txt");
    try {
      try {
        fs.symlinkSync(outsideTarget, linkPath);
        assert.equal(isSymbolicLink(linkPath), true);
        assert.throws(() => {
          assertSafePathInside(linkPath, tmpDir);
        }, /Symbolic Link|Symlink bypass/i);
      } catch (err: any) {
        // Trên Windows nếu không có quyền tạo symlink (SeCreateSymbolicLinkPrivilege), bỏ qua
        if (err.code !== "EPERM") throw err;
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(outsideTarget, { force: true });
    }
  });
});
