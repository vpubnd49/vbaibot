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

// ───── Lọc địa lý: chỉ giữ bài viết về Lâm Đồng ──────────────────────────

/**
 * Các tỉnh/thành KHÁC để phát hiện bài viết KHÔNG liên quan Lâm Đồng.
 * Nếu bài nhắc tỉnh khác mà KHÔNG nhắc Lâm Đồng → loại bỏ.
 */
const OTHER_PROVINCES = [
  // Tây Nguyên (trừ Đắk Nông đã sáp nhập)
  "Đắk Lắk", "Dak Lak", "Buôn Ma Thuột",
  "Gia Lai", "Pleiku",
  "Kon Tum",
  // Duyên hải Nam Trung Bộ (trừ Bình Thuận đã sáp nhập)
  "Khánh Hòa", "Nha Trang", "Cam Ranh",
  "Ninh Thuận", "Phan Rang",
  "Phú Yên", "Tuy Hòa",
  "Bình Định", "Quy Nhơn",
  "Quảng Nam", "Hội An", "Tam Kỳ",
  "Quảng Ngãi",
  "Đà Nẵng",
  // Đông Nam Bộ
  "Đồng Nai", "Biên Hòa",
  "Bình Dương", "Thủ Dầu Một",
  "Bình Phước", "Đồng Xoài",
  "Bà Rịa", "Vũng Tàu",
  "TP.HCM", "Hồ Chí Minh", "Sài Gòn",
  "Tây Ninh",
  // Khác
  "Hà Nội", "Hải Phòng", "Huế", "Nghệ An", "Hà Tĩnh",
  "Quảng Bình", "Quảng Trị", "Thanh Hóa",
] as const;

/**
 * Các từ khóa xác nhận bài viết thuộc về Lâm Đồng.
 * Bao gồm tên tỉnh + các địa danh đặc trưng.
 */
const LAMDONG_MARKERS = [
  "lâm đồng", "đà lạt", "bảo lộc", "di linh", "đức trọng",
  "đơn dương", "lạc dương", "lâm hà", "đạ huoai", "đạ tẻh",
  "cát tiên", "bảo lâm", "đam rông",
  // Bình Thuận (đã sáp nhập)
  "phan thiết", "hàm thuận", "bắc bình", "tuy phong",
  "la gi", "tánh linh", "đức linh", "hàm tân",
  // Đắk Nông (đã sáp nhập)
  "gia nghĩa", "đắk r'lấp", "đắk song", "đắk mil",
  "krông nô", "đắk glong", "cư jút", "tuy đức",
  // Đèo + hồ đập đặc trưng
  "đèo prenn", "đèo bảo lộc", "đèo đại ninh", "đèo d'ran",
  "đèo mimosa", "đèo tà đùng", "đèo gia bắc", "đèo sông pha",
  "đèo khánh lê",
  "hồ đa nhim", "hồ hàm thuận", "hồ đa mi", "hồ đại ninh",
  "hồ tuyền lâm", "hồ đan kia", "hồ suối vàng",
  "hồ sông quao", "hồ cà giây",
  "thủy điện đa nhim", "thủy điện hàm thuận", "thủy điện đa mi",
  "thủy điện đại ninh", "thủy điện đắk r'tih",
] as const;

/**
 * Các nguồn CHẮC CHẮN thuộc Lâm Đồng — bài từ đây không cần kiểm tra thêm.
 */
const LAMDONG_SOURCES = [
  "báo lâm đồng", "baolamdong", "cổng ttđt lâm đồng", "lamdong.gov",
  "thời tiết lâm đồng", "bch phòng thủ dân sự lâm đồng",
  "fb: thời tiết lâm đồng", "fb: bch phòng thủ dân sự",
] as const;

/**
 * Kiểm tra bài viết có thực sự liên quan đến tỉnh Lâm Đồng không.
 *
 * Luật (ưu tiên từ trên xuống):
 * 1. Nội dung nhắc tỉnh khác mà KHÔNG nhắc địa danh Lâm Đồng → LOẠI
 *    (ngay cả khi nguồn là Báo Lâm Đồng — vì họ có thể đưa tin tỉnh bạn)
 * 2. Nội dung nhắc địa danh Lâm Đồng → ĐẠT
 * 3. Nguồn là báo/FB Lâm Đồng + không nhắc tỉnh khác → ĐẠT
 * 4. Không nhắc tỉnh nào cụ thể → LOẠI (bài chung chung toàn quốc)
 */
export function isAboutLamDong(text: string, sourceName: string): boolean {
  const lower = text.toLowerCase();
  const srcLower = sourceName.toLowerCase();

  const hasLamDongMarker = LAMDONG_MARKERS.some((m) => lower.includes(m));
  const hasOtherProvince = OTHER_PROVINCES.some((p) => lower.includes(p.toLowerCase()));

  // 1. Nhắc tỉnh khác mà KHÔNG nhắc Lâm Đồng → LOẠI (dù nguồn Lâm Đồng)
  if (hasOtherProvince && !hasLamDongMarker) return false;

  // 2. Có nhắc địa danh Lâm Đồng → đạt
  if (hasLamDongMarker) return true;

  // 3. Nguồn chắc chắn Lâm Đồng + không nhắc tỉnh khác → đạt
  if (LAMDONG_SOURCES.some((s) => srcLower.includes(s))) {
    return true;
  }

  // 4. Không nhắc địa danh nào cụ thể → loại (bài chung chung toàn quốc)
  return false;
}

/**
 * Kiểm tra nhanh xem text có liên quan đến thiên tai không.
 * Dùng cho lọc sơ bộ (prefilter) trước khi phân tích chi tiết.
 */
export function isDisasterRelated(text: string): boolean {
  return detectDisasterTypes(text).length > 0;
}

