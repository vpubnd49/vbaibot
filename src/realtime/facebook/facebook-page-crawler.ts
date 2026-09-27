/**
 * facebook-page-crawler.ts
 * Cron job cào bài viết mới từ các Facebook Page đã cấu hình.
 *
 * Chạy mỗi 30 phút (hoặc theo FACEBOOK_CRAWL_INTERVAL_MINUTES):
 * 1. Duyệt danh sách pages enabled
 * 2. Lấy bài mới qua Graph API (since = thời điểm cào cuối)
 * 3. Lưu vào SQLite cache
 * 4. Dọn bài cũ hơn 30 ngày
 *
 * Fallback: Nếu page chưa có token (chưa setup Graph API),
 * bỏ qua và log cảnh báo.
 */
import { createLogger } from "../../shared/logger.js";
import { fetchPagePosts } from "./facebook-client.js";
import { scrapePublicPagePosts } from "./facebook-public-scraper.js";
import {
  listEnabledFacebookPages,
  upsertFacebookPost,
  getLatestPostTime,
  markPageCrawled,
  cleanupOldPosts,
  type FacebookPageConfig,
} from "./facebook-page-store.js";

const log = createLogger("facebook-crawler");

let crawlTimer: ReturnType<typeof setInterval> | null = null;
let isCrawling = false;

/** Khoảng cách mặc định giữa các lần cào (ms) */
const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 phút

/**
 * Cào bài mới từ 1 page.
 * - Có token → dùng Graph API (chất lượng cao)
 * - Không token → fallback cào mbasic.facebook.com (trang công khai)
 * Trả về số bài mới đã lưu.
 */
async function crawlSinglePage(page: FacebookPageConfig): Promise<number> {
  if (page.encryptedToken) {
    // ═══ Đường 1: Graph API (có token) ═══
    return crawlViaGraphApi(page);
  }

  // ═══ Đường 2: Fallback cào trang công khai ═══
  return crawlViaPublicScraper(page);
}

/** Cào qua Graph API (cần Page Access Token) */
async function crawlViaGraphApi(page: FacebookPageConfig): Promise<number> {
  const accessToken = page.encryptedToken;
  const lastPostTime = getLatestPostTime(page.pageId);
  const since = lastPostTime ?? undefined;

  try {
    const posts = await fetchPagePosts({
      pageId: page.pageId,
      accessToken,
      limit: 10,
      since,
    });

    let newCount = 0;
    for (const post of posts) {
      if (!post.message?.trim()) continue;

      upsertFacebookPost({
        postId: post.id,
        pageId: page.pageId,
        pageName: page.pageName,
        message: post.message,
        permalink: post.permalink_url ?? `https://www.facebook.com/${post.id}`,
        imageUrl: post.full_picture ?? null,
        createdAt: post.created_time,
        category: page.category,
      });
      newCount++;
    }

    markPageCrawled(page.pageId);
    if (newCount > 0) {
      log.info({ pageId: page.pageId, pageName: page.pageName, newCount, via: "graph-api" }, "Đã cào bài mới từ Facebook");
    }
    return newCount;
  } catch (err) {
    log.warn({ err, pageId: page.pageId, pageName: page.pageName }, "Lỗi cào Facebook qua Graph API");
    return 0;
  }
}

/** Cào trang công khai qua mbasic.facebook.com (không cần token) */
async function crawlViaPublicScraper(page: FacebookPageConfig): Promise<number> {
  // Dùng page slug từ URL hoặc pageId
  const slug = extractPageSlug(page);

  try {
    const posts = await scrapePublicPagePosts(slug, 5);

    let newCount = 0;
    for (const post of posts) {
      if (!post.message?.trim()) continue;

      upsertFacebookPost({
        postId: post.postId,
        pageId: page.pageId,
        pageName: page.pageName,
        message: post.message,
        permalink: post.permalink,
        imageUrl: post.imageUrl,
        createdAt: post.createdAt,
        category: page.category,
      });
      newCount++;
    }

    markPageCrawled(page.pageId);
    if (newCount > 0) {
      log.info({ pageId: page.pageId, pageName: page.pageName, newCount, via: "public-scraper" }, "Đã cào bài công khai từ Facebook");
    }
    return newCount;
  } catch (err) {
    log.warn({ err, pageId: page.pageId, pageName: page.pageName }, "Lỗi cào Facebook page công khai");
    return 0;
  }
}

/**
 * Trích slug từ pageUrl hoặc pageId.
 * VD: "https://www.facebook.com/tintucphanthiet" → "tintucphanthiet"
 *     "https://www.facebook.com/profile.php?id=100076386510860" → "profile.php?id=100076386510860"
 */
function extractPageSlug(page: FacebookPageConfig): string {
  if (page.pageUrl) {
    try {
      const url = new URL(page.pageUrl);
      const pathname = url.pathname.replace(/^\/+|\/+$/g, "");
      if (pathname === "profile.php") {
        // profile.php?id=XXXXX
        return `profile.php?id=${url.searchParams.get("id") ?? page.pageId}`;
      }
      return pathname || page.pageId;
    } catch {
      return page.pageId;
    }
  }
  return page.pageId;
}

/**
 * Chạy 1 lượt cào tất cả pages đang enabled.
 */
export async function runFacebookCrawl(): Promise<{ totalNew: number; pagesProcessed: number }> {
  if (isCrawling) {
    log.debug("Đang cào, bỏ qua lượt này");
    return { totalNew: 0, pagesProcessed: 0 };
  }

  isCrawling = true;
  try {
    const pages = listEnabledFacebookPages();
    if (pages.length === 0) {
      return { totalNew: 0, pagesProcessed: 0 };
    }

    let totalNew = 0;
    let pagesProcessed = 0;

    for (const page of pages) {
      try {
        const newCount = await crawlSinglePage(page);
        totalNew += newCount;
        pagesProcessed++;
        // Delay 2s giữa các page để tránh rate limit
        if (pages.length > 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (err) {
        log.warn({ err, pageId: page.pageId }, "Lỗi khi cào page, tiếp tục page tiếp theo");
      }
    }

    // Dọn bài cũ mỗi lần cào
    cleanupOldPosts();

    if (totalNew > 0) {
      log.info({ totalNew, pagesProcessed, totalPages: pages.length }, "Hoàn tất lượt cào Facebook");
    }

    return { totalNew, pagesProcessed };
  } finally {
    isCrawling = false;
  }
}

/**
 * Khởi động cron job cào Facebook.
 * Gọi 1 lần khi bot start.
 */
export function startFacebookCrawler(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (crawlTimer) {
    log.warn("Facebook crawler đã đang chạy");
    return;
  }

  log.info({ intervalMinutes: intervalMs / 60_000 }, "Khởi động Facebook crawler");

  // Chạy ngay lần đầu (sau 10s delay để bot khởi động xong)
  setTimeout(() => {
    runFacebookCrawl().catch((err) => {
      log.error({ err }, "Lỗi lần cào Facebook đầu tiên");
    });
  }, 10_000);

  // Lặp lại mỗi interval
  crawlTimer = setInterval(() => {
    runFacebookCrawl().catch((err) => {
      log.error({ err }, "Lỗi lượt cào Facebook định kỳ");
    });
  }, intervalMs);
}

/**
 * Dừng cron job cào Facebook.
 */
export function stopFacebookCrawler(): void {
  if (crawlTimer) {
    clearInterval(crawlTimer);
    crawlTimer = null;
    log.info("Đã dừng Facebook crawler");
  }
}
