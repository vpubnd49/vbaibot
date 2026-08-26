import { env } from "../../config/env.js";
import { getResearchCache, RESEARCH_TTL, setResearchCache } from "../research-cache.js";
import { fetchJson } from "../research-http-client.js";
import { canonicalizeArxivId, canonicalizeDoi } from "../research-normalize.js";
import type { KnowledgeResearchQuery, PublicationStatus, ResearchResult } from "../research-types.js";

type S2Author = { name: string; authorId?: string };

type S2Paper = {
  paperId: string;
  title: string;
  abstract?: string | null;
  venue?: string;
  year?: number;
  citationCount?: number;
  authors?: S2Author[];
  publicationTypes?: string[];
  publicationDate?: string;
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    PubMed?: string;
    CorpusId?: number;
  };
  openAccessPdf?: {
    url?: string;
    status?: string;
  };
};

type S2SearchResponse = {
  total: number;
  offset: number;
  next?: number;
  data: S2Paper[];
};

export async function searchSemanticScholar(
  query: KnowledgeResearchQuery,
  options: { apiKey?: string; fetchFn?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ResearchResult[]> {
  const q = query.query.trim();
  if (!q) return [];

  const limit = Math.min(Math.max(query.limit ?? 5, 1), 10);
  const cacheKey = `s2:${limit}:${q}`;

  const cached = getResearchCache<ResearchResult[]>("semantic_scholar", cacheKey);
  if (cached) return cached.data;

  const apiKey = options.apiKey || env.SEMANTIC_SCHOLAR_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const fields = "title,authors,year,venue,citationCount,abstract,externalIds,openAccessPdf,publicationTypes,publicationDate";
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=${limit}&fields=${fields}`;

  try {
    const res = await fetchJson<S2SearchResponse>("semantic_scholar", url, {
      headers,
      fetchFn: options.fetchFn,
      signal: options.signal,
    });

    const papers = res.data.data ?? [];
    const retrievedAt = new Date().toISOString();
    const results: ResearchResult[] = [];

    for (const p of papers) {
      const title = p.title || "Untitled Paper";
      const authors = p.authors?.map((a) => a.name).filter(Boolean);
      const doi = canonicalizeDoi(p.externalIds?.DOI);
      const arxivId = canonicalizeArxivId(p.externalIds?.ArXiv);
      const pmid = p.externalIds?.PubMed;

      let status: PublicationStatus = "unknown";
      if (p.publicationTypes?.includes("JournalArticle") || p.publicationTypes?.includes("Conference")) {
        status = "published";
      } else if (p.publicationTypes?.includes("Preprint") || arxivId) {
        status = "preprint";
      } else if (p.venue || p.year) {
        status = "published";
      }

      const paperUrl = doi
        ? `https://doi.org/${doi}`
        : arxivId
          ? `https://arxiv.org/abs/${arxivId}`
          : `https://www.semanticscholar.org/paper/${p.paperId}`;

      results.push({
        source: "semantic_scholar",
        title: p.venue ? `${title} (${p.venue})` : title,
        url: paperUrl,
        summary: p.abstract || `Bài báo xuất bản năm ${p.year || "chưa rõ"}${p.venue ? ` tại ${p.venue}` : ""}.`,
        authors: authors && authors.length > 0 ? authors : undefined,
        publishedAt: p.publicationDate || (p.year ? String(p.year) : undefined),
        identifiers: {
          doi,
          arxivId,
          pmid,
        },
        metrics: {
          citations: p.citationCount,
        },
        publicationStatus: status,
        retrievedAt,
      });
    }

    setResearchCache("semantic_scholar", cacheKey, results, RESEARCH_TTL.semantic_scholar);
    return results;
  } catch (err) {
    const stale = getResearchCache<ResearchResult[]>("semantic_scholar", cacheKey, { allowStale: true });
    if (stale) return stale.data;
    throw err;
  }
}
