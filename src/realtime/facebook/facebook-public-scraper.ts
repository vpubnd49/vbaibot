/**
 * facebook-public-scraper.ts
 * Fallback scraper cho các Facebook Page công khai khi KHÔNG có Graph API token.
 *
 * Chiến lược: Dùng Googlebot UA để fetch trang Facebook (pre-rendered HTML).
 * Facebook trả về HTML chứa JSON data nhúng có pattern "message":{"text":"..."}
 * — cùng cấu trúc mà Googlebot nhận được khi crawl.
 *
 * Ưu tiên: Graph API (có token) > Googlebot scraper (fallback)
 */
import { createLogger } from "../../shared/logger.js";

const log = createLogger("facebook-public-scraper");

// Googlebot UA — Facebook trả về pre-rendered HTML cho bot tìm kiếm
const USER_AGENT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export type ScrapedPost = {
  postId: string;
  message: string;
  permalink: string;
  imageUrl: string | null;
  createdAt: string;
};

/** Cooldown khi bị block hoặc lỗi liên tục */
const failedPageUntil = new Map<string, number>();
const FAILURE_COOLDOWN_MS = 30 * 60 * 1000; // 30 phút

/**
 * Cào bài viết công khai từ 1 Facebook Page.
 *
 * Dùng Googlebot UA để lấy pre-rendered HTML từ facebook.com,
 * rồi parse JSON data nhúng trong HTML (pattern "message":{"text":"..."}).
 *
 * Lưu ý:
 * - Chỉ lấy được bài viết CÔNG KHAI (public)
 * - Có thể bị Facebook chặn nếu cào quá nhiều → có cooldown
 */
export async function scrapePublicPagePosts(
  pageSlug: string,
  maxPosts = 5,
  fetchFn: typeof fetch = fetch,
): Promise<ScrapedPost[]> {
  const key = pageSlug.toLowerCase();
  const blockedUntil = failedPageUntil.get(key) ?? 0;
  if (blockedUntil > Date.now()) {
    log.debug({ pageSlug }, "Page đang trong cooldown — bỏ qua");
    return [];
  }

  // Dùng /posts/ endpoint để lấy danh sách bài viết
  const url = pageSlug.startsWith("profile.php")
    ? `https://www.facebook.com/${pageSlug}`
    : `https://www.facebook.com/${pageSlug}/posts/`;

  try {
    const res = await fetchFn(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      throw new Error(`facebook.com trả HTTP ${res.status}`);
    }

    const html = await res.text();

    // Kiểm tra xem có bị redirect sang trang login không
    if (html.includes('id="login_form"') || (html.includes("/login/") && html.length < 10_000)) {
      log.warn({ pageSlug }, "Facebook yêu cầu đăng nhập — page có thể không công khai");
      failedPageUntil.set(key, Date.now() + FAILURE_COOLDOWN_MS);
      return [];
    }

    const posts = parseEmbeddedJsonPosts(html, pageSlug, maxPosts);

    if (posts.length === 0) {
      // Không set cooldown vì page có thể chỉ là chưa có bài mới
      log.debug({ pageSlug, htmlLength: html.length }, "Không tìm thấy bài viết trong HTML");
    } else {
      failedPageUntil.delete(key);
    }

    log.info({ pageSlug, postCount: posts.length }, "Đã cào bài công khai từ facebook.com");

    return posts;
  } catch (err) {
    failedPageUntil.set(key, Date.now() + FAILURE_COOLDOWN_MS);
    log.warn({ err, pageSlug }, "Lỗi khi cào Facebook page công khai");
    return [];
  }
}

/**
 * Parse bài viết từ JSON data nhúng trong HTML pre-rendered.
 *
 * Facebook nhúng dữ liệu bài viết trong HTML dưới dạng JSON, bao gồm:
 * - "message":{"text":"..."} — nội dung bài viết
 * - "url":"https://www.facebook.com/permalink/..." — link bài viết
 * - "publish_time":UNIX_TIMESTAMP — thời gian đăng
 * - "photo_image":{"uri":"..."} — ảnh đính kèm
 */
