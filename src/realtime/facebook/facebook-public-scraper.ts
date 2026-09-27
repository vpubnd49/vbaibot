/**
 * facebook-public-scraper.ts
 * Fallback scraper cho các Facebook Page công khai khi KHÔNG có Graph API token.
 *
 * Cào bài viết từ mbasic.facebook.com/{page_id} — phiên bản mobile của Facebook
 * render HTML đơn giản, không cần JavaScript, không cần đăng nhập cho page công khai.
 *
 * Ưu tiên: Graph API (có token) > mbasic scraper (fallback)
 */
import { createLogger } from "../../shared/logger.js";
import { stripHtmlTags } from "../../shared/html-to-text.js";

const log = createLogger("facebook-public-scraper");

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36";

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
 * Cào bài viết công khai từ 1 Facebook Page qua mbasic.facebook.com.
 *
 * Lưu ý:
 * - Chỉ lấy được bài viết CÔNG KHAI (public)
 * - Không lấy được reactions, shares, comments count
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

  // Dùng mbasic.facebook.com cho HTML đơn giản
  const url = `https://mbasic.facebook.com/${pageSlug}`;

  try {
    const res = await fetchFn(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`mbasic.facebook.com trả HTTP ${res.status}`);
    }

    const html = await res.text();

    // Kiểm tra xem có bị redirect sang trang login không
    if (html.includes('id="login_form"') || html.includes("/login/")) {
      log.warn({ pageSlug }, "Facebook yêu cầu đăng nhập — page có thể không công khai");
      failedPageUntil.set(key, Date.now() + FAILURE_COOLDOWN_MS);
      return [];
    }

    const posts = parseMbasicPosts(html, pageSlug, maxPosts);

    if (posts.length === 0) {
      failedPageUntil.set(key, Date.now() + FAILURE_COOLDOWN_MS);
    } else {
      failedPageUntil.delete(key);
    }

    log.info({ pageSlug, postCount: posts.length }, "Đã cào bài công khai từ mbasic.facebook.com");

    return posts;
  } catch (err) {
    failedPageUntil.set(key, Date.now() + FAILURE_COOLDOWN_MS);
    log.warn({ err, pageSlug }, "Lỗi khi cào Facebook page công khai");
    return [];
  }
}

/**
 * Parse HTML từ mbasic.facebook.com để trích xuất bài viết.
 *
 * Cấu trúc mbasic thường có:
 * - Mỗi bài nằm trong <div> có data-ft hoặc id="u_0_..." hoặc class chứa post
 * - Nội dung text trong <p> hoặc <span>
 * - Link bài trong <a href="/story.php?..."> hoặc "/permalink/..."
 * - Thời gian trong <abbr> hoặc text "X giờ trước", "Hôm qua", ...
 */
