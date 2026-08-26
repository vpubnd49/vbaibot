import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSafeForExternalReader } from "./web-fetch-tool.js";

describe("isSafeForExternalReader - chống rò rỉ URL nhạy cảm", () => {
  it("cho phép URL công khai thông thường", () => {
    assert.equal(isSafeForExternalReader("https://vnexpress.net/thoi-su/bai-viet-123.html"), true);
    assert.equal(isSafeForExternalReader("https://en.wikipedia.org/wiki/Artificial_intelligence"), true);
  });

  it("chặn URL chứa thông tin xác thực userinfo (username / password)", () => {
    assert.equal(isSafeForExternalReader("https://user:pass@example.com/private"), false);
    assert.equal(isSafeForExternalReader("http://admin@internal.site/data"), false);
  });

  it("chặn URL chứa query token, auth, api_key, signature hoặc secrets", () => {
    assert.equal(isSafeForExternalReader("https://example.com/api?token=secret123"), false);
    assert.equal(isSafeForExternalReader("https://example.com/file?access_token=xyz"), false);
    assert.equal(isSafeForExternalReader("https://example.com/doc?sig=abc987&key=secret"), false);
    assert.equal(isSafeForExternalReader("https://example.com/data?apiKey=12345"), false);
    assert.equal(isSafeForExternalReader("https://example.com/login?password=mysecret"), false);
  });

  it("chặn scheme không phải http/https", () => {
    assert.equal(isSafeForExternalReader("ftp://ftp.example.com/file.txt"), false);
    assert.equal(isSafeForExternalReader("file:///etc/passwd"), false);
    assert.equal(isSafeForExternalReader("javascript:alert(1)"), false);
  });

  it("chặn chuỗi URL không hợp lệ", () => {
    assert.equal(isSafeForExternalReader("not-a-valid-url"), false);
  });
});
