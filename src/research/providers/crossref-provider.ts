import { getResearchCache, RESEARCH_TTL, setResearchCache } from "../research-cache.js";
import { fetchJson } from "../research-http-client.js";
import { canonicalizeDoi } from "../research-normalize.js";
import type { KnowledgeResearchQuery, ResearchResult } from "../research-types.js";

const DOI_RE = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i;

type CrossrefAuthor = {
  given?: string;
  family?: string;
  name?: string;
};

type CrossrefWork = {
  DOI: string;
  title?: string[];
  author?: CrossrefAuthor[];
  "container-title"?: string[];
  publisher?: string;
  issued?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  type?: string;
  URL?: string;
  abstract?: string;
  "is-referenced-by-count"?: number;
};

type CrossrefSearchResponse = {
  message?: {
    items?: CrossrefWork[];
  };
};

type CrossrefSingleResponse = {
  message?: CrossrefWork;
};

export function extractDoi(input: string): string | null {
  const clean = canonicalizeDoi(input) || input.trim();
  if (DOI_RE.test(clean)) return clean;
  const match = /(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/i.exec(input);
  return match?.[1] ?? null;
}

export async function searchCrossref(
  query: KnowledgeResearchQuery,
  options: { fetchFn?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ResearchResult[]> {
  const q = query.query.trim();
  if (!q) return [];

  const limit = Math.min(Math.max(query.limit ?? 5, 1), 10);
  const directDoi = extractDoi(q);
  const cacheKey = directDoi ? `crossref:doi:${directDoi}` : `crossref:q:${limit}:${q}`;

  const cached = getResearchCache<ResearchResult[]>("crossref", cacheKey);
  if (cached) return cached.data;

  try {
    const results: ResearchResult[] = [];
    const retrievedAt = new Date().toISOString();

    if (directDoi) {
      const url = `https://api.crossref.org/works/${encodeURIComponent(directDoi)}`;
      const res = await fetchJson<CrossrefSingleResponse>("crossref", url, {
        fetchFn: options.fetchFn,
        signal: options.signal,
      });
      const work = res.data.message;
      if (work) {
        results.push(mapCrossrefWork(work, retrievedAt));
      }
    } else {
      const url = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=${limit}`;
      const res = await fetchJson<CrossrefSearchResponse>("crossref", url, {
        fetchFn: options.fetchFn,
        signal: options.signal,
      });
      const items = res.data.message?.items ?? [];
      for (const item of items) {
        results.push(mapCrossrefWork(item, retrievedAt));
      }
    }

    setResearchCache("crossref", cacheKey, results, RESEARCH_TTL.crossref);
    return results;
  } catch (err) {
    const stale = getResearchCache<ResearchResult[]>("crossref", cacheKey, { allowStale: true });
    if (stale) return stale.data;
    throw err;
  }
}

function mapCrossrefWork(work: CrossrefWork, retrievedAt: string): ResearchResult {
  const rawTitle = work.title?.[0] || "Untitled Publication";
  const venue = work["container-title"]?.[0] || work.publisher || "";
  const title = venue ? `${rawTitle} (${venue})` : rawTitle;

  const authors: string[] = [];
  if (Array.isArray(work.author)) {
    for (const a of work.author) {
      if (a.name) {
        authors.push(a.name);
      } else if (a.given && a.family) {
        authors.push(`${a.given} ${a.family}`);
      } else if (a.family) {
        authors.push(a.family);
      }
    }
  }

  // Format ngày công bố từ date-parts [[YYYY, MM, DD]]
  const dateParts = work.published?.["date-parts"]?.[0] || work.issued?.["date-parts"]?.[0];
  let publishedAt: string | undefined;
  if (dateParts && dateParts.length > 0) {
    const y = dateParts[0];
    const m = dateParts[1] ? String(dateParts[1]).padStart(2, "0") : undefined;
    const d = dateParts[2] ? String(dateParts[2]).padStart(2, "0") : undefined;
    publishedAt = m && d ? `${y}-${m}-${d}` : m ? `${y}-${m}` : String(y);
  }

  const cleanAbstract = work.abstract
    ? work.abstract.replace(/<\/?[^>]+(>|$)/g, "").trim()
    : `Công trình đã xuất bản${venue ? ` trên ${venue}` : ""}${publishedAt ? ` vào năm ${publishedAt.slice(0, 4)}` : ""}.`;

  const doi = canonicalizeDoi(work.DOI) || work.DOI;
  const url = work.URL || (doi ? `https://doi.org/${doi}` : "");

  return {
    source: "crossref",
    title,
    url,
    summary: cleanAbstract,
    authors: authors.length > 0 ? authors : undefined,
    publishedAt,
    identifiers: {
      doi,
    },
    metrics: {
      citations: work["is-referenced-by-count"],
    },
    publicationStatus: "published",
    retrievedAt,
  };
}
