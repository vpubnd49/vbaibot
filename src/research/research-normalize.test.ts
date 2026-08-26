import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalizeArxivId,
  canonicalizeDoi,
  canonicalizeUrl,
  deduplicateResearchResults,
  formatResearchResultsForLlm,
  normalizeTitle,
} from "./research-normalize.js";
import type { ResearchResult } from "./research-types.js";

describe("research-normalize", () => {
  it("canonicalizeDoi chuẩn hóa định dạng DOI", () => {
    assert.equal(canonicalizeDoi("https://doi.org/10.1038/s41586-020-2649-2"), "10.1038/s41586-020-2649-2");
    assert.equal(canonicalizeDoi("http://dx.doi.org/10.1038/abc"), "10.1038/abc");
    assert.equal(canonicalizeDoi("doi:10.1038/ABC"), "10.1038/abc");
    assert.equal(canonicalizeDoi(undefined), undefined);
  });

  it("canonicalizeArxivId chuẩn hóa định dạng arXiv ID", () => {
    assert.equal(canonicalizeArxivId("https://arxiv.org/abs/2301.12345"), "2301.12345");
    assert.equal(canonicalizeArxivId("https://arxiv.org/pdf/2301.12345.pdf"), "2301.12345");
    assert.equal(canonicalizeArxivId("arxiv:2301.12345v2"), "2301.12345v2");
    assert.equal(canonicalizeArxivId(undefined), undefined);
  });

  it("canonicalizeUrl loại bỏ tracking query params", () => {
    assert.equal(
      canonicalizeUrl("https://example.com/paper?utm_source=twitter&fbclid=123#abstract"),
      "https://example.com/paper",
    );
  });

  it("normalizeTitle loại bỏ dấu tiếng Việt và ký tự đặc biệt để so khớp", () => {
    assert.equal(
      normalizeTitle("Nghiên Cứu Trí Tuệ Nhân Tạo: Tổng Quan!"),
      "nghien cuu tri tue nhan tao tong quan",
    );
  });

  it("deduplicateResearchResults loại bỏ bản ghi trùng theo DOI và arXiv", () => {
    const items: ResearchResult[] = [
      {
        source: "arxiv",
        title: "Paper One",
        url: "https://arxiv.org/abs/2401.00001",
        summary: "Preprint version",
        publicationStatus: "preprint",
        identifiers: { arxivId: "2401.00001", doi: "10.1000/1" },
        retrievedAt: "2026-08-26T12:00:00Z",
      },
      {
        source: "semantic_scholar",
        title: "Paper One (Published)",
        url: "https://semanticscholar.org/paper/123",
        summary: "Semantic scholar version",
        publicationStatus: "published",
        identifiers: { doi: "10.1000/1" },
        retrievedAt: "2026-08-26T12:00:00Z",
      },
      {
        source: "github",
        title: "Awesome AI Repo",
        url: "https://github.com/example/awesome-ai",
        summary: "Repo summary",
        publicationStatus: "published",
        identifiers: { githubFullName: "example/awesome-ai" },
        retrievedAt: "2026-08-26T12:00:00Z",
      },
    ];

    const deduplicated = deduplicateResearchResults(items);
    assert.equal(deduplicated.length, 2);
    assert.equal(deduplicated[0]?.source, "arxiv");
    assert.equal(deduplicated[1]?.source, "github");
  });

  it("formatResearchResultsForLlm định dạng text chuẩn kèm attribution và mốc thời gian", () => {
    const items: ResearchResult[] = [
      {
        source: "arxiv",
        title: "Deep Learning Foundations",
        url: "https://arxiv.org/abs/2401.12345",
        summary: "An introduction to deep learning.",
        authors: ["Alice", "Bob"],
        publishedAt: "2024-01-15",
        publicationStatus: "preprint",
        identifiers: { arxivId: "2401.12345" },
        metrics: { citations: 42 },
        retrievedAt: "2026-08-26T12:00:00Z",
      },
    ];

    const output = formatResearchResultsForLlm(items);
    assert.ok(output.includes("### [1] Deep Learning Foundations"));
    assert.ok(output.includes("Bản thảo chưa bình duyệt (Preprint)"));
    assert.ok(output.includes("Alice, Bob"));
    assert.ok(output.includes("2026-08-26T12:00:00Z"));
  });
});
