import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findLocation, fetchWeather } from "./weather/weather-service.js";
import { searchLamDongPlaces } from "./lamdong/lamdong-places-service.js";
import { fetchNewsArticles } from "./news/news-service.js";
import { fetchFinancialRates } from "./finance/finance-service.js";
import { parseRssXml } from "./crawler/rss-crawler.js";

describe("Realtime Services Suite", () => {
  it("findLocation nhận diện chính xác các huyện/thành phố Lâm Đồng và các tỉnh", () => {
    const dalat = findLocation("thời tiết ở đà lạt ngày mai");
    assert.ok(dalat.name.includes("Đà Lạt"));
    assert.equal(dalat.region, "lam_dong");

    const baoloc = findLocation("Bảo Lộc trời mưa không");
    assert.ok(baoloc.name.includes("Bảo Lộc"));

    const hanoi = findLocation("nhiệt độ tại Hà Nội");
    assert.ok(hanoi.name.includes("Hà Nội"));
  });

  it("fetchWeather trả về báo cáo thời tiết đầy đủ", async () => {
    // Mock fetch để test nhanh và không phụ thuộc mạng
    const mockFetch = async () => {
      return {
        ok: true,
        json: async () => ({
          current: {
            temperature_2m: 18.5,
            relative_humidity_2m: 85,
            apparent_temperature: 17.8,
            weather_code: 45,
            wind_speed_10m: 8.2,
            precipitation_probability: 20,
          },
          daily: {
            time: ["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23"],
            weather_code: [45, 1, 61, 2],
            temperature_2m_max: [24, 25, 23, 24],
            temperature_2m_min: [15, 14, 16, 15],
          },
        }),
      } as unknown as Response;
    };

    const report = await fetchWeather("Đà Lạt", mockFetch as typeof fetch);
    assert.equal(report.temperature, 18.5);
    assert.ok(report.isLamDong);
    assert.ok(report.rawSummary.includes("Đà Lạt"));
    assert.ok(report.rawSummary.includes("Sương mù"));
  });

  it("searchLamDongPlaces tìm đúng các quán ăn và resort nổi tiếng", async () => {
    const resLae = await searchLamDongPlaces("lẩu gà lá é");
    assert.ok(resLae.places.length > 0);
    assert.ok(resLae.places.some((p) => p.name.includes("Tao Ngộ") || p.name.includes("É Tre")));

    const resResort = await searchLamDongPlaces("Tuyền Lâm", "khach_san_resort");
    assert.ok(resResort.places.some((p) => p.name.includes("Terracotta")));
  });

  it("parseRssXml bóc tách chính xác các bài viết từ RSS Feed", () => {
    const xml = `
    <rss version="2.0">
      <channel>
        <title>Báo Lâm Đồng</title>
        <item>
          <title><![CDATA[Lâm Đồng đẩy mạnh chuyển đổi số 2026]]></title>
          <link>https://baolamdong.vn/thoi-su/202608/chuyen-doi-so.html</link>
          <pubDate>Thu, 20 Aug 2026 08:00:00 +0700</pubDate>
          <description><![CDATA[Toàn tỉnh quyết liệt triển khai hạ tầng số.]]></description>
        </item>
      </channel>
    </rss>`;

    const items = parseRssXml(xml, "Báo Lâm Đồng", 5);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.title, "Lâm Đồng đẩy mạnh chuyển đổi số 2026");
    assert.equal(items[0]!.source, "Báo Lâm Đồng");
  });

  it("fetchFinancialRates trả về tóm tắt cấu trúc tài chính", async () => {
    const report = await fetchFinancialRates("gold");
    assert.equal(report.type, "gold");
    assert.ok(report.formattedText.includes("Giá vàng"));
  });

  it("fetchNewsArticles trả về danh mục tin tức", async () => {
    const res = await fetchNewsArticles("lam_dong");
    assert.equal(res.category, "lam_dong");
    assert.ok(res.formattedSummary.includes("Lâm Đồng"));
  });
});
