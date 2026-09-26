/**
 * Bảng màu 7 theme cho slide PowerPoint - tông màu chuyên nghiệp, phù hợp
 * ngữ cảnh tài liệu hành chính và doanh nghiệp Việt Nam.
 *
 * Phân tích từ 3 file PPTX mẫu thực tế (bosung/):
 * - File TTHC Nội bộ: Century Gothic, xanh đậm #052F61 + đỏ #C62324
 * - File Hệ thống PAKN: Cambria, xanh đậm #002060 + đỏ #FF0000
 * - File Zalo Agent v2: nền trắng, card bo tròn, cam #FF6B35 + xanh lá #43A047
 *
 * Theme "zaloagent" bổ sung card-based properties (cardBg, cardBorder, ...)
 * để hỗ trợ layout feature_cards_slide kiểu pitch deck hiện đại.
 */

export type PptxTheme = {
  /** Nền header bar */
  headerBg: string;
  /** Màu accent (bullet, đường kẻ, highlight) */
  accent: string;
  /** Màu chữ trên header (luôn trắng hoặc sáng) */
  headerText: string;
  /** Nền title slide */
  titleBg: string;
  /** Màu chữ body mặc định */
  bodyText: string;
  /** Nền slide thường */
  slideBg: string;
  /** Màu header bảng */
  tableHeaderBg: string;
  /** Màu chữ header bảng */
  tableHeaderText: string;
  /** Màu dòng chẵn bảng (zebra stripe) */
  tableStripeBg: string;
  /** Màu đỏ nhấn mạnh — dùng cho highlight quan trọng (cả 3 file mẫu đều dùng) */
  redAccent: string;

  // ── Card-based layout (dùng cho zaloagent và các theme tương lai) ──
  /** Nền card */
  cardBg?: string;
  /** Viền card */
  cardBorder?: string;
  /** Màu accent phụ (icon, badge phụ) */
  secondaryAccent?: string;
  /** Nền badge/tag nhỏ */
  badgeBg?: string;
  /** Màu chữ badge */
  badgeText?: string;
  /** Màu tiêu đề chính (title slide nền trắng) */
  titleText?: string;
  /** Accent bar trên cùng slide - gradient stop 1 */
  topBarColor1?: string;
  /** Accent bar trên cùng slide - gradient stop 2 */
  topBarColor2?: string;
};

const THEMES: Record<string, PptxTheme> = {
  // ── Trang trọng: xanh navy đậm — phù hợp hành chính, hội nghị ──
  navy: {
    headerBg: "052F61",        // từ file mẫu TTHC: xanh navy đậm chuẩn
    accent: "146194",          // xanh dương trung - accent bar, bullet
    headerText: "FFFFFF",
    titleBg: "0D2137",
    bodyText: "333333",
    slideBg: "FFFFFF",
    tableHeaderBg: "052F61",
    tableHeaderText: "FFFFFF",
    tableStripeBg: "E8EEF4",
    redAccent: "C62324",       // đỏ đậm từ file mẫu TTHC
    secondaryAccent: "C62324", // để feature_cards_slide dùng
  },
  // ── Tài chính: xanh dương sáng ──
  blue: {
    headerBg: "002060",        // từ file mẫu PAKN: xanh đậm chuẩn
    accent: "146194",          // xanh trung
    headerText: "FFFFFF",
    titleBg: "001540",
    bodyText: "333333",
    slideBg: "FFFFFF",
    tableHeaderBg: "002060",
    tableHeaderText: "FFFFFF",
    tableStripeBg: "E3F2FD",
    redAccent: "C00000",       // đỏ đậm từ file mẫu PAKN
    secondaryAccent: "C00000",
  },
  // ── Nông nghiệp, môi trường ──
  green: {
    headerBg: "1B5E20",
    accent: "43A047",
    headerText: "FFFFFF",
    titleBg: "0E3311",
    bodyText: "333333",
    slideBg: "FFFFFF",
    tableHeaderBg: "1B5E20",
    tableHeaderText: "FFFFFF",
    tableStripeBg: "E8F5E9",
    redAccent: "C62828",
    secondaryAccent: "C62828",
  },
  // ── Pháp lý: đỏ burgundy ──
  burgundy: {
    headerBg: "7B1E3A",
    accent: "C62828",
    headerText: "FFFFFF",
    titleBg: "4A0E22",
    bodyText: "333333",
    slideBg: "FFFFFF",
    tableHeaderBg: "7B1E3A",
    tableHeaderText: "FFFFFF",
    tableStripeBg: "FCE4EC",
    redAccent: "D32F2F",
    secondaryAccent: "D32F2F",
  },
  // ── Kỹ thuật: xám slate ──
  slate: {
    headerBg: "37474F",
    accent: "78909C",
    headerText: "FFFFFF",
    titleBg: "1C252A",
    bodyText: "333333",
    slideBg: "FFFFFF",
    tableHeaderBg: "37474F",
    tableHeaderText: "FFFFFF",
    tableStripeBg: "ECEFF1",
    redAccent: "E53935",
    secondaryAccent: "E53935",
  },
  // ── Y tế, giáo dục: teal ──
  teal: {
    headerBg: "00695C",
    accent: "26A69A",
    headerText: "FFFFFF",
    titleBg: "003D33",
    bodyText: "333333",
    slideBg: "FFFFFF",
    tableHeaderBg: "00695C",
    tableHeaderText: "FFFFFF",
    tableStripeBg: "E0F2F1",
    redAccent: "C62828",
    secondaryAccent: "C62828",
  },
  // ── Giới thiệu sản phẩm, pitch deck: nền trắng, card bo tròn ──
  // Dựa trên file zalo-agent-gioi-thieu-v2.pptx (3 ảnh mẫu)
  zaloagent: {
    headerBg: "1565C0",        // xanh dương đậm — tiêu đề, header bar
    accent: "FF6B35",          // cam chủ đạo — CTA, accent bar, nút
    headerText: "FFFFFF",
    titleBg: "FFFFFF",         // nền title slide trắng (khác theme tối)
    bodyText: "333333",
    slideBg: "FFFFFF",
    tableHeaderBg: "1565C0",
    tableHeaderText: "FFFFFF",
    tableStripeBg: "FFF3E0",   // sọc bảng cam nhạt
    redAccent: "E53935",       // đỏ cho highlight quan trọng
    // --- Card layout ---
    cardBg: "FFFFFF",
    cardBorder: "E0E0E0",     // viền card xám nhẹ
    secondaryAccent: "43A047", // xanh lá phụ — badge, icon column 2
    badgeBg: "E8F5E9",        // nền badge xanh lá nhạt
    badgeText: "2E7D32",      // chữ badge xanh lá đậm
    titleText: "1565C0",      // tiêu đề xanh dương đậm trên nền trắng
    topBarColor1: "FF6B35",   // gradient cam → xanh lá trên cùng
    topBarColor2: "43A047",
  },
};

export const PPTX_THEME_NAMES = Object.keys(THEMES) as [string, ...string[]];

export function getPptxTheme(name: string): PptxTheme {
  return THEMES[name] ?? THEMES["navy"]!;
}
