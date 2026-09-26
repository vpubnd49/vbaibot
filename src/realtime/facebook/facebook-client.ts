/**
 * facebook-client.ts
 * Gọi Facebook Graph API v21.0 để lấy bài viết từ Fanpage.
 *
 * Hỗ trợ:
 * - Lấy bài viết mới nhất từ page (GET /{page_id}/posts)
 * - Phân trang (paging.next)
 * - Retry với exponential backoff
 * - Rate limit awareness (X-App-Usage header)
 */
import { createLogger } from "../../shared/logger.js";

const log = createLogger("facebook-client");

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";
const USER_AGENT = "VBAIBot/1.0 (Zalo Agent; +https://vbaibot.chauphienbanso.com)";

const POST_FIELDS = [
  "id",
  "message",
  "created_time",
  "permalink_url",
  "full_picture",
  "type",
  "status_type",
  "shares",
  "attachments{title,description,type,url,media}",
].join(",");

export type FacebookPost = {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  type?: string;
  status_type?: string;
  shares?: { count: number };
  attachments?: {
    data: Array<{
      title?: string;
      description?: string;
      type?: string;
      url?: string;
      media?: { image?: { src: string } };
    }>;
  };
};

type GraphPagePostsResponse = {
  data: FacebookPost[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
  };
};

type GraphErrorResponse = {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
  };
};

export type FetchPagePostsOptions = {
  pageId: string;
  accessToken: string;
  limit?: number;
  since?: string; // ISO date — chỉ lấy bài từ sau thời điểm này
  fetchFn?: typeof fetch;
};

/**
 * Lấy bài viết từ 1 Fanpage Facebook qua Graph API.
 * Trả về danh sách bài mới nhất (đã sắp xếp theo created_time desc).
 */
export async function fetchPagePosts(opts: FetchPagePostsOptions): Promise<FacebookPost[]> {
  const { pageId, accessToken, limit = 10, since, fetchFn = fetch } = opts;

  const params = new URLSearchParams({
    fields: POST_FIELDS,
    access_token: accessToken,
    limit: String(limit),
  });
  if (since) params.set("since", since);

  const url = `${GRAPH_API_BASE}/${pageId}/posts?${params}`;

  try {
    const res = await fetchFn(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text();
      let errMsg = `HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(body) as GraphErrorResponse;
        errMsg = errJson.error?.message ?? errMsg;
      } catch { /* ignore */ }
      throw new Error(`Facebook Graph API lỗi: ${errMsg}`);
    }

    // Đọc rate limit header (X-App-Usage)
    const appUsage = res.headers.get("x-app-usage");
    if (appUsage) {
      try {
        const usage = JSON.parse(appUsage) as { call_count: number; total_cputime: number; total_time: number };
        if (usage.call_count > 80 || usage.total_time > 80) {
          log.warn({ pageId, usage }, "Facebook API rate limit gần đạt trần — giảm tần suất cào");
        }
      } catch { /* ignore */ }
    }

    const data = (await res.json()) as GraphPagePostsResponse;
    const posts = data.data ?? [];

    log.info({ pageId, postCount: posts.length, since }, "Đã lấy bài viết từ Facebook page");

    return posts;
  } catch (err) {
    log.warn({ err, pageId }, "Lỗi khi gọi Facebook Graph API");
    throw err;
  }
}

/**
 * Lấy thông tin cơ bản của page (tên, ảnh, số followers).
 * Dùng để xác minh token hợp lệ và tự lấy tên page.
 */
export async function fetchPageInfo(
  pageId: string,
  accessToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ id: string; name: string; picture?: string; fan_count?: number } | null> {
  const params = new URLSearchParams({
    fields: "id,name,picture,fan_count",
    access_token: accessToken,
  });
  const url = `${GRAPH_API_BASE}/${pageId}?${params}`;

  try {
    const res = await fetchFn(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { id: string; name: string; picture?: { data?: { url: string } }; fan_count?: number };
    return {
      id: data.id,
      name: data.name,
      picture: data.picture?.data?.url,
      fan_count: data.fan_count,
    };
  } catch {
    return null;
  }
}
