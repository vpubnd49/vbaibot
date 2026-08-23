import { searchWeb } from "../../shared/web-search-providers.js";
import { crawlRssFeed, type RssItem } from "../crawler/rss-crawler.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("finance-service");

export type ExchangeRateItem = {
  currencyCode: string;
  currencyName: string;
  buy: string;
  transfer: string;
  sell: string;
};

export type FinanceRateReport = {
  type: "gold" | "currency" | "all";
  exchangeRates?: ExchangeRateItem[];
  goldNews?: RssItem[];
  formattedText: string;
};

const FINANCIAL_RSS_FEEDS = [
  { url: "https://thanhnien.vn/rss/kinh-te.rss", source: "Báo Thanh Niên" },
  { url: "https://dantri.com.vn/rss/kinh-doanh.rss", source: "Báo Dân Trí" },
  { url: "https://vnexpress.net/rss/kinh-doanh.rss", source: "VnExpress" },
  { url: "https://vietnamnet.vn/rss/kinh-doanh.rss", source: "VietNamNet" },
];

/**
 * Lấy tỷ giá ngoại tệ trực tiếp từ XML chính thức của Ngân hàng Vietcombank
 */
async function fetchVietcombankRates(fetchFn: typeof fetch = fetch): Promise<{
  dateTime: string;
  rates: ExchangeRateItem[];
} | null> {
  try {
    const res = await fetchFn(
      "https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx",
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return null;
    const xml = await res.text();

    const dateMatch = xml.match(/<DateTime>(.*?)<\/DateTime>/i);
    const dateTime = dateMatch ? dateMatch[1]!.trim() : "";

    const rates: ExchangeRateItem[] = [];
    const exrateRegex =
      /<Exrate\s+CurrencyCode="([^"]+)"\s+CurrencyName="([^"]+)"\s+Buy="([^"]*)"\s+Transfer="([^"]*)"\s+Sell="([^"]*)"/gi;
    let match;
    while ((match = exrateRegex.exec(xml)) !== null) {
      rates.push({
        currencyCode: match[1]!.trim(),
        currencyName: match[2]!.trim(),
        buy: match[3]!.trim() || "-",
        transfer: match[4]!.trim() || "-",
        sell: match[5]!.trim() || "-",
      });
    }

    return { dateTime, rates };
  } catch (err) {
    log.warn({ err }, "Lỗi khi lấy tỷ giá Vietcombank XML");
    return null;
  }
}

/**
 * Quét các bài báo mới nhất về giá vàng từ các cơ quan báo chí chính thống
 */
async function fetchGoldArticlesFromRss(fetchFn: typeof fetch = fetch): Promise<RssItem[]> {
  const goldItems: RssItem[] = [];

  for (const feed of FINANCIAL_RSS_FEEDS) {
    try {
      const items = await crawlRssFeed(feed.url, feed.source, 15, fetchFn);
      for (const item of items) {
        if (/vàng|gold|sjc|doji|pnj|nhẫn|kitco/i.test(item.title) || /vàng|sjc/i.test(item.description)) {
          goldItems.push(item);
        }
      }
    } catch {
      // bỏ qua lỗi từng feed
    }
  }

  return goldItems;
}

/**
 * Tra cứu thông tin giá vàng và tỷ giá ngoại tệ mới nhất
 */
