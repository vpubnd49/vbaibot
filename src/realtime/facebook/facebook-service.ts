/**
 * facebook-service.ts
 * Service layer cho Facebook Page integration.
 *
 * Cung cấp API cho:
 * - Bot tool (news_lookup) — lấy tin Facebook mới nhất
 * - Dashboard — quản lý danh sách pages, xem thống kê
 * - Seed data — khởi tạo danh sách pages mặc định
 */
import { createLogger } from "../../shared/logger.js";
import {
  listRecentPosts,
  listPostsByCategory,
  listFacebookPages,
  upsertFacebookPage,
  countPosts,
  type FacebookPostRow,
  type FacebookPageConfig,
} from "./facebook-page-store.js";

const log = createLogger("facebook-service");

// ───── Danh sách pages mặc định (seed 1 lần) ────────────────────────────────

const DEFAULT_PAGES = [
  {
    // 218K followers — đăng cảnh báo đèo/sạt lở tuyến Phan Thiết–Đà Lạt real-time
    pageId: "tintucphanthiet",
    pageName: "Yêu Phan Thiết",
    pageUrl: "https://www.facebook.com/tintucphanthiet",
    category: "lam_dong",
  },
  {
    // 239K followers — "Tin tức đô đáy cập nhật từng giây" tại Đà Lạt – Lâm Đồng
    pageId: "lacaidalat",
    pageName: "Đà Lạt – Lâm Đồng",
    pageUrl: "https://www.facebook.com/lacaidalat",
    category: "lam_dong",
  },
  {
    // 1.3 triệu followers — du lịch, ẩm thực, thời tiết Đà Lạt
    pageId: "GDL.GhienDalat",
    pageName: "Ghiền Đà Lạt",
    pageUrl: "https://www.facebook.com/GDL.GhienDalat",
    category: "lam_dong",
  },
  {
    // 25K followers — Cổng TTĐT chính thống tỉnh Lâm Đồng (bbt@lamdong.gov.vn)
    pageId: "100076386510860",
    pageName: "Cổng Thông tin điện tử Lâm Đồng",
    pageUrl: "https://www.facebook.com/profile.php?id=100076386510860",
    category: "lam_dong",
  },
  {
    // Fanpage du lịch chính thức Lâm Đồng
    pageId: "dulichlamdong",
    pageName: "Du lịch Lâm Đồng",
    pageUrl: "https://www.facebook.com/dulichlamdong",
    category: "lam_dong",
  },
];


/**
 * Seed danh sách pages mặc định nếu chưa có.
 * Gọi 1 lần khi bot start.
 */
export function seedDefaultFacebookPages(): void {
  const existing = listFacebookPages();
  if (existing.length > 0) return; // Đã có dữ liệu, không seed lại

  for (const page of DEFAULT_PAGES) {
    upsertFacebookPage({
      pageId: page.pageId,
      pageName: page.pageName,
      pageUrl: page.pageUrl,
      category: page.category,
      enabled: true,
      // Token chưa có — admin nhập sau qua Dashboard
      encryptedToken: "",
    });
  }

  log.info({ count: DEFAULT_PAGES.length }, "Đã seed danh sách Facebook pages mặc định");
}

// ───── Lấy tin tức cho bot ───────────────────────────────────────────────────

/**
 * Lấy bài Facebook mới nhất, format cho bot trả lời.
 * Dùng bởi news-service.ts khi có chuyên mục Facebook.
 */
export function getLatestFacebookNews(
  category?: string,
  limit = 5,
): { posts: FacebookPostRow[]; formattedText: string } {
  const posts = category
    ? listPostsByCategory(category, limit)
    : listRecentPosts(limit);

  if (posts.length === 0) {
    return {
      posts: [],
      formattedText: "Chưa có bài viết Facebook nào trong cache. Hãy cấu hình token và chờ lần cào tiếp theo.",
    };
  }

  const lines: string[] = ["📱 **TIN TỪ FACEBOOK**\n"];

  for (const post of posts) {
    const date = new Date(post.createdAt).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Cắt message dài
    const snippet = post.message.length > 200
      ? post.message.slice(0, 197) + "..."
      : post.message;

    lines.push(`🔵 **${post.pageName}** (${date})`);
    lines.push(`${snippet}`);
    lines.push(`🔗 ${post.permalink}\n`);
  }

  return {
    posts,
    formattedText: lines.join("\n").trim(),
  };
}

// ───── Dashboard API ─────────────────────────────────────────────────────────

export type FacebookDashboardStats = {
  pages: FacebookPageConfig[];
  totalPosts: number;
};

export function getFacebookDashboardStats(): FacebookDashboardStats {
  return {
    pages: listFacebookPages(),
    totalPosts: countPosts(),
  };
}
