import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { upsertQpplDoc } from "./qppl-store.js";
import { downloadAllFilesForDoc } from "./qppl-service.js";

describe("downloadAllFilesForDoc - PDF only and no draft Word files", () => {
  it("chỉ tải file PDF chính thức, bỏ qua file Word và dự thảo", async () => {
    const doc = upsertQpplDoc({
      soKyHieu: "9999/QĐ-UBND",
      trichYeu: "Quyết định thử nghiệm lọc file",
      nguon: "ubnd",
      fileUrls: JSON.stringify([
        { name: "3. DU THAO QD BAN HANH CHUC NANG SCT.docx", url: "https://example.com/draft.docx" },
        { name: "Ban thao To trinh.doc", url: "https://example.com/draft2.doc" },
        { name: "Du thao quyet dinh.pdf", url: "https://example.com/draft.pdf" },
      ]),
    });

    const result = await downloadAllFilesForDoc(doc.id);
    // Cả 3 file đều là dự thảo hoặc file Word, nên danh sách tải kỳ vọng là 0
    assert.equal(result.expected, 0);
    assert.equal(result.downloaded.length, 0);
  });
});
