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
 * Trả về số bài mới đã lưu.
 */
async function crawlSinglePage(page: FacebookPageConfig): Promise<number> {
  if (!page.encryptedToken) {
    log.debug({ pageId: page.pageId, pageName: page.pageName }, "Page chưa có token — bỏ qua");
    return 0;
  }

  // Giải mã token — hiện tại lưu plaintext, sau này sẽ mã hóa AES
  // TODO: decrypt bằng CREDENTIALS_ENCRYPTION_KEY khi có
  const accessToken = page.encryptedToken;

  // Lấy thời điểm bài mới nhất đã cào, chỉ lấy bài SAU đó
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
      // Bỏ qua bài không có nội dung text
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
      log.info({ pageId: page.pageId, pageName: page.pageName, newCount }, "Đã cào bài mới từ Facebook");
    }

    return newCount;
  } catch (err) {
    log.warn({ err, pageId: page.pageId, pageName: page.pageName }, "Lỗi cào Facebook page");
    return 0;
  }
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
