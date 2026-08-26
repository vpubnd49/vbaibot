import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../shared/test-env-setup.js";
import { executeKnowledgeResearch, isBiomedicalQuery, isAiCsQuery, isEncyclopediaQuery } from "./knowledge-research-service.js";
import { extractArxivId } from "./providers/arxiv-provider.js";
import { extractDoi } from "./providers/crossref-provider.js";
import { extractPmid } from "./providers/pubmed-provider.js";

let dataDir: string;

before(async () => {
  dataDir = setupTestEnv();
});

after(async () => {
  (await import("../conversation/database.js")).closeDatabase();
  cleanupTestEnv(dataDir);
});

describe("knowledge-research query helpers", () => {
  it("nhận diện đúng arXiv ID định dạng mới và cũ", () => {
    assert.equal(extractArxivId("2401.12345"), "2401.12345");
    assert.equal(extractArxivId("arxiv:2401.12345v2"), "2401.12345v2");
    assert.equal(extractArxivId("https://arxiv.org/abs/math/0309136"), "math/0309136");
    assert.equal(extractArxivId("bài báo thông thường"), null);
  });

  it("nhận diện đúng DOI", () => {
    assert.equal(extractDoi("10.1038/s41586-020-2649-2"), "10.1038/s41586-020-2649-2");
    assert.equal(extractDoi("https://doi.org/10.1145/3372278.3390670"), "10.1145/3372278.3390670");
    assert.equal(extractDoi("từ khóa tìm kiếm"), null);
  });

  it("nhận diện đúng PMID", () => {
    assert.equal(extractPmid("32887942"), "32887942");
    assert.equal(extractPmid("pmid: 12345678"), "12345678");
    assert.equal(extractPmid("thuốc trị cảm cúm"), null);
  });

  it("phân loại chủ đề theo từ khóa heuristic", () => {
    assert.equal(isBiomedicalQuery("nghiên cứu ung thư phổi và thuốc điều trị"), true);
    assert.equal(isBiomedicalQuery("mô hình transformer"), false);

    assert.equal(isAiCsQuery("benchmark reasoning LLM và transformer"), true);
    assert.equal(isAiCsQuery("tiểu sử chủ tịch Hồ Chí Minh"), false);

    assert.equal(isEncyclopediaQuery("tiểu sử Albert Einstein là ai"), true);
  });
});

describe("knowledge-research mock provider execution", () => {
  it("tra cứu Wikipedia trả về kết quả chuẩn hóa", async () => {
    const mockFetch: typeof fetch = async (url) => {
      const u = String(url);
      if (u.includes("action=query&list=search")) {
        return new Response(
          JSON.stringify({
            query: {
              search: [{ title: "Trí tuệ nhân tạo", snippet: "Khái niệm AI...", pageid: 100, timestamp: "2026-01-01" }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          query: {
            pages: {
              "100": { pageid: 100, title: "Trí tuệ nhân tạo", extract: "Trí tuệ nhân tạo là ngành khoa học...", fullurl: "https://vi.wikipedia.org/wiki/AI" },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const res = await executeKnowledgeResearch(
      { query: "Trí tuệ nhân tạo", source: "wikipedia" },
      { fetchFn: mockFetch },
    );
    assert.ok(res.results.length > 0);
    assert.equal(res.results[0]?.source, "wikipedia");
    assert.ok(res.text.includes("Trí tuệ nhân tạo"));
  });

  it("tra cứu arXiv trả về kết quả preprint có ID", async () => {
    const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.12345v1</id>
    <title>Deep Reasoning in LLMs</title>
    <summary>We explore deep reasoning in large models.</summary>
    <author><name>Jane Doe</name></author>
    <published>2024-01-20T00:00:00Z</published>
    <link rel="alternate" href="https://arxiv.org/abs/2401.12345" />
    <link title="pdf" rel="related" type="application/pdf" href="https://arxiv.org/pdf/2401.12345.pdf" />
  </entry>
</feed>`;

    const mockFetch: typeof fetch = async () =>
      new Response(atomXml, { status: 200, headers: { "content-type": "application/atom+xml" } });

    const res = await executeKnowledgeResearch(
      { query: "2401.12345", source: "arxiv" },
      { fetchFn: mockFetch },
    );
    assert.equal(res.results.length, 1);
    assert.equal(res.results[0]?.source, "arxiv");
    assert.equal(res.results[0]?.publicationStatus, "preprint");
    assert.equal(res.results[0]?.identifiers?.arxivId, "2401.12345v1");
  });

  it("tra cứu Semantic Scholar trả về metadata và citations", async () => {
    const mockJson = {
      total: 1,
      offset: 0,
      data: [
        {
          paperId: "abc123",
          title: "Attention Is All You Need",
          abstract: "The dominant sequence transduction models...",
          year: 2017,
          venue: "NeurIPS",
          citationCount: 100000,
          publicationTypes: ["Conference"],
          authors: [{ name: "Ashish Vaswani" }],
          externalIds: { ArXiv: "1706.03762", DOI: "10.5555/3295222.3295349" },
        },
      ],
    };

    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify(mockJson), { status: 200, headers: { "content-type": "application/json" } });

    const res = await executeKnowledgeResearch(
      { query: "Attention Is All You Need", source: "semantic_scholar" },
      { fetchFn: mockFetch },
    );
    assert.equal(res.results.length, 1);
    assert.equal(res.results[0]?.source, "semantic_scholar");
    assert.equal(res.results[0]?.metrics?.citations, 100000);
    assert.equal(res.results[0]?.publicationStatus, "published");
  });
});
