import { env } from "../../config/env.js";
import { getResearchCache, RESEARCH_TTL, setResearchCache } from "../research-cache.js";
import { fetchJson } from "../research-http-client.js";
import { canonicalizeDoi } from "../research-normalize.js";
import type { KnowledgeResearchQuery, ResearchResult } from "../research-types.js";

const PMID_RE = /^\d{1,9}$/;

export function extractPmid(input: string): string | null {
  const clean = input.trim();
  if (PMID_RE.test(clean)) return clean;
  const match = /(?:pmid(?::\s*|\s+)|\/pubmed\/)(\d{1,9})/i.exec(clean);
  return match?.[1] ?? null;
}

type ESearchResponse = {
  esearchresult?: {
    idlist?: string[];
  };
};

type ESummaryAuthor = { name: string };
type ESummaryArticleId = { idtype: string; idval: string };

type ESummaryDoc = {
  uid: string;
  title: string;
  source?: string;
  pubdate?: string;
  sortpubdate?: string;
  authors?: ESummaryAuthor[];
  articleids?: ESummaryArticleId[];
};

type ESummaryResponse = {
  result?: Record<string, ESummaryDoc | string[]>;
};

export async function searchPubMed(
  query: KnowledgeResearchQuery,
  options: { apiKey?: string; fetchFn?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ResearchResult[]> {
  const q = query.query.trim();
  if (!q) return [];

  const limit = Math.min(Math.max(query.limit ?? 5, 1), 10);
  const directPmid = extractPmid(q);
  const cacheKey = directPmid ? `pubmed:pmid:${directPmid}` : `pubmed:q:${limit}:${q}`;

  const cached = getResearchCache<ResearchResult[]>("pubmed", cacheKey);
  if (cached) return cached.data;

  const apiKey = options.apiKey || env.NCBI_API_KEY;
  const apiKeyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";

  try {
    let pmids: string[] = [];
    if (directPmid) {
      pmids = [directPmid];
    } else {
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmode=json&retmax=${limit}${apiKeyParam}`;
      const searchRes = await fetchJson<ESearchResponse>("pubmed", searchUrl, {
        fetchFn: options.fetchFn,
        signal: options.signal,
      });
      pmids = searchRes.data.esearchresult?.idlist ?? [];
    }

    if (pmids.length === 0) return [];

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=json${apiKeyParam}`;
    const summaryRes = await fetchJson<ESummaryResponse>("pubmed", summaryUrl, {
      fetchFn: options.fetchFn,
      signal: options.signal,
    });

    const resultObj = summaryRes.data.result ?? {};
    const retrievedAt = new Date().toISOString();
    const results: ResearchResult[] = [];

    for (const pmid of pmids) {
      const doc = resultObj[pmid] as ESummaryDoc | undefined;
      if (!doc || typeof doc !== "object" || !("title" in doc)) continue;

      const rawTitle = (doc.title || "Untitled PubMed Article").replace(/\.$/, "");
      const journal = doc.source || "";
      const title = journal ? `${rawTitle} (${journal})` : rawTitle;
      const authors = doc.authors?.map((a) => a.name).filter(Boolean);

      let doi: string | undefined;
      if (Array.isArray(doc.articleids)) {
        const doiEntry = doc.articleids.find((id) => id.idtype === "doi");
        if (doiEntry?.idval) {
          doi = canonicalizeDoi(doiEntry.idval);
        }
      }

      const url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
      const summary = `Nghiên cứu y sinh / y học xuất bản${journal ? ` trên tạp chí ${journal}` : ""}${doc.pubdate ? ` (${doc.pubdate})` : ""}. Tra cứu toàn văn và tóm tắt chi tiết tại ${url}.`;

      results.push({
        source: "pubmed",
        title,
        url,
        summary,
        authors: authors && authors.length > 0 ? authors : undefined,
        publishedAt: doc.pubdate,
        identifiers: {
          pmid,
          doi,
        },
        publicationStatus: "published",
        retrievedAt,
      });
    }

    setResearchCache("pubmed", cacheKey, results, RESEARCH_TTL.pubmed);
    return results;
  } catch (err) {
    const stale = getResearchCache<ResearchResult[]>("pubmed", cacheKey, { allowStale: true });
    if (stale) return stale.data;
    throw err;
  }
}