function parseEmbeddedJsonPosts(html: string, pageSlug: string, maxPosts: number): ScrapedPost[] {
  const posts: ScrapedPost[] = [];
  const seenMessages = new Set<string>();

  // Pattern 1: Tìm "message":{"text":"..."} — nội dung bài viết
  const msgRe = /"message":\{"text":"(.+?)(?:"|(?=","delight_ranges))/g;
  let match: RegExpExecArray | null;

  const messages: Array<{ text: string; index: number }> = [];
  while ((match = msgRe.exec(html)) !== null) {
    const raw = match[1]!;
    // Decode unicode escapes và escaped chars
    const decoded = decodeUnicodeEscapes(raw);
    // Bỏ trùng lặp (Facebook thường nhúng mỗi bài 2-3 lần)
    const fingerprint = decoded.slice(0, 80);
    if (seenMessages.has(fingerprint)) continue;
    seenMessages.add(fingerprint);

    // Bỏ nội dung quá ngắn
    if (decoded.length < 15) continue;

    messages.push({ text: decoded, index: match.index });
  }

  // Với mỗi message, tìm permalink và publish_time xung quanh nó
  for (const msg of messages) {
    if (posts.length >= maxPosts) break;

    // Tìm permalink gần vị trí message (trong vòng 5000 chars)
    const context = html.slice(Math.max(0, msg.index - 3000), msg.index + msg.text.length + 3000);

    // permalink: "url":"https://www.facebook.com/.../posts/..."
    const linkMatch = context.match(
      /"url":"(https?:\\\/\\\/www\.facebook\.com\\\/[^"]*(?:posts|permalink|photo|videos|story)[^"]*)"/
    );
    const permalink = linkMatch
      ? linkMatch[1]!.replace(/\\\//g, "/")
      : `https://www.facebook.com/${pageSlug}`;

    // publish_time: unix timestamp
    const timeMatch = context.match(/"publish_time":(\d{10})/);
    const createdAt = timeMatch
      ? new Date(parseInt(timeMatch[1]!) * 1000).toISOString()
      : new Date().toISOString();

    // Ảnh: photo_image, full_picture, hoặc uri trong attachments
    const imgMatch = context.match(
      /"(?:photo_image|full_picture|preferred_thumbnail)"\s*:\s*\{[^}]*"uri"\s*:\s*"([^"]+scontent[^"]+)"/
    );
    const imageUrl = imgMatch ? imgMatch[1]!.replace(/\\\//g, "/") : null;

    // Post ID từ URL hoặc content-based
    const postId = extractPostIdFromUrl(permalink) ?? `scraped_${hashCode(msg.text)}`;

    posts.push({
      postId,
      message: msg.text.slice(0, 1000),
      permalink,
      imageUrl,
      createdAt,
    });
  }

  return posts;
}

/** Decode unicode escapes (\\uXXXX) và escaped chars (\\n, \\/) */
function decodeUnicodeEscapes(str: string): string {
  return str
    .replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

/** Trích postId từ URL Facebook */
function extractPostIdFromUrl(url: string): string | null {
  // /posts/123
  const postMatch = url.match(/\/posts\/(\d+)/);
  if (postMatch) return postMatch[1]!;

  // /permalink/123
  const permalinkMatch = url.match(/\/permalink\/(\d+)/);
  if (permalinkMatch) return permalinkMatch[1]!;

  // story_fbid=123
  const storyMatch = url.match(/story_fbid=(\d+)/);
  if (storyMatch) return storyMatch[1]!;

  // /photo/...?fbid=123
  const photoMatch = url.match(/fbid=(\d+)/);
  if (photoMatch) return photoMatch[1]!;

  return null;
}

/** Simple string hash for generating stable IDs */
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}
