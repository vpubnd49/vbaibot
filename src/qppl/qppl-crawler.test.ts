import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractFileUrls } from "./qppl-crawler.js";

describe("extractFileUrls", () => {
  it("parse HTML với entities &#58; và &amp;", () => {
    const html = `<div class="ExternalClass"><a href="https&#58;//media.lamdong.gov.vn/media/dc22e623-23c8-4c00-9345-a52a119e1f77" target="_blank">Thong tu 33.pdf</a><br><a href="https&#58;//media.lamdong.gov.vn/media/6e96ba6d" target="_blank">Cong van 15260.doc</a></div>`;
    const links = extractFileUrls(html);
    assert.equal(links.length, 2);
    assert.equal(links[0]!.name, "Thong tu 33.pdf");
    assert.ok(links[0]!.url.startsWith("https://media.lamdong.gov.vn/"));
    assert.equal(links[1]!.name, "Cong van 15260.doc");
  });

  it("chuỗi rỗng hoặc undefined trả mảng rỗng", () => {
    assert.deepEqual(extractFileUrls(""), []);
    assert.deepEqual(extractFileUrls(undefined), []);
    assert.deepEqual(extractFileUrls("   "), []);
  });

  it("chuẩn hóa URL tương đối và protocol-relative", () => {
    const html =
      `<a href="/relative/path.pdf">relative.pdf</a>` +
      `<a href="//media.lamdong.gov.vn/media/protocol.pdf">protocol.pdf</a>`;
    const links = extractFileUrls(html);
    assert.equal(links.length, 2);
    assert.equal(links[0]!.url, "https://lamdong.gov.vn/relative/path.pdf");
    assert.equal(links[1]!.url, "https://media.lamdong.gov.vn/media/protocol.pdf");
  });

  it("đọc anchor lồng nhau, href không quote và loại trùng", () => {
    const html =
      `<a href=https&#x3A;//media.lamdong.gov.vn/media/a><span>Phụ lục</span><strong>.pdf</strong></a>` +
      `<a href="https://media.lamdong.gov.vn/media/a#fragment" title="ignored.pdf"></a>`;
    const links = extractFileUrls(html);
    assert.equal(links.length, 1);
    assert.equal(links[0]!.name, "Phụ lục .pdf");
  });

  it("hỗ trợ Urls dạng JSON array/object và encode nhiều lớp", () => {
    const urls = JSON.stringify([
      { url: "https://media.lamdong.gov.vn/media/json.pdf", name: "json.pdf" },
      { html: `<a href="https&amp;#58;//media.lamdong.gov.vn/media/nested.docx">nested.docx</a>` },
    ]);
    const links = extractFileUrls(urls);
    assert.ok(links.length >= 2);
    assert.equal(new Set(links.map((link) => link.url)).size, links.length);
    assert.ok(links.some((link) => link.url.endsWith("json.pdf")));
    assert.ok(links.some((link) => link.url.endsWith("nested.docx")));
  });

  it("xử lý nhiều file PDF + DOC + DOCX", () => {
    const html =
      `<a href="https&#58;//media.lamdong.gov.vn/media/aaa">File1.pdf</a><br>` +
      `<a href="https&#58;//media.lamdong.gov.vn/media/bbb">File2.doc</a><br>` +
      `<a href="https&#58;//media.lamdong.gov.vn/media/ccc">File3.docx</a>`;
    const links = extractFileUrls(html);
    assert.equal(links.length, 3);
    assert.equal(links[0]!.name, "File1.pdf");
    assert.equal(links[1]!.name, "File2.doc");
    assert.equal(links[2]!.name, "File3.docx");
  });

  it("unescape &quot; và &#125; đúng", () => {
    const html = `<a href="https&#58;//media.lamdong.gov.vn/media/xxx&amp;token=abc">Report.pdf</a>`;
    const links = extractFileUrls(html);
    assert.equal(links.length, 1);
    assert.ok(links[0]!.url.includes("&token=abc"));
  });
});
