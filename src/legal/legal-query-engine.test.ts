import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { processLegalQuery } from "./services/legal-query-engine.js";
import { normalizeDocumentNumber } from "./domain/document-number.js";
import { parseArticleCoordinate } from "./domain/article-coordinate.js";
import { extractLegalEntities } from "./domain/legal-entity-extractor.js";
import { detectAdminContext } from "./services/administrative-engine.js";

describe("Legal Domain Entities & Coordinates", () => {
  it("chuẩn hóa đúng số hiệu văn bản", () => {
    assert.equal(normalizeDocumentNumber(" 72 / 2025 / qh15 "), "72/2025/QH15");
    assert.equal(normalizeDocumentNumber("390/NQ-HĐND"), "390/NQ-HĐND");
  });

  it("bóc tách đúng Điều Khoản Điểm", () => {
    const c1 = parseArticleCoordinate("khoản 2 điều 15");
    assert.equal(c1.article, "15");
    assert.equal(c1.clause, "2");
    assert.equal(c1.point, null);

    const c2 = parseArticleCoordinate("điểm a khoản 1 điều 116");
    assert.equal(c2.article, "116");
    assert.equal(c2.clause, "1");
    assert.equal(c2.point, "a");
  });

  it("trích xuất đúng thực thể từ câu hỏi tự nhiên", () => {
    const entities = extractLegalEntities("Cho tôi hỏi về luật số 72 năm 2025 quy định gì");
    assert.equal(entities.hasBareNumberRef, true);
    assert.equal(entities.bareNumberCandidates[0].number, "72");
    assert.equal(entities.years.includes(2025), true);
  });
});

describe("Legal Query Engine", () => {
  it("tra cứu chính xác Luật 72/2025/QH15 qua số hiệu đầy đủ", () => {
    const res = processLegalQuery("Cho tôi hỏi nội dung Luật 72/2025/QH15");
    assert.equal(res.success, true);
    assert.ok(res.document);
    assert.equal(res.document.documentNumber, "72/2025/QH15");
    assert.match(res.document.title, /chính quyền địa phương/i);
    assert.equal(res.document.replacements.includes("65/2025/QH15"), true);
    assert.match(res.retrievalContext, /72\/2025\/QH15/);
    assert.match(res.retrievalContext, /Còn hiệu lực/);
  });

  it("tra cứu Luật việc làm 74/2025/QH15 kèm trích dẫn Điều 116", () => {
    const res = processLegalQuery("Điều 116 Luật 74/2025/QH15 quy định thế nào");
    assert.equal(res.success, true);
    assert.ok(res.document);
    assert.equal(res.document.documentNumber, "74/2025/QH15");
    assert.equal(res.citations.length > 0, true);
    assert.match(res.citations[0].label, /Điều 116/);
    assert.match(res.retrievalContext, /Điều 116/);
  });

  it("tra cứu qua tên chủ đề 'chính quyền địa phương'", () => {
    const res = processLegalQuery("quy định về tổ chức chính quyền địa phương mới nhất");
    assert.equal(res.success, true);
    assert.ok(res.document);
    assert.equal(res.document.documentNumber, "72/2025/QH15");
  });

  it("tra cứu hành chính Lâm Đồng phát hiện cơ cấu Sở mới", () => {
    const ctx = detectAdminContext("Cơ cấu Sở Xây dựng Lâm Đồng mới năm 2025");
    assert.ok(ctx);
    assert.match(ctx, /Sở Xây dựng/);
    assert.match(ctx, /390\/NQ-HĐND/);
  });

  it("xử lý câu hỏi rỗng an toàn", () => {
    const res = processLegalQuery("");
    assert.equal(res.success, false);
    assert.equal(res.documents.length, 0);
  });
});
