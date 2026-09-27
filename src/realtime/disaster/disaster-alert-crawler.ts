/**
 * disaster-alert-crawler.ts
 * Cào bài viết từ Facebook Pages, RSS Báo Lâm Đồng, NCHMF và lọc nội dung
 * liên quan thiên tai để phát hiện cảnh báo sạt lở / mưa bão / ngập lụt /
 * hồ đập xả lũ cho toàn tỉnh Lâm Đồng (mới).
 *
 * Chạy mỗi 15 phút, ưu tiên nguồn Facebook và báo địa phương vì cập nhật
 * nhanh nhất khi mưa gió thay đổi liên tục.
 *
 * Luồng: Cào → Lọc keyword → Phân loại type + area → Xác định level → Lưu store
 */
import { createLogger } from "../../shared/logger.js";
import { crawlRssFeed } from "../crawler/rss-crawler.js";
import { listRecentPosts } from "../facebook/facebook-page-store.js";
import { checkAndBroadcastDisasterAlert } from "../../scheduler/disaster-alert-broadcast.js";
import {
  detectDisasterTypes,
  detectArea,
  isDisasterRelated,
  type DisasterType,
} from "./disaster-keywords.js";
import {
  upsertDisasterAlert,
  alertExistsBySourceUrl,
  cleanupExpiredAlerts,
  type AlertLevel,
} from "./disaster-alert-store.js";

const log = createLogger("disaster-crawler");

let crawlTimer: ReturnType<typeof setInterval> | null = null;
let isCrawling = false;

/** Khoảng cách mặc định giữa các lần cào: 15 phút */
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

/** Thời hạn cảnh báo mặc định: 24 giờ */
const ALERT_EXPIRY_HOURS = 24;

// ───── RSS Feeds theo dõi thiên tai ─────────────────────────────────────────

const DISASTER_RSS_FEEDS = [
  ["https://baolamdong.vn/rss/thoi-su", "Báo Lâm Đồng - Thời sự"],
  ["https://baolamdong.vn/rss/doi-song", "Báo Lâm Đồng - Đời sống"],
  ["https://lamdong.gov.vn/rss/tin-tuc-su-kien", "Cổng TTĐT Lâm Đồng"],
] as const;

// ───── Tạo ID duy nhất cho mỗi cảnh báo ────────────────────────────────────

