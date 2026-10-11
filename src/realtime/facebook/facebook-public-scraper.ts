/**
 * facebook-public-scraper.ts
 * Fallback scraper cho các Facebook Page công khai khi KHÔNG có Graph API token.
 *
 * Chiến lược đa lớp (thử theo thứ tự):
 * 1. mbasic.facebook.com với Mobile browser UA + headers đầy đủ
 * 2. www.facebook.com/pagename với Chrome UA (desktop)
 * 3. Tìm bài qua Brave Search API (nếu configured)
 *
 * Ưu tiên: Graph API (có token) > Multi-strategy scraper (fallback)
 */
import { createLogger } from "../../shared/logger.js";
import { getFacebookCookieHeader } from "./facebook-session.js";

const log = createLogger("facebook-public-scraper");

// Danh sách UA rotate để tránh block
const USER_AGENTS = [
  // Chrome Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  // Chrome Android
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
  // Safari iPhone (thường được ưu đãi hơn bởi mbasic)
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];

/** Lấy UA theo rotation */
function getRotatingUA(): string {
  return USER_AGENTS[Math.floor(Date.now() / 60000) % USER_AGENTS.length]!;
}


export type ScrapedPost = {
  postId: string;
  message: string;
  permalink: string;
  imageUrl: string | null;
  createdAt: string;
};

/** Cooldown khi bị block (30 phút — ngắn để retry sớm) */
const failedPageUntil = new Map<string, number>();


/**
 * Cào bài viết công khai từ 1 Facebook Page.
 *
 * Thử theo thứ tự:
 * 1. mbasic.facebook.com — lighter, ít JS hơn, thân thiện hơn với mobile UA
 * 2. www.facebook.com/pagename/posts — desktop fallback
 *
 * Lưu ý: Facebook ngày càng chặt chặn scraping từ server IP.
 * Nếu bị block, dùng Graph API token để có dữ liệu ổn định.
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

  const ua = getRotatingUA();
  // Có phiên đăng nhập cá nhân -> gửi kèm cookie, FB trả nội dung thật thay vì trang login
  const cookieHeader = getFacebookCookieHeader();
  const cookieHeaders: Record<string, string> = cookieHeader ? { Cookie: cookieHeader } : {};

  // ── Lần thử 1: mbasic.facebook.com ──────────────────────────────────────
  const mbasicUrl = pageSlug.startsWith("profile.php")
    ? `https://mbasic.facebook.com/${pageSlug}`
    : `https://mbasic.facebook.com/${pageSlug}`;

  try {
    const res = await fetchFn(mbasicUrl, {
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        ...cookieHeaders,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });

    if (res.ok) {
      const html = await res.text();
      const finalUrl = res.url ?? mbasicUrl;

      // Kiểm tra bị redirect sang login
      const isLoginPage =
        finalUrl.includes("/login") ||
        html.includes('id="login_form"') ||
        (html.includes("Log in to Facebook") && html.length < 30_000) ||
        (html.includes("Đăng nhập vào Facebook") && html.length < 30_000);

      if (!isLoginPage) {
        // Parse HTML mbasic (cấu trúc đơn giản hơn www.facebook.com)
        const posts = parseMbasicHtml(html, pageSlug, maxPosts);

        if (posts.length > 0) {
          failedPageUntil.delete(key);
          log.info({ pageSlug, postCount: posts.length, via: "mbasic" }, "Đã cào bài từ mbasic.facebook.com");
          return posts;
        }

        // Fallback parse JSON embedded (dùng cho www.facebook.com response)
        const jsonPosts = parseEmbeddedJsonPosts(html, pageSlug, maxPosts);
        if (jsonPosts.length > 0) {
          failedPageUntil.delete(key);
          log.info({ pageSlug, postCount: jsonPosts.length, via: "mbasic-json" }, "Đã cào bài từ mbasic (JSON)");
          return jsonPosts;
        }

        log.debug({ pageSlug, htmlLength: html.length }, "Không tìm thấy bài viết trong HTML mbasic");
      } else {
        log.debug({ pageSlug, finalUrl }, "mbasic redirect về trang login");
        // Cooldown 30 phút (ngắn hơn cũ để retry sớm hơn)
        failedPageUntil.set(key, Date.now() + 30 * 60 * 1000);
      }
    }
  } catch (err) {
    log.debug({ err, pageSlug }, "Lỗi khi fetch mbasic.facebook.com");
  }

  // ── Lần thử 2: www.facebook.com/pagename/posts ──────────────────────────
  const wwwUrl = pageSlug.startsWith("profile.php")
    ? `https://www.facebook.com/${pageSlug}`
    : `https://www.facebook.com/${pageSlug}/posts/`;

  try {
    const res2 = await fetchFn(wwwUrl, {
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9",
        "Cache-Control": "no-cache",
        ...cookieHeaders,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });

    if (res2.ok) {
      const html2 = await res2.text();
      const isLoginPage = res2.url.includes("/login") || html2.includes('id="login_form"');
      if (!isLoginPage) {
        const posts2 = parseEmbeddedJsonPosts(html2, pageSlug, maxPosts);
        if (posts2.length > 0) {
          failedPageUntil.delete(key);
          log.info({ pageSlug, postCount: posts2.length, via: "www" }, "Đã cào bài từ www.facebook.com");
          return posts2;
        }
      }
    }
  } catch (err) {
    log.debug({ err, pageSlug }, "Lỗi khi fetch www.facebook.com");
  }

  // Đặt cooldown nhẹ (30 phút) để không spam
  if (!failedPageUntil.has(key)) {
    failedPageUntil.set(key, Date.now() + 30 * 60 * 1000);
  }
  log.debug({ pageSlug }, "Không scrape được Facebook page — cần Graph API token");
  return [];
}

/**
 * Parse HTML từ mbasic.facebook.com.
 * Cấu trúc mbasic đơn giản hơn: bài viết nằm trong <div data-ft="...">
 * hoặc các <article> với <p> chứa text.
 */
