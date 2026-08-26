import { getResearchCache, RESEARCH_TTL, setResearchCache } from "../research-cache.js";
import { fetchJson } from "../research-http-client.js";
import type { KnowledgeResearchQuery, ResearchResult } from "../research-types.js";

type WikipediaSearchResponse = {
  query?: {
    search?: Array<{
      title: string;
      snippet: string;
      pageid: number;
      timestamp: string;
    }>;
  };
};

type WikipediaExtractsResponse = {
  query?: {
    pages?: Record<
      string,
      {
        pageid: number;
        title: string;
        extract?: string;
        fullurl?: string;
        touched?: string;
      }
    >;
  };
};

export async function searchWikipedia(
  query: KnowledgeResearchQuery,
  options: { fetchFn?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ResearchResult[]> {
  const q = query.query.trim();
  if (!q) return [];

  const limit = Math.min(Math.max(query.limit ?? 5, 1), 10);
  const lang = query.language === "en" ? "en" : "vi";
  const cacheKey = `wiki:${lang}:${limit}:${q}`;

  const cached = getResearchCache<ResearchResult[]>("wikipedia", cacheKey);
  if (cached) return cached.data;

  try {
    let results = await fetchWikipediaForLang(q, lang, limit, options);

    // Fallback sang tiếng Anh nếu tiếng Việt không có kết quả và người dùng để auto
    if (results.length === 0 && (!query.language || query.language === "auto") && lang === "vi") {
      results = await fetchWikipediaForLang(q, "en", limit, options);
    }

    setResearchCache("wikipedia", cacheKey, results, RESEARCH_TTL.wikipedia);
    return results;
  } catch (err) {
    const stale = getResearchCache<ResearchResult[]>("wikipedia", cacheKey, { allowStale: true });
    if (stale) return stale.data;
    throw err;
  }
}

async function fetchWikipediaForLang(
  q: string,
  lang: "vi" | "en",
  limit: number,
  options: { fetchFn?: typeof fetch; signal?: AbortSignal },
): Promise<ResearchResult[]> {
  const host = `https://${lang}.wikipedia.org/w/api.php`;
  const searchUrl = `${host}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${limit}&format=json&utf8=1`;

  const searchRes = await fetchJson<WikipediaSearchResponse>("wikipedia", searchUrl, {
    fetchFn: options.fetchFn,
    signal: options.signal,
  });

  const searchItems = searchRes.data.query?.search ?? [];
  if (searchItems.length === 0) return [];

  const pageIds = searchItems.map((s) => s.pageid).join("|");
  const detailUrl = `${host}?action=query&prop=extracts|info&inprop=url&exintro=1&explaintext=1&pageids=${pageIds}&format=json&utf8=1`;

  const detailRes = await fetchJson<WikipediaExtractsResponse>("wikipedia", detailUrl, {
    fetchFn: options.fetchFn,
    signal: options.signal,
  });

  const pages = detailRes.data.query?.pages ?? {};
  const retrievedAt = new Date().toISOString();

  const results: ResearchResult[] = [];
  for (const item of searchItems) {
    const page = pages[String(item.pageid)];
    const title = page?.title ?? item.title;
    const cleanExtract = (page?.extract || item.snippet.replace(/<\/?[^>]+(>|$)/g, "")).trim();
    const url = page?.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`;

    results.push({
      source: "wikipedia",
      title: `${title} (${lang.toUpperCase()})`,
      url,
      summary: cleanExtract,
      publishedAt: page?.touched || item.timestamp,
      publicationStatus: "published",
      license: "Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)",
      retrievedAt,
    });
  }

  return results;
}
