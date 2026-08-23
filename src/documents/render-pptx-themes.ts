/**
 * Bảng màu 6 theme cho slide PowerPoint - tông màu chuyên nghiệp, phù hợp
 * ngữ cảnh tài liệu hành chính và doanh nghiệp Việt Nam.
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
};

const THEMES: Record<string, PptxTheme> = {
  navy: {
    headerBg: "1B3A5C",
    accent: "2E75B6",
    headerText: "FFFFFF",
    titleBg: "0D2137",
    bodyText: "333333",
    slideBg: "FFFFFF",
    tableHeaderBg: "1B3A5C",
    tableHeaderText: "FFFFFF",
    tableStripeBg: "E8EEF4",
  },
  blue: {
    headerBg: "0D47A1",
    accent: "42A5F5",
    headerText: "FFFFFF",
    titleBg: "0A2E6B",
    bodyText: "333333",
    slideBg: "FFFFFF",
    tableHeaderBg: "0D47A1",
    tableHeaderText: "FFFFFF",
    tableStripeBg: "E3F2FD",
  },
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
  },
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
  },
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
  },
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
  },
};

export const PPTX_THEME_NAMES = Object.keys(THEMES) as [string, ...string[]];

export function getPptxTheme(name: string): PptxTheme {
  return THEMES[name] ?? THEMES["navy"]!;
}
