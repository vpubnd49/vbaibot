import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isBugErrorQuery, isHnTrendQuery, isRepoCodeQuery } from "../src/research/developer-research-service.js";
import {
  extractArxivId,
  extractDoi,
  extractPmid,
  isAiCsQuery,
  isBiomedicalQuery,
  isEncyclopediaQuery,
} from "../src/research/knowledge-research-service.js";

describe("research query routing & heuristics evaluation", () => {
  it("nhận diện chính xác các mã định danh khoa học", () => {
    assert.equal(extractArxivId("Tra cứu bài báo 2312.00752 trên arXiv"), "2312.00752");
    assert.equal(extractDoi("Thông tin bài báo có DOI 10.1038/s41586-020-2649-2"), "10.1038/s41586-020-2649-2");
    assert.equal(extractPmid("Nghiên cứu y sinh PMID 33264624 điều trị ung thư"), "33264624");
  });

  it("phân loại chủ đề học thuật y sinh và bách khoa", () => {
    assert.equal(isBiomedicalQuery("Nghiên cứu lâm sàng vaccine COVID-19 và kháng thể"), true);
    assert.equal(isEncyclopediaQuery("Tiểu sử nhà bác học Albert Einstein và thuyết tương đối"), true);
    assert.equal(isAiCsQuery("Deep learning transformer attention mechanism"), true);
  });

  it("phân loại chủ đề kỹ thuật lập trình, mã nguồn và thảo luận", () => {
    assert.equal(isBugErrorQuery("Sửa lỗi UnhandledPromiseRejection trong Node.js"), true);
    assert.equal(isBugErrorQuery("TypeError: Cannot read properties of undefined"), true);

    assert.equal(isRepoCodeQuery("Tìm repo mã nguồn open source về vector database"), true);
    assert.equal(isRepoCodeQuery("Thư viện Python hỗ trợ WebAssembly"), true);

    assert.equal(isHnTrendQuery("Thảo luận trên Hacker News về mô hình Reasoning LLM"), true);
    assert.equal(isHnTrendQuery("Xu hướng công nghệ AI năm 2026"), true);
  });
});
