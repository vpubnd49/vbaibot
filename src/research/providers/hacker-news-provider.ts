import { getResearchCache, RESEARCH_TTL, setResearchCache } from "../research-cache.js";
import { fetchJson } from "../research-http-client.js";
import type { DeveloperResearchQuery, ResearchResult } from "../research-types.js";

type HNHit = {
  objectID: string;
  title: string;
  url?: string;
  author: string;
  points: number;
  story_text?: string | null;
  num_comments: number;
  created_at: string;
  _highlightResult?: {
    title?: { value?: string };
    story_text?: { value?: string };
  };
};

type HNSearchResponse = {
  hits: HNHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
};

export async function searchHackerNews(
  query: DeveloperResearchQuery,
  options: { fetchFn?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ResearchResult[]> {
  const q = query.query.trim();
  if (!q) return [];

  const limit = Math.min(Math.max(query.limit ?? 5, 1), 10);
  const cacheKey = `hn:${limit}:${q}`;

  const cached = getResearchCache<ResearchResult[]>("hacker_news", cacheKey);
  if (cached) return cached.data;

  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=${limit}`;
    const res = await fetchJson<HNSearchResponse>("hacker_news", url, {
      fetchFn: options.fetchFn,
      signal: options.signal,
    });

    const hits = res.data.hits ?? [];
    const retrievedAt = new Date().toISOString();
    const results: ResearchResult[] = [];

    for (const item of hits) {
      const hnDiscussionUrl = `https://news.ycombinator.com/item?id=${item.objectID}`;
      const originalUrl = item.url || hnDiscussionUrl;
      const cleanSnippet = (item.story_text || "").replace(/<\/?[^>]+(>|$)/g, " ").replace(/\s+/g, " ").trim();
      const summary = `Thảo luận Hacker News (${item.points || 0} points, ${item.num_comments || 0} bình luận bởi ${item.author}). Link thảo luận HN: ${hnDiscussionUrl}.${cleanSnippet ? ` Nội dung: ${cleanSnippet.slice(0, 500)}` : ""}`;

      results.push({
        source: "hacker_news",
        title: item.title,
        url: originalUrl,
        summary,
        authors: [item.author],
        publishedAt: item.created_at,
        identifiers: {
          hackerNewsObjectId: item.objectID,
        },
        metrics: {
          score: item.points,
          comments: item.num_comments,
        },
        publicationStatus: "published",
        retrievedAt,
      });
    }

    setResearchCache("hacker_news", cacheKey, results, RESEARCH_TTL.hacker_news);
    return results;
  } catch (err) {
    const stale = getResearchCache<ResearchResult[]>("hacker_news", cacheKey, { allowStale: true });
    if (stale) return stale.data;
    throw err;
  }
}