function makeAlertId(sourceUrl: string, type: DisasterType): string {
  let hash = 0;
  const str = `${sourceUrl}:${type}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `da_${Math.abs(hash).toString(36)}`;
}

// ───── Đánh giá mức cảnh báo sơ bộ từ nội dung ─────────────────────────────

/**
 * Xác định mức cảnh báo dựa trên nội dung + nguồn.
 *
 * Logic:
 * - red: công điện khẩn, vỡ đập, sạt lở nghiêm trọng
 * - orange: xả lũ, sạt lở, mưa rất to, cấm lưu thông
 * - yellow: mưa lớn, cảnh báo chung, nguy cơ
 * - green: không liên quan thiên tai
 */
function assessAlertLevel(
  text: string,
  types: DisasterType[],
  sourceName: string,
): AlertLevel {
  const lower = text.toLowerCase();

  // === MỨC ĐỎ — Khẩn cấp ===
  const redKeywords = [
    "công điện khẩn", "vỡ đập", "nứt đập", "sự cố đập",
    "sạt lở nghiêm trọng", "chết người", "mất tích",
    "cấp độ 4", "cấp độ 5", "siêu bão",
    "sơ tán khẩn", "di dời khẩn",
  ];
  if (redKeywords.some((kw) => lower.includes(kw))) return "red";

  // === MỨC CAM — Nghiêm trọng ===
  const orangeKeywords = [
    "xả lũ", "xả tràn", "xả đáy", "cấm lưu thông",
    "chia cắt", "mưa rất to", "mưa cực đoan",
    "lũ quét", "ngập nặng", "sạt lở",
    "cấp độ 3", "báo động 3",
  ];
  if (orangeKeywords.some((kw) => lower.includes(kw))) return "orange";

  // Nguồn chính thống (BCH Phòng thủ Dân sự, NCHMF) → tăng lên cam
  const officialSources = [
    "phòng thủ dân sự", "PTDS", "NCHMF", "khí tượng thủy văn",
    "BCH PTDS", "ban chỉ huy",
  ];
  if (officialSources.some((s) => sourceName.toLowerCase().includes(s.toLowerCase()) || lower.includes(s.toLowerCase()))) {
    if (types.includes("landslide") || types.includes("flood") || types.includes("reservoir")) {
      return "orange";
    }
  }

  // === MỨC VÀNG — Cảnh báo ===
  if (types.length > 0) return "yellow";

  return "green";
}

// ───── Cào từ Facebook (cache sẵn có) ───────────────────────────────────────

type CrawledAlert = {
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: string;
  types: DisasterType[];
  area: string;
  level: AlertLevel;
};

function scanFacebookPosts(): CrawledAlert[] {
  const alerts: CrawledAlert[] = [];

  // Lấy 30 bài mới nhất từ cache (đã cào bởi facebook-page-crawler)
  const posts = listRecentPosts(30);

  for (const post of posts) {
    if (!isDisasterRelated(post.message)) continue;

    const types = detectDisasterTypes(post.message);
    if (types.length === 0) continue;

    const area = detectArea(post.message);
    const title = post.message.split("\n")[0]?.slice(0, 100) ?? "Cảnh báo thiên tai";
    const level = assessAlertLevel(post.message, types, post.pageName);

    if (level === "green") continue;

    alerts.push({
      title,
      summary: post.message.length > 500 ? post.message.slice(0, 497) + "..." : post.message,
      sourceUrl: post.permalink,
      sourceName: `FB: ${post.pageName}`,
      publishedAt: post.createdAt,
      types,
      area,
      level,
    });
  }

  return alerts;
}

// ───── Cào từ RSS Feeds ─────────────────────────────────────────────────────

async function scanRssFeeds(fetchFn: typeof fetch = fetch): Promise<CrawledAlert[]> {
  const alerts: CrawledAlert[] = [];

  const results = await Promise.allSettled(
    DISASTER_RSS_FEEDS.map(([url, source]) => crawlRssFeed(url, source, 8, fetchFn)),
  );

  for (const r of results) {
    if (r.status !== "fulfilled") continue;

    for (const item of r.value) {
      const combined = `${item.title} ${item.description}`;
      if (!isDisasterRelated(combined)) continue;

      const types = detectDisasterTypes(combined);
      if (types.length === 0) continue;

      const area = detectArea(combined);
      const level = assessAlertLevel(combined, types, item.source);

      if (level === "green") continue;

      alerts.push({
        title: item.title,
        summary: item.description.length > 500 ? item.description.slice(0, 497) + "..." : item.description,
        sourceUrl: item.link,
        sourceName: item.source,
        publishedAt: item.pubDate || new Date().toISOString(),
        types,
        area,
        level,
      });
    }
  }

  return alerts;
}

// ───── Lưu cảnh báo vào store (dedup) ───────────────────────────────────────

function saveAlerts(alerts: CrawledAlert[]): number {
  let saved = 0;

  for (const alert of alerts) {
    // Dedup: bỏ qua nếu source URL đã có
    if (alertExistsBySourceUrl(alert.sourceUrl)) continue;

    const expiresAt = new Date(
      Date.now() + ALERT_EXPIRY_HOURS * 60 * 60 * 1000,
    ).toISOString();

    // Tạo 1 alert cho mỗi disaster type phát hiện
    for (const type of alert.types) {
      const id = makeAlertId(alert.sourceUrl, type);
      upsertDisasterAlert({
        id,
        level: alert.level,
        type,
        area: alert.area,
        title: alert.title,
        summary: alert.summary,
        sourceUrl: alert.sourceUrl,
        sourceName: alert.sourceName,
        publishedAt: alert.publishedAt,
        expiresAt,
      });
      saved++;
    }
  }

  return saved;
}

// ───── Chạy 1 lượt cào ─────────────────────────────────────────────────────

export async function runDisasterCrawl(
  fetchFn: typeof fetch = fetch,
): Promise<{ totalNew: number; fromFacebook: number; fromRss: number }> {
  if (isCrawling) {
    log.debug("Đang cào thiên tai, bỏ qua lượt này");
    return { totalNew: 0, fromFacebook: 0, fromRss: 0 };
  }

  isCrawling = true;
  try {
    // 1. Quét Facebook cache
    const fbAlerts = scanFacebookPosts();

    // 2. Quét RSS feeds
    const rssAlerts = await scanRssFeeds(fetchFn);

    // 3. Lưu tất cả vào store
    const allAlerts = [...fbAlerts, ...rssAlerts];
    const totalNew = saveAlerts(allAlerts);

    // 4. Dọn cảnh báo cũ
    cleanupExpiredAlerts();

    if (totalNew > 0) {
      log.info(
        {
          totalNew,
          fromFacebook: fbAlerts.length,
          fromRss: rssAlerts.length,
          totalScanned: allAlerts.length,
        },
        "Phát hiện cảnh báo thiên tai mới",
      );

      // 5. Kiểm tra và gửi broadcast khẩn nếu mức cam/đỏ
      checkAndBroadcastDisasterAlert().catch((err) => {
        log.error({ err }, "Lỗi khi broadcast cảnh báo thiên tai");
      });
    }

    return {
      totalNew,
      fromFacebook: fbAlerts.length,
      fromRss: rssAlerts.length,
    };
  } catch (err) {
    log.error({ err }, "Lỗi khi cào cảnh báo thiên tai");
    return { totalNew: 0, fromFacebook: 0, fromRss: 0 };
  } finally {
    isCrawling = false;
  }
}

// ───── Cron job ─────────────────────────────────────────────────────────────

/**
 * Khởi động crawler thiên tai, chạy mỗi 15 phút.
 * Gọi 1 lần khi bot start.
 */
export function startDisasterCrawler(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (crawlTimer) {
    log.warn("Disaster crawler đã đang chạy");
    return;
  }

  log.info({ intervalMinutes: intervalMs / 60_000 }, "Khởi động disaster alert crawler");

  // Chạy ngay lần đầu (sau 15s delay để FB crawler chạy trước)
  setTimeout(() => {
    runDisasterCrawl().catch((err) => {
      log.error({ err }, "Lỗi lần cào thiên tai đầu tiên");
    });
  }, 15_000);

  // Lặp lại mỗi interval
  crawlTimer = setInterval(() => {
    runDisasterCrawl().catch((err) => {
      log.error({ err }, "Lỗi lượt cào thiên tai định kỳ");
    });
  }, intervalMs);
}

/**
 * Dừng crawler thiên tai.
 */
export function stopDisasterCrawler(): void {
  if (crawlTimer) {
    clearInterval(crawlTimer);
    crawlTimer = null;
    log.info("Đã dừng disaster alert crawler");
  }
}