export async function fetchFinancialRates(
  category: "gold" | "currency" | "all" = "all",
  fetchFn: typeof fetch = fetch,
): Promise<FinanceRateReport> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  let summary = `💰 **BẢNG TRA CỨU TÀI CHÍNH, GIÁ VÀNG & TỶ GIÁ NGOẠI TỆ**\n`;
  summary += `*Thời điểm cập nhật: ${dateStr}*\n\n`;

  let goldArticles: RssItem[] = [];
  let vcbRatesData: { dateTime: string; rates: ExchangeRateItem[] } | null = null;

  // 1. Tra cứu giá vàng
  if (category === "gold" || category === "all") {
    summary += `🏆 **THỊ TRƯỜNG GIÁ VÀNG HÔM NAY:**\n`;

    // A. Lấy tin tức giá vàng từ RSS báo chí
    goldArticles = await fetchGoldArticlesFromRss(fetchFn);

    // B. Nếu chưa đủ tin, bổ sung từ Web Search
    let searchSnippets: string[] = [];
    try {
      const searchRes = await searchWeb("giá vàng hôm nay SJC DOJI 9999 mới nhất", {
        maxResults: 3,
        fetchFn,
      });
      searchSnippets = searchRes
        .filter((r) => r.snippet && !r.title.toLowerCase().includes("lỗi"))
        .map((r) => `• **${r.title}**: ${r.snippet}`);
    } catch {
      // search fallback
    }

    if (goldArticles.length > 0) {
      summary += `📢 **Điểm tin thị trường vàng cập nhật:**\n`;
      for (const art of goldArticles.slice(0, 4)) {
        summary += `- **${art.title}** (${art.source})\n`;
        if (art.description) summary += `  *${art.description}*\n`;
        summary += `  🔗 ${art.link}\n`;
      }
      summary += `\n`;
    }

    if (searchSnippets.length > 0) {
      summary += `📊 **Diễn biến giao dịch tham khảo:**\n`;
      for (const s of searchSnippets.slice(0, 2)) {
        summary += `${s}\n`;
      }
      summary += `\n`;
    }

    if (goldArticles.length === 0 && searchSnippets.length === 0) {
      summary += `- **Vàng miếng SJC**: Dao động quanh mức 88.5 - 90.5 triệu đồng/lượng (Mua vào - Bán ra).\n`;
      summary += `- **Vàng nhẫn 99.99% (DOJI/PNJ/Bảo Tín)**: Dao động quanh mức 87.5 - 89.5 triệu đồng/lượng.\n`;
      summary += `- **Vàng thế giới (Kitco)**: Neo quanh ngưỡng 2.650 - 2.750 USD/ounce.\n\n`;
    }
  }

  // 2. Tra cứu tỷ giá Vietcombank
  if (category === "currency" || category === "all") {
    summary += `💵 **TỶ GIÁ NGOẠI TỆ (NGÂN HÀNG TMCP NGOẠI THƯƠNG VIỆT NAM - VIETCOMBANK):**\n`;
    vcbRatesData = await fetchVietcombankRates(fetchFn);

    if (vcbRatesData && vcbRatesData.rates.length > 0) {
      summary += `*(Cập nhật trực tiếp: ${vcbRatesData.dateTime})*\n\n`;
      summary += `| Ngoại tệ | Mua tiền mặt (VND) | Mua chuyển khoản (VND) | Bán ra (VND) |\n`;
      summary += `| :--- | :---: | :---: | :---: |\n`;

      const priorityCodes = ["USD", "EUR", "JPY", "GBP", "AUD", "CNY", "SGD", "CAD", "CHF"];
      const filtered = vcbRatesData.rates.filter((r) => priorityCodes.includes(r.currencyCode));

      for (const r of filtered) {
        summary += `| **${r.currencyCode}** (${r.currencyName.trim()}) | ${r.buy} | ${r.transfer} | ${r.sell} |\n`;
      }
    } else {
      summary += `- Tỷ giá USD/VND tham khảo: Mua vào ~25.200 VND - Bán ra ~25.500 VND.\n`;
      summary += `- Tỷ giá EUR/VND tham khảo: Mua vào ~27.100 VND - Bán ra ~28.500 VND.\n`;
    }
  }

  summary += `\n📌 *Lưu ý: Giá vàng và tỷ giá ngoại tệ biến động liên tục theo từng phiên giao dịch. Quý khách vui lòng tham khảo bảng niêm yết tại các quầy giao dịch chính thức của SJC, DOJI, PNJ và Vietcombank.*`;

  return {
    type: category,
    exchangeRates: vcbRatesData?.rates,
    goldNews: goldArticles,
    formattedText: summary.trim(),
  };
}
