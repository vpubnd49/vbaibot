import { env } from "../config/env.js";
import { createLogger } from "../shared/logger.js";
import { extractArxivId, searchArxiv } from "./providers/arxiv-provider.js";
import { extractDoi, searchCrossref } from "./providers/crossref-provider.js";
import { extractPmid, searchPubMed } from "./providers/pubmed-provider.js";

export { extractArxivId, extractDoi, extractPmid };
import { searchSemanticScholar } from "./providers/semantic-scholar-provider.js";
import { searchWikipedia } from "./providers/wikipedia-provider.js";
import { deduplicateResearchResults, formatResearchResultsForLlm } from "./research-normalize.js";
import type { KnowledgeResearchQuery, ResearchResult } from "./research-types.js";

const log = createLogger("knowledge-research");

const BIOMEDICAL_KEYWORDS = [
  "ung thư", "covid", "bệnh", "vaccine", "vắc xin", "thuốc", "y học", "y tế", "y sinh",
  "dược", "điều trị", "lâm sàng", "viêm", "tim mạch", "tế bào", "gen", "nhiễm khuẩn",
  "clinical", "treatment", "therapy", "disease", "cancer", "protein", "genome", "drug",
  "pubmed", "pmid", "biomedical",
];

const ENCYCLOPEDIA_KEYWORDS = [
  "là gì", "ai là", "tiểu sử", "lịch sử", "định nghĩa", "nguồn gốc", "khái niệm",
  "nhân vật", "quốc gia", "địa lý", "chiến tranh", "thành phố", "bách khoa",
];

const AI_CS_KEYWORDS = [
  "llm", "transformer", "deep learning", "machine learning", "neural network",
  "trí tuệ nhân tạo", "ai", "reasoning", "diffusion", "vision", "nlp", "reinforcement",
  "arxiv", "preprint", "benchmark", "dataset", "agent",
];

export function isBiomedicalQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return BIOMEDICAL_KEYWORDS.some((kw) => lower.includes(kw));
}

export function isEncyclopediaQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return ENCYCLOPEDIA_KEYWORDS.some((kw) => lower.includes(kw));
}

export function isAiCsQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return AI_CS_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function executeKnowledgeResearch(
  input: KnowledgeResearchQuery,
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

    log.info({ query: input.query, source: input.source, count: unique.length }, "Hoàn thành knowledge research");
    return { text, results: unique };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function routeAndSearch(
  input: KnowledgeResearchQuery,
  options: { fetchFn?: typeof fetch; signal?: AbortSignal },
): Promise<ResearchResult[]> {
  const source = input.source ?? "auto";
  const q = input.query.trim();

  // 1. Chỉ định nguồn tường minh
  if (source === "wikipedia") return searchWikipedia(input, options);
  if (source === "arxiv") return searchArxiv(input, options);
  if (source === "semantic_scholar") return searchSemanticScholar(input, options);
  if (source === "crossref") return searchCrossref(input, options);
  if (source === "pubmed") return searchPubMed(input, options);

  // 2. Chế độ auto: Nhận diện định danh trực tiếp
  const directArxiv = extractArxivId(q);
  if (directArxiv) {
    const [arxivRes, s2Res] = await Promise.allSettled([
      searchArxiv({ ...input, query: directArxiv }, options),
      searchSemanticScholar({ ...input, query: directArxiv }, options),
    ]);
    const list: ResearchResult[] = [];
    if (arxivRes.status === "fulfilled") list.push(...arxivRes.value);
    if (s2Res.status === "fulfilled") list.push(...s2Res.value);
    return list;
  }

  const directDoi = extractDoi(q);
  if (directDoi) {
    const [crossrefRes, s2Res] = await Promise.allSettled([
      searchCrossref({ ...input, query: directDoi }, options),
      searchSemanticScholar({ ...input, query: directDoi }, options),
    ]);
    const list: ResearchResult[] = [];
    if (crossrefRes.status === "fulfilled") list.push(...crossrefRes.value);
    if (s2Res.status === "fulfilled") list.push(...s2Res.value);
    return list;
  }

  const directPmid = extractPmid(q);
  if (directPmid) {
    const [pmRes, s2Res] = await Promise.allSettled([
      searchPubMed({ ...input, query: directPmid }, options),
      searchSemanticScholar({ ...input, query: directPmid }, options),
    ]);
    const list: ResearchResult[] = [];
    if (pmRes.status === "fulfilled") list.push(...pmRes.value);
    if (s2Res.status === "fulfilled") list.push(...s2Res.value);
    return list;
  }

  // 3. Chế độ auto: Phân loại theo chủ đề (tối đa 2 provider song song, 3 khi đối chiếu)
  if (isEncyclopediaQuery(q)) {
    return searchWikipedia(input, options);
  }

  if (isBiomedicalQuery(q)) {
    const [pmRes, s2Res] = await Promise.allSettled([
      searchPubMed(input, options),
      searchSemanticScholar(input, options),
    ]);
    const list: ResearchResult[] = [];
    if (pmRes.status === "fulfilled") list.push(...pmRes.value);
    if (s2Res.status === "fulfilled") list.push(...s2Res.value);
    if (list.length > 0) return list;
    return searchCrossref(input, options);
  }

  if (isAiCsQuery(q)) {
    const [arxivRes, s2Res] = await Promise.allSettled([
      searchArxiv(input, options),
      searchSemanticScholar(input, options),
    ]);
    const list: ResearchResult[] = [];
    if (arxivRes.status === "fulfilled") list.push(...arxivRes.value);
    if (s2Res.status === "fulfilled") list.push(...s2Res.value);
    return list;
  }

  // Mặc định cho nghiên cứu khoa học tổng quát: Semantic Scholar + Crossref song song
  const [s2Res, crRes] = await Promise.allSettled([
    searchSemanticScholar(input, options),
    searchCrossref(input, options),
  ]);
  const list: ResearchResult[] = [];
  if (s2Res.status === "fulfilled") list.push(...s2Res.value);
  if (crRes.status === "fulfilled") list.push(...crRes.value);
  return list;
}
