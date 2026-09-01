import { crawlRssFeed } from "../crawler/rss-crawler.js";
import { searchWeb } from "../../shared/web-search-providers.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("news-service");

export type NewsCategory = "lam_dong" | "kinh_te" | "xa_hoi" | "quoc_phong_an_ninh" | "cntt" | "tong_hop";

export type NewsArticle = {
  title: string;
  link: string;
  source: string;
  snippet: string;
  pubDate?: string;
};

export async function fetchNewsArticles(
  category: NewsCategory = "tong_hop",
  query?: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ category: NewsCategory; articles: NewsArticle[]; formattedSummary: string }> {
  const articles: NewsArticle[] = [];
  const todayStr = new Date().toLocaleDateString("vi-VN");

  // 1. Thử cào RSS feeds theo chuyên mục
  if (category === "lam_dong" || category === "tong_hop") {
    // Thử cào RSS từ Báo Lâm Đồng hoặc Cổng TTĐT
    const ldRss = await crawlRssFeed("https://baolamdong.vn/rss/thoi-su.rss", "Báo Lâm Đồng", 4, fetchFn);
    for (const item of ldRss) {
      articles.push({
        title: item.title,
        link: item.link,
        source: item.source,
        snippet: item.description,
        pubDate: item.pubDate,
      });
    }
  }

  if (category === "cntt" || category === "tong_hop") {
    const vnIct = await crawlRssFeed("https://vietnamnet.vn/rss/cong-nghe.rss", "VietNamNet Công Nghệ", 3, fetchFn);
    for (const item of vnIct) {
      articles.push({
        title: item.title,
        link: item.link,
        source: item.source,
        snippet: item.description,
        pubDate: item.pubDate,
      });
    }
  }

  // 2. Nếu thiếu hoặc có query cụ thể, dùng tìm kiếm nâng cao với site filtering
  if (articles.length < 3 || query) {
    let siteFilter = "";
    let baseQuery = query ? query.trim() : "";

    switch (category) {
      case "lam_dong":
        siteFilter = "site:baolamdong.vn OR site:lamdong.gov.vn OR 'Lâm Đồng' OR 'Đà Lạt'";
        if (!baseQuery) baseQuery = "tin tức thời sự mới nhất Lâm Đồng";
        break;
      case "kinh_te":
        siteFilter = "site:vneconomy.vn OR site:vietnamnet.vn OR 'kinh tế Việt Nam'";
        if (!baseQuery) baseQuery = "tin tức kinh tế đầu tư thị trường mới nhất";
        break;
      case "xa_hoi":
        siteFilter = "site:chinhphu.vn OR site:nhandan.vn OR 'xã hội'";
        if (!baseQuery) baseQuery = "tin tức xã hội chính sách mới nhất";
        break;
      case "quoc_phong_an_ninh":
        siteFilter = "site:qdnd.vn OR site:cand.com.vn OR site:bocongan.gov.vn";
        if (!baseQuery) baseQuery = "quốc phòng an ninh trật tự mới nhất";
        break;
      case "cntt":
        siteFilter = "site:mic.gov.vn OR site:vietnamnet.vn/cong-nghe OR 'chuyển đổi số'";
        if (!baseQuery) baseQuery = "công nghệ thông tin chuyển đổi số AI Việt Nam";
        break;
      default:
        siteFilter = "site:chinhphu.vn OR site:baolamdong.vn OR site:vnexpress.net";
        if (!baseQuery) baseQuery = "tin tức thời sự mới nhất Việt Nam";
        break;
    }

    try {
      const searchResults = await searchWeb(`${baseQuery} ${siteFilter}`, {
        maxResults: 6,
        fetchFn,
        preferredDomains: [
          "baolamdong.vn",
          "lamdong.gov.vn",
          "chinhphu.vn",
          "nhandan.vn",
          "qdnd.vn",
          "cand.com.vn",
          "vietnamnet.vn",
          "vneconomy.vn",
          "mic.gov.vn",
          "mps.gov.vn",
        ],
      });

      for (const r of searchResults) {
        if (!articles.some((a) => a.link === r.url || a.title === r.title)) {
          let source = "Báo chí chính thống";
          if (r.url.includes("baolamdong.vn")) source = "Báo Lâm Đồng";
          else if (r.url.includes("lamdong.gov.vn")) source = "Cổng TTĐT Lâm Đồng";
          else if (r.url.includes("chinhphu.vn")) source = "Cổng TTĐT Chính phủ";
          else if (r.url.includes("qdnd.vn")) source = "Báo Quân Đội Nhân Dân";
          else if (r.url.includes("cand.com.vn")) source = "Báo Công An Nhân Dân";
          else if (r.url.includes("nhandan.vn")) source = "Báo Nhân Dân";
          else if (r.url.includes("vietnamnet.vn")) source = "VietNamNet";

          articles.push({
            title: r.title,
            link: r.url,
            source,
            snippet: r.snippet,
          });
        }
      }
    } catch (err) {
      log.warn({ err }, "Lỗi khi tìm kiếm tin tức bổ sung");
    }
  }

  // 3. Format báo cáo tóm tắt
  let formattedSummary = `📰 **ĐIỂM BÁO & TIN TỨC THỜI SỰ (${todayStr})**\n`;
  formattedSummary += `*Chuyên mục: ${getCategoryLabel(category)}*\n\n`;

  if (articles.length === 0) {
    formattedSummary += `Hiện tại không lấy được tin tức mới nhất từ các nguồn báo chí. Vui lòng thử lại sau.\n`;
  } else {
    articles.slice(0, 6).forEach((a, i) => {
      formattedSummary += `${i + 1}. **${a.title}**\n`;
      formattedSummary += `   - Nguồn: *${a.source}*${a.pubDate ? ` (${a.pubDate})` : ""}\n`;
      if (a.snippet) formattedSummary += `   - Tóm tắt: ${a.snippet}\n`;
      formattedSummary += `   - Link: ${a.link}\n\n`;
    });
  }

  return {
    category,
    articles: articles.slice(0, 6),
    formattedSummary: formattedSummary.trim(),
  };
}

function getCategoryLabel(cat: NewsCategory): string {
  switch (cat) {
    case "lam_dong":
      return "Thời sự & Phát triển Tỉnh Lâm Đồng";
    case "kinh_te":
      return "Kinh tế & Đầu tư";
    case "xa_hoi":
      return "Chính sách & Xã hội";
    case "quoc_phong_an_ninh":
      return "Quốc phòng & An ninh trật tự";
    case "cntt":
      return "Công nghệ thông tin & Chuyển đổi số";
    default:
      return "Thời sự Tổng hợp Toàn quốc & Lâm Đồng";
  }
}
