import { env } from "../../config/env.js";
import { getResearchCache, RESEARCH_TTL, setResearchCache } from "../research-cache.js";
import { fetchJson } from "../research-http-client.js";
import type { DeveloperResearchQuery, ResearchResult } from "../research-types.js";

type SOOwner = { display_name?: string; link?: string };

type SOQuestion = {
  question_id: number;
  title: string;
  link: string;
  score: number;
  answer_count: number;
  is_answered: boolean;
  accepted_answer_id?: number;
  tags?: string[];
  owner?: SOOwner;
  creation_date: number;
};

type SOAnswer = {
  answer_id: number;
  score: number;
  is_accepted: boolean;
  body?: string;
  owner?: SOOwner;
  creation_date: number;
};

type SOApiResponse<T> = {
  items: T[];
  has_more: boolean;
  quota_max: number;
  quota_remaining: number;
  backoff?: number;
};

function formatHtmlSnippet(html: string): string {
  // Thay thế code block
  let text = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => `\n\`\`\`\n${code}\n\`\`\`\n`);
  text = text.replace(/<code>(.*?)<\/code>/gi, "`$1`");
  text = text.replace(/<\/?[^>]+(>|$)/g, " ");
  text = text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  return text.replace(/\s+/g, " ").trim();
}

export async function searchStackOverflow(
  query: DeveloperResearchQuery,
  options: { apiKey?: string; fetchFn?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ResearchResult[]> {
  const q = query.query.trim();
  if (!q) return [];

  const limit = Math.min(Math.max(query.limit ?? 5, 1), 10);
  const cacheKey = `so:${limit}:${q}`;

  const cached = getResearchCache<ResearchResult[]>("stackoverflow", cacheKey);
  if (cached) return cached.data;

  const stackKey = options.apiKey || env.STACKAPPS_KEY;
  const keyParam = stackKey ? `&key=${encodeURIComponent(stackKey)}` : "";

  try {
    const searchUrl = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(q)}&site=stackoverflow&pagesize=${limit}${keyParam}`;
    const searchRes = await fetchJson<SOApiResponse<SOQuestion>>("stackoverflow", searchUrl, {
      fetchFn: options.fetchFn,
      signal: options.signal,
    });

    const questions = searchRes.data.items ?? [];
    if (questions.length === 0) return [];

    // Lấy ID câu trả lời được chấp nhận hoặc top 2 câu hỏi để bóc tách câu trả lời chi tiết
    const targetQuestion = questions[0]!;
    let answerSnippet = "";

    if (targetQuestion.accepted_answer_id) {
      try {
        const answerUrl = `https://api.stackexchange.com/2.3/answers/${targetQuestion.accepted_answer_id}?site=stackoverflow&filter=withbody${keyParam}`;
        const answerRes = await fetchJson<SOApiResponse<SOAnswer>>("stackoverflow", answerUrl, {
          fetchFn: options.fetchFn,
          signal: options.signal,
        });
        const ans = answerRes.data.items?.[0];
        if (ans?.body) {
          answerSnippet = `\n\n**Giải pháp được chấp nhận (Accepted Answer, Score: ${ans.score})**:\n${formatHtmlSnippet(ans.body).slice(0, 1500)}`;
        }
      } catch {
        // Fallback: không có answer body thì giữ nguyên tóm tắt câu hỏi
      }
    } else if (targetQuestion.answer_count > 0) {
      try {
        const topAnsUrl = `https://api.stackexchange.com/2.3/questions/${targetQuestion.question_id}/answers?order=desc&sort=votes&site=stackoverflow&filter=withbody&pagesize=1${keyParam}`;
        const topAnsRes = await fetchJson<SOApiResponse<SOAnswer>>("stackoverflow", topAnsUrl, {
          fetchFn: options.fetchFn,
          signal: options.signal,
        });
        const ans = topAnsRes.data.items?.[0];
        if (ans?.body) {
          answerSnippet = `\n\n**Giải pháp có vote cao nhất (Score: ${ans.score})**:\n${formatHtmlSnippet(ans.body).slice(0, 1500)}`;
        }
      } catch {
        // Fallback
      }
    }

    const retrievedAt = new Date().toISOString();
    const results: ResearchResult[] = [];

    for (let i = 0; i < questions.length; i++) {
      const qItem = questions[i]!;
      const tagsStr = qItem.tags && qItem.tags.length > 0 ? ` [${qItem.tags.join(", ")}]` : "";
      const rawTitle = qItem.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      const summaryText = `Câu hỏi có ${qItem.answer_count} câu trả lời (Score: ${qItem.score}).${i === 0 ? answerSnippet : ""}`;

      results.push({
        source: "stackoverflow",
        title: `${rawTitle}${tagsStr}`,
        url: qItem.link,
        summary: summaryText,
        authors: qItem.owner?.display_name ? [qItem.owner.display_name] : undefined,
        publishedAt: new Date(qItem.creation_date * 1000).toISOString(),
        identifiers: {
          stackoverflowQuestionId: String(qItem.question_id),
        },
        metrics: {
          score: qItem.score,
          comments: qItem.answer_count,
        },
        license: "CC BY-SA 4.0 (Stack Exchange Attribution required)",
        publicationStatus: "published",
        retrievedAt,
      });
    }

    setResearchCache("stackoverflow", cacheKey, results, RESEARCH_TTL.stackoverflow);
    return results;
  } catch (err) {
    const stale = getResearchCache<ResearchResult[]>("stackoverflow", cacheKey, { allowStale: true });
    if (stale) return stale.data;
    throw err;
  }
}
