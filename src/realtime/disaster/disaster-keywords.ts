/**
 * disaster-keywords.ts
 * Bộ từ khóa phát hiện thiên tai cho tỉnh Lâm Đồng (mới).
 *
 * 6 nhóm: sạt lở, mưa bão, ngập lụt, hồ đập thủy điện/thủy lợi,
 * giao thông đèo, chung.
 *
 * Bao phủ toàn bộ Lâm Đồng mới = Lâm Đồng gốc + Đắk Nông + Bình Thuận
 * (NQ60/2025/QH15).
 */

export type DisasterType =
  | "landslide"
  | "storm"
  | "flood"
  | "reservoir"
  | "road_block"
  | "general";

/**
 * Từ khóa theo nhóm — dùng để lọc bài Facebook / RSS / NCHMF.
 * Match case-insensitive, đã normalize bỏ dấu khi so sánh.
 */
export const DISASTER_KEYWORDS: Record<DisasterType, readonly string[]> = {
  // --- Sạt lở ---
  landslide: [
    "sạt lở", "sat lo", "sạt", "trượt lở", "sụt lún", "đất lở",
    "đá lở", "sụp đất", "ta luy", "taluy", "sạt ta-luy",
    "đèo sạt", "đường sạt", "nguy cơ sạt",
  ],
  // --- Mưa bão ---
  storm: [
    "bão", "áp thấp nhiệt đới", "áp thấp", "mưa lớn", "mưa to",
    "mưa rất to", "mưa cực đoan", "giông lốc", "lốc xoáy",
    "dông sét", "mưa đá", "gió giật", "mưa kéo dài",
    "cảnh báo mưa", "cấp độ rủi ro",
  ],
  // --- Ngập lụt ---
  flood: [
    "ngập", "ngập lụt", "lũ", "lũ quét", "lũ lớn", "nước dâng",
    "ngập úng", "ngập nặng", "nước lũ", "triều cường",
    "mực nước", "vượt báo động", "xả lũ", "hồ chứa",
    "xả tràn", "điều tiết nước", "lưu lượng xả", "hạ du",
    "vượt mức tràn", "nước tràn bờ",
  ],
  // --- Hồ thủy điện & thủy lợi (tỉnh Lâm Đồng mới) ---
  reservoir: [
    // === THỦY ĐIỆN LỚN — Khu vực Lâm Đồng gốc ===
    "thủy điện Đa Nhim", "hồ Đơn Dương", "đập Đa Nhim",
    "thủy điện Hàm Thuận", "hồ Hàm Thuận",
    "thủy điện Đa Mi", "hồ Đa Mi",
    "thủy điện Đại Ninh", "hồ Đại Ninh",
    "thủy điện Sông Pha",
    "Đồng Nai 2", "thủy điện Đồng Nai 2",
    "Đồng Nai 3", "thủy điện Đồng Nai 3",
    "Đồng Nai 4", "thủy điện Đồng Nai 4",
    "Đồng Nai 5", "thủy điện Đồng Nai 5",
    // === THỦY LỢI — Khu vực Lâm Đồng gốc ===
    "hồ Đan Kia", "hồ Suối Vàng",
    "hồ Tuyền Lâm",
    "hồ Đạ Tẻh",
    "hồ Đắk Lông Thượng",
    "hồ Prenn", "hồ Than Thở",
    "hồ Đa Sar", "hồ Ka La",
    "hồ Phú Hội", "hồ Nam Phương",
    // === THỦY ĐIỆN — Khu vực Đắk Nông (sáp nhập) ===
    "thủy điện Đắk R'Tih", "thủy điện Dak Rtih",
    "thủy điện Buôn Tua Srah",
    "thủy điện Buôn Kuốp",
    "hồ Đắk N'Ting", "hồ Xu Đăng",
    "hồ Nam Xuân", "đập Thanh Sơn",
    "hồ Đắk Ken", "hồ Đắk Mbai",
    "hồ Tây Đắk Mil",
    // === THỦY LỢI — Khu vực Bình Thuận (sáp nhập) ===
    "hồ Sông Quao",
    "hồ Sông Lũy",
    "hồ Cà Giây",
    "hồ Ba Bàu",
    "hồ Suối Đá",
    "hồ Sông Khán",
    "hồ Lòng Sông",
    "hồ Đu Đủ",
    "hồ Sông Dinh",
    // === Từ khóa chung về hồ đập ===
    "thủy điện", "thủy lợi", "hồ chứa nước", "đập chứa",
    "xả lũ", "xả tràn", "xả đáy", "cửa tràn",
    "mực nước hồ", "dung tích hồ", "an toàn đập",
    "vận hành liên hồ", "điều tiết hồ",
    "vỡ đập", "tràn đập", "nứt đập", "sự cố đập",
  ],
  // --- Giao thông đèo (liên quan thiên tai) ---
  road_block: [
    "tắc đường", "chia cắt", "cấm lưu thông", "đèo D'ran",
    "đèo Đại Ninh", "đèo Gia Bắc", "đèo Sông Pha",
    "đèo Khánh Lê", "đèo Prenn", "đèo Mimosa",
    "đèo Bảo Lộc", "đèo Tà Đùng", "quốc lộ 20",
    "quốc lộ 27", "quốc lộ 28", "quốc lộ 1A",
    "quốc lộ 55",
  ],
  // --- Chung ---
  general: [
    "thiên tai", "phòng chống", "ứng phó", "cứu hộ", "cứu nạn",
    "sơ tán", "di dời", "cảnh báo", "khẩn cấp",
    "phòng thủ dân sự", "PTDS", "ban chỉ huy PTDS",
    "PCTT", "ban chỉ huy", "công điện khẩn",
  ],
} as const;

