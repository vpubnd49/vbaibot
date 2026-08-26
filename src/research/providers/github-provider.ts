import { env } from "../../config/env.js";
import { getResearchCache, RESEARCH_TTL, setResearchCache } from "../research-cache.js";
import { fetchJson } from "../research-http-client.js";
import type { DeveloperResearchQuery, ResearchResult } from "../research-types.js";

type GitHubRepoItem = {
  id: number;
  full_name: string;
  name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics?: string[];
  updated_at: string;
  license?: { name?: string; spdx_id?: string };
};

type GitHubRepoSearchResponse = {
  total_count: number;
  items: GitHubRepoItem[];
};

type GitHubIssueItem = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  state: string;
  comments: number;
  created_at: string;
  updated_at: string;
  user?: { login: string };
  repository_url: string;
};

type GitHubIssueSearchResponse = {
  total_count: number;
  items: GitHubIssueItem[];
};

type GraphQLDiscussion = {
  title: string;
  url: string;
  bodyText?: string;
  createdAt: string;
  comments?: { totalCount: number };
  repository?: { nameWithOwner: string };
  author?: { login: string };
};

type GraphQLDiscussionResponse = {
  data?: {
    search?: {
      nodes?: GraphQLDiscussion[];
    };
  };
  errors?: Array<{ message: string }>;
};

export async function searchGitHub(
  query: DeveloperResearchQuery,
  options: { token?: string; fetchFn?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ResearchResult[]> {
  const q = query.query.trim();
  if (!q) return [];

  const limit = Math.min(Math.max(query.limit ?? 5, 1), 10);
  const kind = query.kind ?? "auto";
  const cacheKey = `gh:${kind}:${limit}:${q}`;

  const cached = getResearchCache<ResearchResult[]>("github", cacheKey);
  if (cached) return cached.data;

  const token = options.token || env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    let results: ResearchResult[] = [];
    const retrievedAt = new Date().toISOString();

    if (kind === "issue") {
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=${limit}`;
      const res = await fetchJson<GitHubIssueSearchResponse>("github", url, {
        headers,
        fetchFn: options.fetchFn,
        signal: options.signal,
      });
      for (const item of res.data.items ?? []) {
        const repoName = item.repository_url.replace("https://api.github.com/repos/", "");
        results.push({
          source: "github",
          title: `[Issue #${item.number}] ${item.title} (${repoName})`,
          url: item.html_url,
          summary: (item.body || "Không có mô tả chi tiết.").slice(0, 1000),
          authors: item.user?.login ? [item.user.login] : undefined,
          publishedAt: item.created_at,
          updatedAt: item.updated_at,
          identifiers: { githubFullName: repoName },
          metrics: { comments: item.comments },
          publicationStatus: "published",
          retrievedAt,
        });
      }
    } else if (kind === "discussion") {
      const gqlQuery = `
        query SearchDiscussions($q: String!, $first: Int!) {
          search(query: $q, type: DISCUSSION, first: $first) {
            nodes {
              ... on Discussion {
                title
                url
                bodyText
                createdAt
                comments { totalCount }
                repository { nameWithOwner }
                author { login }
              }
            }
          }
        }
      `;
      const url = "https://api.github.com/graphql";
      const res = await fetchJson<GraphQLDiscussionResponse>("github", url, {
        headers: { ...headers, "Content-Type": "application/json" },
        fetchFn: options.fetchFn ? async () => {
          return options.fetchFn!(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ query: gqlQuery, variables: { q, first: limit } }),
          });
        } : undefined,
        signal: options.signal,
      });

      const nodes = res.data.data?.search?.nodes ?? [];
      for (const d of nodes) {
        results.push({
          source: "github",
          title: `[Discussion] ${d.title} (${d.repository?.nameWithOwner || "GitHub"})`,
          url: d.url,
          summary: (d.bodyText || "Không có nội dung thảo luận.").slice(0, 1000),
          authors: d.author?.login ? [d.author.login] : undefined,
          publishedAt: d.createdAt,
          identifiers: { githubFullName: d.repository?.nameWithOwner },
          metrics: { comments: d.comments?.totalCount },
          publicationStatus: "published",
          retrievedAt,
        });
      }
    } else {
      // Mặc định hoặc repository: Tìm kiếm repositories
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=${limit}`;
      const res = await fetchJson<GitHubRepoSearchResponse>("github", url, {
        headers,
        fetchFn: options.fetchFn,
        signal: options.signal,
      });
      for (const repo of res.data.items ?? []) {
        const topics = repo.topics && repo.topics.length > 0 ? ` Topics: ${repo.topics.join(", ")}.` : "";
        const desc = repo.description ? `${repo.description}.${topics}` : `Kho mã nguồn GitHub.${topics}`;

        results.push({
          source: "github",
          title: `${repo.full_name}${repo.language ? ` [${repo.language}]` : ""}`,
          url: repo.html_url,
          summary: desc,
          authors: [repo.full_name.split("/")[0]!],
          publishedAt: repo.updated_at,
          identifiers: { githubFullName: repo.full_name },
          metrics: {
            stars: repo.stargazers_count,
            forks: repo.forks_count,
          },
          license: repo.license?.spdx_id || repo.license?.name,
          publicationStatus: "published",
          retrievedAt,
        });
      }
    }

    setResearchCache("github", cacheKey, results, RESEARCH_TTL.github);
    return results;
  } catch (err) {
    const stale = getResearchCache<ResearchResult[]>("github", cacheKey, { allowStale: true });
    if (stale) return stale.data;
    throw err;
  }
}
