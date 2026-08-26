import { env } from "../config/env.js";
import type { ResearchResult } from "./research-types.js";

export function canonicalizeDoi(doi?: string): string | undefined {
  if (!doi) return undefined;
  let clean = doi.trim().toLowerCase();
  clean = clean.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, "");
  return clean || undefined;
}

export function canonicalizeArxivId(arxivId?: string): string | undefined {
  if (!arxivId) return undefined;
  let clean = arxivId.trim();
  clean = clean.replace(/^(?:https?:\/\/arxiv\.org\/(?:abs|pdf)\/|arxiv:\s*)/i, "");
  clean = clean.replace(/\.pdf$/i, "");
  return clean || undefined;
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    // Bỏ bớt tracking query params
    const removeParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    for (const p of removeParams) {
      u.searchParams.delete(p);
    }
    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hợp nhất và loại bỏ kết quả trùng lặp theo DOI -> arXiv ID -> PMID -> URL -> Tiêu đề */
export function deduplicateResearchResults(results: ResearchResult[]): ResearchResult[] {
  const seenDoi = new Set<string>();
  const seenArxiv = new Set<string>();
  const seenPmid = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  const unique: ResearchResult[] = [];

  for (const item of results) {
    const doi = canonicalizeDoi(item.identifiers?.doi);
    const arxivId = canonicalizeArxivId(item.identifiers?.arxivId);
    const pmid = item.identifiers?.pmid?.trim();
    const url = canonicalizeUrl(item.url);
    const normTitle = normalizeTitle(item.title);

    if (doi && seenDoi.has(doi)) continue;
    if (arxivId && seenArxiv.has(arxivId)) continue;
    if (pmid && seenPmid.has(pmid)) continue;
    if (url && seenUrls.has(url)) continue;
    if (normTitle && seenTitles.has(normTitle)) continue;

    if (doi) seenDoi.add(doi);
    if (arxivId) seenArxiv.add(arxivId);
    if (pmid) seenPmid.add(pmid);
    if (url) seenUrls.add(url);
    if (normTitle) seenTitles.add(normTitle);

    unique.push(item);
  }

  return unique;
}

export function formatResearchResultsForLlm(
  results: ResearchResult[],
  options: { maxChars?: number; maxResults?: number } = {},
): string {
  const maxResults = options.maxResults ?? env.RESEARCH_MAX_RESULTS;
  const maxChars = options.maxChars ?? env.RESEARCH_MAX_OUTPUT_CHARS;

  if (results.length === 0) {
    return "Không tìm thấy kết quả phù hợp từ các nguồn tra cứu.";
  }

  const items = results.slice(0, maxResults);
  const formattedSections: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const parts: string[] = [];

    parts.push(`### [${i + 1}] ${item.title}`);
    parts.push(`- **Nguồn**: ${item.source}`);
    parts.push(`- **URL**: ${item.url}`);

    if (item.authors && item.authors.length > 0) {
      parts.push(`- **Tác giả**: ${item.authors.slice(0, 5).join(", ")}${item.authors.length > 5 ? " và cộng sự" : ""}`);
    }

    if (item.publishedAt) {
      parts.push(`- **Ngày công bố**: ${item.publishedAt}`);
    }

    if (item.publicationStatus) {
      const statusLabel =
        item.publicationStatus === "preprint"
          ? "Bản thảo chưa bình duyệt (Preprint)"
          : item.publicationStatus === "peer_review_evidence_found"
            ? "Đã có bằng chứng bình duyệt chính thức"
            : item.publicationStatus === "published"
              ? "Đã xuất bản / phát hành"
              : "Chưa rõ trạng thái bình duyệt";
      parts.push(`- **Trạng thái xuất bản**: ${statusLabel}`);
    }

    const ids: string[] = [];
    if (item.identifiers?.doi) ids.push(`DOI: ${item.identifiers.doi}`);
    if (item.identifiers?.arxivId) ids.push(`arXiv: ${item.identifiers.arxivId}`);
    if (item.identifiers?.pmid) ids.push(`PMID: ${item.identifiers.pmid}`);
    if (item.identifiers?.githubFullName) ids.push(`Repo: ${item.identifiers.githubFullName}`);
    if (ids.length > 0) {
      parts.push(`- **Định danh**: ${ids.join(" | ")}`);
    }

    const metrics: string[] = [];
    if (item.metrics?.citations !== undefined) metrics.push(`Trích dẫn: ${item.metrics.citations}`);
    if (item.metrics?.stars !== undefined) metrics.push(`Stars: ${item.metrics.stars}`);
    if (item.metrics?.forks !== undefined) metrics.push(`Forks: ${item.metrics.forks}`);
    if (item.metrics?.score !== undefined) metrics.push(`Điểm/Votes: ${item.metrics.score}`);
    if (item.metrics?.comments !== undefined) metrics.push(`Bình luận: ${item.metrics.comments}`);
    if (metrics.length > 0) {
      parts.push(`- **Chỉ số**: ${metrics.join(" | ")}`);
    }

    if (item.license) {
      parts.push(`- **Giấy phép / Bản quyền**: ${item.license}`);
    }

    parts.push(`- **Thời điểm truy xuất**: ${item.retrievedAt}`);

    if (item.summary) {
      parts.push(`\n**Tóm tắt / Nội dung chính**:\n${item.summary.trim()}`);
    }

    formattedSections.push(parts.join("\n"));
  }

  let output = formattedSections.join("\n\n---\n\n");
  if (output.length > maxChars) {
    output = output.slice(0, maxChars) + "\n\n[...Đã cắt bớt do vượt quá giới hạn ký tự]";
  }

  return output;
}