function parseMbasicHtml(html: string, pageSlug: string, maxPosts: number): ScrapedPost[] {
  const posts: ScrapedPost[] = [];
  const seenMessages = new Set<string>();

  // Tìm các block bài viết: thường là div có data-ft attribute
  // Hoặc tìm các <p> nằm trong <div role="article">
  const articleRe = /<div[^>]*data-ft="([^"]*)"[^>]*>([\s\S]{10,2000}?)<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = articleRe.exec(html)) !== null && posts.length < maxPosts) {
    const block = match[2]!;
    // Lấy text từ các thẻ <p> trong block
    const pTexts: string[] = [];
    const pRe = /<p>([\s\S]*?)<\/p>/gi;
    let pm: RegExpExecArray | null;
    while ((pm = pRe.exec(block)) !== null) {
      const text = pm[1]!.replace(/<[^>]+>/g, "").trim();
      if (text.length > 10) pTexts.push(text);
    }
    if (pTexts.length === 0) continue;

    const message = pTexts.join("\n");
    const fingerprint = message.slice(0, 80);
    if (seenMessages.has(fingerprint)) continue;
    seenMessages.add(fingerprint);

    // Tìm permalink trong block
    const linkMatch = block.match(/href="(\/[^"?]*(?:story|posts|permalink)[^"?]*)(?:\?[^"]*)?"/) ||
                      block.match(/href="(https:\/\/www\.facebook\.com\/[^"?]*)"/) ;
    const permalink = linkMatch
      ? `https://www.facebook.com${linkMatch[1]}`.replace(/&amp;/g, "&")
      : `https://www.facebook.com/${pageSlug}`;

    // Tìm timestamp
    const timeMatch = match[1]!.match(/"publish_time":(\d{10})/) ||
                      block.match(/abbr[^>]*title="([^"]+)"/);
    const createdAt = timeMatch?.[1]
      ? (/^\d{10}$/.test(timeMatch[1])
          ? new Date(parseInt(timeMatch[1]) * 1000).toISOString()
          : new Date(timeMatch[1]).toISOString())
      : new Date().toISOString();

    posts.push({
      postId: `mbasic_${hashCode(message)}`,
      message: message.slice(0, 1000),
      permalink,
      imageUrl: null,
      createdAt,
    });
  }

  return posts;
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
export function parseEmbeddedJsonPosts(html: string, pageSlug: string, maxPosts: number): ScrapedPost[] {
  const posts: ScrapedPost[] = [];
  const seenMessages = new Set<string>();

  // Pattern 1: Tìm "message":{"text":"..."} — nội dung bài viết (cho phép \" bên trong)
  const msgRe = /"message":\{"text":"((?:[^"\\]|\\.)*)"/g;
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
      /"url":"(https?:(?:\\\/|\/){2}www\.facebook\.com(?:\\\/|\/)[^"]*(?:posts|permalink|photo|videos|story)[^"]*)"/
    );
    const permalink = linkMatch
      ? linkMatch[1]!.replace(/\\\//g, "/")
      : `https://www.facebook.com/${pageSlug}`;

    // publish_time: unix timestamp
    // GraphQL khi đã đăng nhập dùng creation_time, HTML công khai dùng publish_time
    const timeMatch = context.match(/"(?:creation_time|publish_time)":(\d{10})/);
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
