import { env } from "../config/env.js";
import { createLogger } from "../shared/logger.js";
import { searchGitHub } from "./providers/github-provider.js";
import { searchHackerNews } from "./providers/hacker-news-provider.js";
import { searchStackOverflow } from "./providers/stackoverflow-provider.js";
import { deduplicateResearchResults, formatResearchResultsForLlm } from "./research-normalize.js";
import type { DeveloperResearchQuery, ResearchResult } from "./research-types.js";

const log = createLogger("developer-research");

const BUG_ERROR_KEYWORDS = [
  "lỗi", "sửa lỗi", "bug", "error", "exception", "fix", "failed", "crash", "typeerror",
  "stackoverflow", "traceback", "cannot find", "undefined", "nullpointer", "syntaxerror",
  "cors", "unhandled", "rejected", "status 500", "status 400", "status 404", "hướng dẫn sửa",
];

const REPO_CODE_KEYWORDS = [
  "repo", "repository", "github", "thư viện", "framework", "mã nguồn", "package",
  "sdk", "source code", "open source", "kho mã", "mẫu code", "boilerplate",
];

const HN_TREND_KEYWORDS = [
  "hacker news", "hn", "xu hướng", "thảo luận", "startup", "công nghệ mới", "so sánh",
  "bình luận", "y combinator", "show hn", "ask hn", "cộng đồng công nghệ",
];

export function isBugErrorQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return BUG_ERROR_KEYWORDS.some((kw) => lower.includes(kw));
}

export function isRepoCodeQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return REPO_CODE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function isHnTrendQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return HN_TREND_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function executeDeveloperResearch(
  input: DeveloperResearchQuery,
  options: { fetchFn?: typeof fetch } = {},
): Promise<{ text: string; results: ResearchResult[] }> {
  const totalDeadlineMs = env.RESEARCH_TOTAL_DEADLINE_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(`Deadline ${totalDeadlineMs}ms`)), totalDeadlineMs);

  try {
    const results = await routeAndSearch(input, { fetchFn: options.fetchFn, signal: controller.signal });
    const unique = deduplicateResearchResults(results);
    const text = formatResearchResultsForLlm(unique, {
      maxResults: input.limit ?? env.RESEARCH_MAX_RESULTS,
      maxChars: env.RESEARCH_MAX_OUTPUT_CHARS,
    });

    log.info({ query: input.query, source: input.source, count: unique.length }, "Hoàn thành developer research");
    return { text, results: unique };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function routeAndSearch(
  input: DeveloperResearchQuery,
  options: { fetchFn?: typeof fetch; signal?: AbortSignal },
): Promise<ResearchResult[]> {
  const source = input.source ?? "auto";
  const q = input.query.trim();

  // 1. Nguồn cụ thể
  if (source === "github") return searchGitHub(input, options);
  if (source === "stackoverflow") return searchStackOverflow(input, options);
  if (source === "hacker_news") return searchHackerNews(input, options);

  // 2. Chế độ auto: Phân loại theo nhu cầu kỹ thuật
  if (isBugErrorQuery(q)) {
    const [soRes, ghRes] = await Promise.allSettled([
      searchStackOverflow(input, options),
      searchGitHub({ ...input, kind: "issue" }, options),
    ]);
    const list: ResearchResult[] = [];
    if (soRes.status === "fulfilled") list.push(...soRes.value);
    if (ghRes.status === "fulfilled") list.push(...ghRes.value);
    return list;
  }

  if (isHnTrendQuery(q)) {
    const [hnRes, ghRes] = await Promise.allSettled([
      searchHackerNews(input, options),
      searchGitHub(input, options),
    ]);
    const list: ResearchResult[] = [];
    if (hnRes.status === "fulfilled") list.push(...hnRes.value);
    if (ghRes.status === "fulfilled") list.push(...ghRes.value);
    return list;
  }

  if (isRepoCodeQuery(q)) {
    const [ghRes, soRes] = await Promise.allSettled([
      searchGitHub(input, options),
      searchStackOverflow(input, options),
    ]);
    const list: ResearchResult[] = [];
    if (ghRes.status === "fulfilled") list.push(...ghRes.value);
    if (soRes.status === "fulfilled") list.push(...soRes.value);
    return list;
  }

  // Mặc định: GitHub Repo + Stack Overflow
  const [ghRes, soRes] = await Promise.allSettled([
    searchGitHub(input, options),
    searchStackOverflow(input, options),
  ]);
  const list: ResearchResult[] = [];
  if (ghRes.status === "fulfilled") list.push(...ghRes.value);
  if (soRes.status === "fulfilled") list.push(...soRes.value);
  return list;
}
