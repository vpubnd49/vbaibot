import { LAM_DONG_PLACES, type LamDongPlace, type PlaceCategory } from "./lamdong-places-data.js";
import { normalizeVietnamese } from "../../legal/domain/normalize-vietnamese.js";
import { searchWeb } from "../../shared/web-search-providers.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("lamdong-places");

export type PlacesSearchResult = {
  places: LamDongPlace[];
  onlineResults?: { title: string; snippet: string; url: string }[];
  formattedSummary: string;
};

export async function searchLamDongPlaces(
  query: string,
  category?: PlaceCategory,
  fetchFn: typeof fetch = fetch,
): Promise<PlacesSearchResult> {
  const normQuery = normalizeVietnamese(query);
  const matchedPlaces: LamDongPlace[] = [];

  // 1. Tìm trong CSDL curated offline
  for (const place of LAM_DONG_PLACES) {
    if (category && place.category !== category) continue;

    const normName = normalizeVietnamese(place.name);
    const normSpecialty = normalizeVietnamese(place.specialty);
    const normAddress = normalizeVietnamese(place.address);
    const normHighlights = normalizeVietnamese(place.highlights.join(" "));

    if (
      !query ||
      normName.includes(normQuery) ||
      normSpecialty.includes(normQuery) ||
      normAddress.includes(normQuery) ||
      normHighlights.includes(normQuery) ||
      normQuery.includes(normName)
    ) {
      matchedPlaces.push(place);
    }
  }

  // 2. Nếu tìm kiếm chưa đủ hoặc cần tìm địa điểm mới/cụ thể, cào thêm từ Web
  let onlineResults: { title: string; snippet: string; url: string }[] | undefined;
  if (matchedPlaces.length < 3) {
    try {
      const searchTerms = `địa điểm ${query} Lâm Đồng Đà Lạt Bảo Lộc review quán hot`;
      const results = await searchWeb(searchTerms, { maxResults: 4, fetchFn });
      if (results.length > 0) {
        onlineResults = results.map((r) => ({
          title: r.title,
          snippet: r.snippet,
          url: r.url,
        }));
      }
    } catch (err) {
      log.warn({ err }, "Lỗi khi tìm kiếm địa điểm Lâm Đồng từ web");
    }
  }

  // 3. Format báo cáo chi tiết
  let summary = `🌲 **CẨM NANG ĐỊA ĐIỂM DU LỊCH, ẨM THỰC & LƯU TRÚ LÂM ĐỒNG**\n`;
  if (query) summary += `*Yêu cầu tra cứu: "${query}"*\n\n`;

  if (matchedPlaces.length > 0) {
    matchedPlaces.slice(0, 5).forEach((p, idx) => {
      summary += `${idx + 1}. **${p.name}** [${getCategoryLabel(p.category)}]\n`;
      summary += `   - 📍 **Địa chỉ**: ${p.address}\n`;
      summary += `   - 🍲 **Đặc sắc**: ${p.specialty}\n`;
      summary += `   - ⭐ **Điểm nổi bật**: ${p.highlights.join(" • ")}\n`;
      summary += `   - 💵 **Mức giá**: ${p.priceRange}\n\n`;
    });
  }

  if (onlineResults && onlineResults.length > 0) {
    summary += `🌐 **Thông tin cập nhật mới nhất từ cộng đồng:**\n`;
    for (const r of onlineResults.slice(0, 3)) {
      summary += `- **${r.title}**\n`;
      if (r.snippet) summary += `  ${r.snippet}\n`;
      summary += `  Link: ${r.url}\n`;
    }
  }

  if (matchedPlaces.length === 0 && (!onlineResults || onlineResults.length === 0)) {
    summary += `Không tìm thấy địa điểm cụ thể khớp với "${query}". Bạn có thể thử tìm với các từ khóa như: lẩu gà lá é, lẩu bò, cafe săn mây, resort Tuyền Lâm, khách sạn trung tâm Đà Lạt...`;
  }

  return {
    places: matchedPlaces.slice(0, 5),
    onlineResults,
    formattedSummary: summary.trim(),
  };
}

function getCategoryLabel(cat: PlaceCategory): string {
  switch (cat) {
    case "an_uong":
      return "Ẩm thực & Quán ngon";
    case "nha_hang":
      return "Nhà hàng & Cơm niêu";
    case "cafe_view":
      return "Cafe Săn mây / Acoustic";
    case "khach_san_resort":
      return "Khách sạn & Resort";
    case "homestay_glamping":
      return "Homestay & Glamping";
    default:
      return "Điểm đến Lâm Đồng";
  }
}
