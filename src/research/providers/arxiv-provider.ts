import { getResearchCache, RESEARCH_TTL, setResearchCache } from "../research-cache.js";
import { fetchXml } from "../research-http-client.js";
import { canonicalizeArxivId } from "../research-normalize.js";
import type { KnowledgeResearchQuery, ResearchResult } from "../research-types.js";

const ARXIV_NEW_ID_RE = /^\d{4}\.\d{4,5}(?:v\d+)?$/;
const ARXIV_LEGACY_ID_RE = /^[a-zA-Z\-]+(?:\.[a-zA-Z\-]+)?\/\d{7}(?:v\d+)?$/;

export function extractArxivId(input: string): string | null {
  const clean = canonicalizeArxivId(input) || input.trim();
  if (ARXIV_NEW_ID_RE.test(clean) || ARXIV_LEGACY_ID_RE.test(clean)) {
    return clean;
  }
  const prefixMatch = /(?:arxiv:\s*|\/abs\/|\/pdf\/)(\d{4}\.\d{4,5}(?:v\d+)?|[a-zA-Z\-]+(?:\.[a-zA-Z\-]+)?\/\d{7}(?:v\d+)?)/i.exec(input);
  if (prefixMatch?.[1]) return prefixMatch[1];

  const standaloneMatch = /\b(\d{4}\.\d{4,5}(?:v\d+)?)\b/.exec(input);
  return standaloneMatch?.[1] ?? null;
}

type AtomAuthor = { name: string } | string;
type AtomLink = { "@_href"?: string; "@_rel"?: string; "@_title"?: string; "@_type"?: string };

type AtomEntry = {
  id: string;
  title: string;
  summary: string;
  published: string;
  updated?: string;
  author?: AtomAuthor | AtomAuthor[];
  link?: AtomLink | AtomLink[];
  "arxiv:doi"?: { "#text"?: string } | string;
  "arxiv:primary_category"?: { "@_term"?: string };
};

type AtomFeed = {
  feed?: {
    entry?: AtomEntry | AtomEntry[];
  };
};

export async function searchArxiv(
  query: KnowledgeResearchQuery,
  options: { fetchFn?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ResearchResult[]> {
  const q = query.query.trim();
  if (!q) return [];

  const limit = Math.min(Math.max(query.limit ?? 5, 1), 10);
  const directId = extractArxivId(q);
  const cacheKey = directId ? `arxiv:id:${directId}` : `arxiv:q:${limit}:${q}`;
  const ttl = directId ? RESEARCH_TTL.arxiv_id : RESEARCH_TTL.arxiv;

  const cached = getResearchCache<ResearchResult[]>("arxiv", cacheKey);
  if (cached) return cached.data;

  try {
    let url: string;
    if (directId) {
      url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(directId)}&max_results=1`;
    } else {
      url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=${limit}`;
    }

    const res = await fetchXml<AtomFeed>("arxiv", url, {
      minIntervalMs: 3000,
      fetchFn: options.fetchFn,
      signal: options.signal,
    });

    const rawEntries = res.data.feed?.entry;
    const entries: AtomEntry[] = Array.isArray(rawEntries)
      ? rawEntries
      : rawEntries
        ? [rawEntries]
        : [];

    const retrievedAt = new Date().toISOString();
    const results: ResearchResult[] = [];

    for (const entry of entries) {
      const rawTitle = typeof entry.title === "string" ? entry.title.replace(/\s+/g, " ").trim() : "";
      const rawSummary = typeof entry.summary === "string" ? entry.summary.replace(/\s+/g, " ").trim() : "";
      const rawId = typeof entry.id === "string" ? entry.id : "";
      const extractedId = extractArxivId(rawId) || rawId;

      // Trích xuất authors
      const authors: string[] = [];
      if (Array.isArray(entry.author)) {
        for (const a of entry.author) {
          const name = typeof a === "object" && a !== null && "name" in a ? a.name : String(a);
          if (name) authors.push(name.trim());
        }
      } else if (entry.author) {
        const a = entry.author;
        const name = typeof a === "object" && a !== null && "name" in a ? a.name : String(a);
        if (name) authors.push(name.trim());
      }

      // Trích xuất landing URL
      let landingUrl = `https://arxiv.org/abs/${extractedId}`;

      if (Array.isArray(entry.link)) {
        for (const l of entry.link) {
          if (l["@_rel"] === "alternate" && l["@_href"]) {
            landingUrl = l["@_href"];
          }
        }
      }

      // DOI nếu có
      let doi: string | undefined;
      if (entry["arxiv:doi"]) {
        const d = entry["arxiv:doi"];
        doi = typeof d === "object" && d !== null && "#text" in d ? d["#text"] : String(d);
      }

      results.push({
        source: "arxiv",
        title: rawTitle,
        url: landingUrl,
        summary: rawSummary,
        authors: authors.length > 0 ? authors : undefined,
        publishedAt: entry.published,
        updatedAt: entry.updated,
        identifiers: {
          arxivId: extractedId,
          doi,
        },
        publicationStatus: "preprint",
        license: "arXiv.org perpetual non-exclusive license / Open Access",
        retrievedAt,
      });
    }

    setResearchCache("arxiv", cacheKey, results, ttl);
    return results;
  } catch (err) {
    const stale = getResearchCache<ResearchResult[]>("arxiv", cacheKey, { allowStale: true });
    if (stale) return stale.data;
    throw err;
  }
}