/**
 * Danh sách khu vực Lâm Đồng (mới) cần theo dõi, dùng để gắn `area`
 * cho từng cảnh báo khi phát hiện tên địa danh trong nội dung.
 */
export const LAMDONG_AREAS = [
  "Đà Lạt", "Lạc Dương", "Đức Trọng", "Đơn Dương", "Di Linh",
  "Bảo Lộc", "Lâm Hà", "Bảo Lâm", "Đạ Huoai", "Đạ Tẻh",
  "Cát Tiên", "Đam Rông",
  // Khu vực Bình Thuận (sáp nhập)
  "Phan Thiết", "Hàm Thuận Bắc", "Hàm Thuận Nam", "Bắc Bình",
  "Tuy Phong", "Hàm Tân", "La Gi", "Tánh Linh", "Đức Linh",
  // Khu vực Đắk Nông (sáp nhập)
  "Gia Nghĩa", "Đắk R'lấp", "Đắk Song", "Đắk Mil",
  "Krông Nô", "Đắk Glong", "Cư Jút", "Tuy Đức",
] as const;

/**
 * Kiểm tra xem một đoạn text có chứa từ khóa thiên tai không.
 * Trả về danh sách các loại thiên tai phát hiện được (có thể nhiều loại
 * cùng lúc, ví dụ: "sạt lở đèo Bảo Lộc" → ["landslide", "road_block"]).
 */
export function detectDisasterTypes(text: string): DisasterType[] {
  const lower = text.toLowerCase();
  const detected: DisasterType[] = [];

  for (const [type, keywords] of Object.entries(DISASTER_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        detected.push(type as DisasterType);
        break; // Một keyword match đủ cho nhóm này
      }
    }
  }

  return detected;
}

/**
 * Phát hiện khu vực liên quan từ nội dung bài viết.
 * Trả về tên khu vực đầu tiên tìm thấy, hoặc "Lâm Đồng" nếu không xác định.
 */
export function detectArea(text: string): string {
  const lower = text.toLowerCase();
  for (const area of LAMDONG_AREAS) {
    if (lower.includes(area.toLowerCase())) {
      return area;
    }
  }
  return "Lâm Đồng";
}

/**
 * Kiểm tra nhanh xem text có liên quan đến thiên tai không.
 * Dùng cho lọc sơ bộ (prefilter) trước khi phân tích chi tiết.
 */
export function isDisasterRelated(text: string): boolean {
  return detectDisasterTypes(text).length > 0;
}