function parseMbasicPosts(html: string, pageSlug: string, maxPosts: number): ScrapedPost[] {
  const posts: ScrapedPost[] = [];

  // Pattern 1: Tìm các article/section chứa bài viết
  // mbasic dùng <article> hoặc <div role="article"> cho mỗi bài
  const articleRe = /<article[^>]*>([\s\S]*?)<\/article>/gi;

  // Pattern 2: Fallback - tìm div có data-ft (chứa metadata bài viết)
  const dataFtRe = /<div[^>]*data-ft[^>]*>([\s\S]*?)(?=<div[^>]*data-ft|<\/section|$)/gi;

  // Pattern 3: Tìm các khối story trong mbasic
  // mbasic.facebook.com thường dùng <div id="u_0_X"> cho mỗi bài viết trong feed
  const storyRe = /<div[^>]*class="[^"]*(?:story_body_container|_55wo|_5rgt)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*(?:story_body_container|_55wo|_5rgt)|\s*$)/gi;

  // Thử pattern 1 trước
  let matches = [...html.matchAll(articleRe)];

  // Nếu không có article, thử pattern 2
  if (matches.length === 0) {
    matches = [...html.matchAll(dataFtRe)];
  }

  // Nếu vẫn không có, thử pattern 3
  if (matches.length === 0) {
    matches = [...html.matchAll(storyRe)];
  }

  // Pattern chung: tìm tất cả link /story.php hoặc /permalink
  if (matches.length === 0) {
    // Fallback cuối: parse toàn bộ page tìm các cụm text + link story
    const storyLinkRe = /href="(\/story\.php\?[^"]+|\/[^"]*\/posts\/[^"]+|\/permalink\.php\?[^"]+)"/gi;
    const storyLinks = [...html.matchAll(storyLinkRe)];

    for (const link of storyLinks.slice(0, maxPosts)) {
      const linkUrl = link[1]!;
      const fullLink = `https://www.facebook.com${linkUrl.replace(/&amp;/g, "&")}`;

      // Tìm text xung quanh link (trong vòng 2000 chars trước link)
      const linkPos = link.index!;
      const contextBefore = html.slice(Math.max(0, linkPos - 2000), linkPos);

      // Tìm text content gần nhất
      const textBlocks = contextBefore.match(/<(?:p|span|div)[^>]*>([^<]{20,})<\//g);
      const lastText = textBlocks?.[textBlocks.length - 1];
      const message = lastText ? stripHtmlTags(lastText).trim() : "";

      if (message.length > 15) {
        const postId = extractPostId(linkUrl) ?? `scraped_${Date.now()}_${posts.length}`;
        posts.push({
          postId,
          message,
          permalink: fullLink,
          imageUrl: null,
          createdAt: new Date().toISOString(), // mbasic không luôn có date rõ ràng
        });
      }
    }

    return posts;
  }

  // Parse mỗi article/div match
  for (const match of matches) {
    if (posts.length >= maxPosts) break;

    const block = match[1] ?? match[0]!;

    // Trích xuất text content (bỏ HTML tags)
    const textContent = stripHtmlTags(block).trim();
    // Lọc bỏ các block quá ngắn (navigation, button text)
    if (textContent.length < 20) continue;
    // Lọc bỏ các block là menu/navigation
    if (/^(Thích|Bình luận|Chia sẻ|Like|Comment|Share|Xem thêm|See More)$/i.test(textContent)) continue;

    // Tìm permalink
    const linkMatch = block.match(
      /href="(\/story\.php\?[^"]+|\/[^"]*\/posts\/\d+|\/permalink\.php\?[^"]+)"/,
    );
    const permalink = linkMatch
      ? `https://www.facebook.com${linkMatch[1]!.replace(/&amp;/g, "&")}`
      : `https://www.facebook.com/${pageSlug}`;

    // Tìm ảnh
    const imgMatch = block.match(/<img[^>]*src="([^"]*scontent[^"]*|[^"]*fbcdn[^"]*)"[^>]*>/i);
    const imageUrl = imgMatch ? imgMatch[1]!.replace(/&amp;/g, "&") : null;

    // Tìm thời gian
    const timeMatch = block.match(/<abbr[^>]*>([^<]+)<\/abbr>/i);
    const timeText = timeMatch ? timeMatch[1]!.trim() : "";
    const createdAt = parseVietnameseRelativeTime(timeText) ?? new Date().toISOString();

    // Tạo post ID từ link hoặc generate
    const postId = (linkMatch ? extractPostId(linkMatch[1]!) : null) ?? `scraped_${Date.now()}_${posts.length}`;

    // Cắt message hợp lý (chỉ lấy phần nội dung chính, bỏ "Thích · Bình luận · Chia sẻ")
    const cleanMessage = textContent
      .replace(/\s*(Thích|Like)\s*·?\s*(Bình luận|Comment)\s*·?\s*(Chia sẻ|Share)\s*/gi, "")
      .replace(/\s*(Xem thêm|See More)\s*/gi, "")
      .replace(/\s{3,}/g, "\n")
      .trim();

    if (cleanMessage.length > 15) {
      posts.push({
        postId,
        message: cleanMessage.slice(0, 1000), // Giới hạn 1000 ký tự
        permalink,
        imageUrl,
        createdAt,
      });
    }
  }

  return posts;
}

/** Trích postId từ URL Facebook */
function extractPostId(url: string): string | null {
  // /story.php?story_fbid=123&id=456 → "123_456"
  const storyMatch = url.match(/story_fbid=(\d+).*?[&?]id=(\d+)/);
  if (storyMatch) return `${storyMatch[2]}_${storyMatch[1]}`;

  // /posts/123 → "123"
  const postMatch = url.match(/\/posts\/(\d+)/);
  if (postMatch) return postMatch[1]!;

  // permalink.php?story_fbid=123
  const permalinkMatch = url.match(/story_fbid=(\d+)/);
  if (permalinkMatch) return permalinkMatch[1]!;

  return null;
}

/** Parse thời gian tương đối tiếng Việt → ISO date */
function parseVietnameseRelativeTime(text: string): string | null {
  if (!text) return null;

  const now = Date.now();

  // "X phút trước"
  const minuteMatch = text.match(/(\d+)\s*phút/);
  if (minuteMatch) return new Date(now - parseInt(minuteMatch[1]!) * 60_000).toISOString();

  // "X giờ trước"
  const hourMatch = text.match(/(\d+)\s*giờ/);
  if (hourMatch) return new Date(now - parseInt(hourMatch[1]!) * 3_600_000).toISOString();

  // "Hôm qua"
  if (/hôm qua/i.test(text)) return new Date(now - 86_400_000).toISOString();

  // "X ngày trước" hoặc "X ngày"
  const dayMatch = text.match(/(\d+)\s*ngày/);
  if (dayMatch) return new Date(now - parseInt(dayMatch[1]!) * 86_400_000).toISOString();

  // "X tuần"
  const weekMatch = text.match(/(\d+)\s*tuần/);
  if (weekMatch) return new Date(now - parseInt(weekMatch[1]!) * 7 * 86_400_000).toISOString();

  // "Ngày DD tháng MM" hoặc "DD tháng MM lúc HH:MM"
  const dateMatch = text.match(/(\d{1,2})\s*tháng\s*(\d{1,2})/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]!);
    const month = parseInt(dateMatch[2]!) - 1;
    const year = new Date().getFullYear();
    return new Date(year, month, day).toISOString();
  }

  // English fallback: "X hrs", "X mins"
  const hrsMatch = text.match(/(\d+)\s*hrs?/);
  if (hrsMatch) return new Date(now - parseInt(hrsMatch[1]!) * 3_600_000).toISOString();

  const minsMatch = text.match(/(\d+)\s*mins?/);
  if (minsMatch) return new Date(now - parseInt(minsMatch[1]!) * 60_000).toISOString();

  return null;
}
