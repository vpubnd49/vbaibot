import PptxGenJSModule from "pptxgenjs";
// pptxgenjs CJS module: ESM import đôi khi bọc trong { default: ... }
const PptxGenJS = ((PptxGenJSModule as any).default ?? PptxGenJSModule) as typeof PptxGenJSModule;
type Slide = ReturnType<InstanceType<typeof PptxGenJSModule>["addSlide"]>;
import type { PptxSlide } from "./pptx-content-schema.js";
import { getPptxTheme, type PptxTheme } from "./render-pptx-themes.js";

/**
 * Dựng file .pptx từ nội dung model cung cấp.
 *
 * Triết lý giống render-docx.ts: mọi quy ước định dạng nằm ở renderer,
 * không ở prompt. Model chỉ truyền dữ liệu ngữ nghĩa, renderer lo đẹp.
 *
 * v2 - Thiết kế chuyên nghiệp:
 * - Title slide: gradient 2 tông, accent bar, subtitle kẻ trên
 * - Section slide: full-bleed accent, shape trang trí
 * - Content slide: header bar + accent line dày, bullet rộng rãi
 * - Table slide: header đậm, zebra stripe, bo viền mềm
 * - Quote slide: dấu ngoặc kép khổng lồ, italic, nền tối
 */

// ─── Typography ──────────────────────────────────────────────────────────────

const FONT_PRIMARY = "Arial";
const FONT_SERIF = "Georgia";

// ─── Slide Dimensions (inches) — Layout WIDE 16:9 ───────────────────────────

const W = 13.33;
const H = 7.5;
const MX = 0.7; // margin ngang
const HEADER_BAR_H = 1.0;
const ACCENT_LINE_H = 0.06; // đường accent dày hơn
const FOOTER_H = 0.4;
const BODY_TOP = HEADER_BAR_H + ACCENT_LINE_H + 0.25;
const BODY_H = H - BODY_TOP - FOOTER_H - 0.15;
const BODY_W = W - MX * 2;

// ─── Font Sizes ──────────────────────────────────────────────────────────────

const SZ_TITLE = 38;
const SZ_SUBTITLE = 20;
const SZ_SLIDE_TITLE = 22;
const SZ_BULLET = 17;
const SZ_TABLE = 13;
const SZ_TABLE_HEADER = 14;
const SZ_QUOTE = 26;
const SZ_FOOTER = 9;
const SZ_SECTION = 34;
const SZ_AUTHOR = 15;

// ─── Entry Point ─────────────────────────────────────────────────────────────

export type PptxMeta = { title?: string };

export async function renderPptx(
  slides: PptxSlide[],
  themeName: string = "navy",
  meta: PptxMeta = {},
): Promise<Buffer> {
  const theme = getPptxTheme(themeName);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "VBAI Assistant";
  if (meta.title) pptx.title = meta.title;

  const total = slides.length;
  for (let i = 0; i < total; i++) {
    const s = slides[i]!;
    const slide = pptx.addSlide();
    const num = i + 1;

    switch (s.type) {
      case "title_slide":
        buildTitle(slide, s, theme);
        break;
      case "section_slide":
        buildSection(slide, s, theme);
        break;
      case "content_slide":
        buildContent(slide, s, theme, num, total);
        break;
      case "two_columns_slide":
        buildTwoCols(slide, s, theme, num, total);
        break;
      case "table_slide":
        buildTable(slide, s, theme, num, total);
        break;
      case "quote_slide":
        buildQuote(slide, s, theme);
        break;
    }
  }

  const buf = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(buf as ArrayBuffer);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SLIDE BUILDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildTitle(
  slide: Slide,
  data: Extract<PptxSlide, { type: "title_slide" }>,
  t: PptxTheme,
) {
  // ── Nền 2 tông ──
  slide.background = { color: t.titleBg };
  // Dải nền nhạt hơn ở 40% dưới
  addRect(slide, 0, H * 0.62, W, H * 0.38, t.headerBg);

  // ── Đường accent ngang giữa ──
  addRect(slide, W / 2 - 3, H * 0.58, 6, 0.05, t.accent);

  // ── Tiêu đề chính ──
  slide.addText(data.title, {
    x: MX,
    y: 1.1,
    w: BODY_W,
    h: 2.8,
    fontSize: SZ_TITLE,
    fontFace: FONT_PRIMARY,
    color: "FFFFFF",
    bold: true,
    align: "center",
    valign: "middle",
    lineSpacingMultiple: 1.15,
  });

  // ── Phụ đề ──
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: MX,
      y: H * 0.62 + 0.2,
      w: BODY_W,
      h: 0.7,
      fontSize: SZ_SUBTITLE,
      fontFace: FONT_PRIMARY,
      color: t.accent,
      align: "center",
      valign: "middle",
      italic: true,
    });
  }

  // ── Tác giả / đơn vị ──
  if (data.author) {
    slide.addText(data.author, {
      x: MX,
      y: H * 0.62 + 1.1,
      w: BODY_W,
      h: 0.55,
      fontSize: SZ_AUTHOR,
      fontFace: FONT_PRIMARY,
      color: "CCCCCC",
      align: "center",
      valign: "middle",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function buildSection(
  slide: Slide,
  data: Extract<PptxSlide, { type: "section_slide" }>,
  t: PptxTheme,
) {
  slide.background = { color: t.headerBg };

  // Shape trang trí góc phải trên
  addRect(slide, W - 4, 0, 4, 0.12, t.accent);
  // Shape trang trí góc trái dưới
  addRect(slide, 0, H - 0.12, 4, 0.12, t.accent);

  // Tiêu đề phần
  slide.addText(data.title, {
    x: MX,
    y: 2.0,
    w: BODY_W,
    h: 2.2,
    fontSize: SZ_SECTION,
    fontFace: FONT_PRIMARY,
    color: "FFFFFF",
    bold: true,
    align: "center",
    valign: "middle",
    lineSpacingMultiple: 1.2,
  });

  // Đường accent
  addRect(slide, W / 2 - 2, 4.5, 4, 0.05, t.accent);

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: MX,
      y: 4.8,
      w: BODY_W,
      h: 0.8,
      fontSize: SZ_SUBTITLE - 2,
      fontFace: FONT_PRIMARY,
      color: t.accent,
      align: "center",
      valign: "middle",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function buildContent(
  slide: Slide,
  data: Extract<PptxSlide, { type: "content_slide" }>,
  t: PptxTheme,
  num: number,
  total: number,
) {
  slide.background = { color: t.slideBg };
  addHeaderBar(slide, data.title, t);
  addFooter(slide, num, total, t);

  const items = flattenBullets(data.bullets, {
    fontSize: SZ_BULLET,
    fontFace: FONT_PRIMARY,
    color: t.bodyText,
    bulletIndent: 24,
    paraSpaceAfter: 10,
  });

  slide.addText(items as any, {
    x: MX + 0.1,
    y: BODY_TOP,
    w: BODY_W - 0.2,
    h: BODY_H,
    valign: "top",
    lineSpacingMultiple: 1.3,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function buildTwoCols(
  slide: Slide,
  data: Extract<PptxSlide, { type: "two_columns_slide" }>,
  t: PptxTheme,
  num: number,
  total: number,
) {
  slide.background = { color: t.slideBg };
  addHeaderBar(slide, data.title, t);
  addFooter(slide, num, total, t);

  const colW = (BODY_W - 0.5) / 2;

  // ── Cột trái ──
  const leftItems = buildColumnContent(data.left_title, data.left_items, t);
  slide.addText(leftItems as any, {
    x: MX,
    y: BODY_TOP,
    w: colW,
    h: BODY_H,
    valign: "top",
    lineSpacingMultiple: 1.25,
  });

  // ── Đường ngăn dọc ──
  addRect(slide, MX + colW + 0.2, BODY_TOP + 0.15, 0.03, BODY_H - 0.3, t.accent);

  // ── Cột phải ──
  const rightItems = buildColumnContent(data.right_title, data.right_items, t);
  slide.addText(rightItems as any, {
    x: MX + colW + 0.5,
    y: BODY_TOP,
    w: colW,
    h: BODY_H,
    valign: "top",
    lineSpacingMultiple: 1.25,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function buildTable(
  slide: Slide,
  data: Extract<PptxSlide, { type: "table_slide" }>,
  t: PptxTheme,
  num: number,
  total: number,
) {
  slide.background = { color: t.slideBg };
  addHeaderBar(slide, data.title, t);
  addFooter(slide, num, total, t);

  const colCount = data.headers.length;
  const tableW = BODY_W - 0.2;
  const colW = tableW / colCount;

  // Header row
  const headerRow = data.headers.map((h) => ({
    text: h,
    options: {
      fontSize: SZ_TABLE_HEADER,
      fontFace: FONT_PRIMARY,
      bold: true,
      color: t.tableHeaderText,
      fill: { color: t.tableHeaderBg },
      align: "center" as const,
      valign: "middle" as const,
    },
  }));

  // Data rows
  const dataRows = data.rows.map((row, ri) =>
    row.map((cell) => ({
      text: cell,
      options: {
        fontSize: SZ_TABLE,
        fontFace: FONT_PRIMARY,
        color: t.bodyText,
        fill: { color: ri % 2 === 0 ? "FFFFFF" : t.tableStripeBg },
        align: "left" as const,
        valign: "middle" as const,
      },
    })),
  );

  slide.addTable([headerRow, ...dataRows] as any, {
    x: MX + 0.1,
    y: BODY_TOP,
    w: tableW,
    colW: Array(colCount).fill(colW),
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    margin: [6, 10, 6, 10],
    autoPage: false,
    rowH: 0.45,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function buildQuote(
  slide: Slide,
  data: Extract<PptxSlide, { type: "quote_slide" }>,
  t: PptxTheme,
) {
  slide.background = { color: t.titleBg };

  // Shape trang trí accent bar trên
  addRect(slide, 0, 0, W, 0.08, t.accent);
  // Shape trang trí accent bar dưới
  addRect(slide, 0, H - 0.08, W, 0.08, t.accent);

  // Dấu ngoặc kép khổng lồ
  slide.addText("\u201C", {
    x: MX - 0.2,
    y: 0.8,
    w: 2,
    h: 2,
    fontSize: 120,
    fontFace: FONT_SERIF,
    color: t.accent,
    bold: true,
    valign: "top",
  });

  // Nội dung trích dẫn
  slide.addText(data.quote, {
    x: MX + 1.0,
    y: 2.0,
    w: BODY_W - 2.0,
    h: 3.0,
    fontSize: SZ_QUOTE,
    fontFace: FONT_SERIF,
    color: "FFFFFF",
    italic: true,
    align: "center",
    valign: "middle",
    lineSpacingMultiple: 1.4,
  });

  // Nguồn
  if (data.source) {
    // Đường kẻ nhỏ trên tên nguồn
    addRect(slide, W / 2 - 1, 5.3, 2, 0.03, t.accent);
    slide.addText(`\u2014 ${data.source}`, {
      x: MX,
      y: 5.5,
      w: BODY_W,
      h: 0.7,
      fontSize: 15,
      fontFace: FONT_PRIMARY,
      color: t.accent,
      align: "center",
      valign: "middle",
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SHARED COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Header bar + accent line + tiêu đề slide */
function addHeaderBar(slide: Slide, title: string, t: PptxTheme) {
  // Nền header
  addRect(slide, 0, 0, W, HEADER_BAR_H, t.headerBg);
  // Accent line dày
  addRect(slide, 0, HEADER_BAR_H, W, ACCENT_LINE_H, t.accent);

  // Tiêu đề
  slide.addText(title, {
    x: MX,
    y: 0,
    w: BODY_W,
    h: HEADER_BAR_H,
    fontSize: SZ_SLIDE_TITLE,
    fontFace: FONT_PRIMARY,
    color: "FFFFFF",
    bold: true,
    valign: "middle",
  });
}

/** Footer đánh số slide + đường mỏng trên */
function addFooter(slide: Slide, num: number, total: number, t: PptxTheme) {
  // Đường mỏng phân cách
  addRect(slide, MX, H - FOOTER_H - 0.02, BODY_W, 0.015, "DDDDDD");
  slide.addText(`${num} / ${total}`, {
    x: MX,
    y: H - FOOTER_H,
    w: BODY_W,
    h: FOOTER_H,
    fontSize: SZ_FOOTER,
    fontFace: FONT_PRIMARY,
    color: "999999",
    align: "right",
    valign: "middle",
  });
}

/** Vẽ hình chữ nhật - helper dùng xuyên suốt */
function addRect(slide: Slide, x: number, y: number, w: number, h: number, color: string) {
  slide.addShape("rect" as any, { x, y, w, h, fill: { color } });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TEXT FORMATTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Dựng nội dung cột cho slide hai cột */
function buildColumnContent(
  title: string | undefined,
  items: string[],
  t: PptxTheme,
): Array<{ text: string; options: Record<string, any> }> {
  const result: Array<{ text: string; options: Record<string, any> }> = [];

  if (title) {
    result.push({
      text: title,
      options: {
        fontSize: SZ_SUBTITLE - 2,
        fontFace: FONT_PRIMARY,
        color: t.headerBg,
        bold: true,
        paraSpaceAfter: 14,
      },
    });
  }

  const bulletItems = flattenBullets(items, {
    fontSize: 15,
    fontFace: FONT_PRIMARY,
    color: t.bodyText,
    bulletIndent: 18,
    paraSpaceAfter: 7,
  });
  result.push(...bulletItems);
  return result;
}

/**
 * Flatten mảng bullet text (có thể chứa **đậm**) thành mảng TextProps phẳng
 * mà pptxgenjs hiểu. Mỗi bullet gồm nhiều text run:
 * - Run đầu: bullet marker, bắt đầu paragraph mới
 * - Run tiếp: breakType "none" để nằm cùng dòng
 */
type BulletStyle = {
  fontSize: number;
  fontFace: string;
  color: string;
  bulletIndent: number;
  paraSpaceAfter: number;
};

function flattenBullets(
  bullets: string[],
  style: BulletStyle,
): Array<{ text: string; options: Record<string, any> }> {
  const result: Array<{ text: string; options: Record<string, any> }> = [];

  for (const bulletText of bullets) {
    const runs = parseBoldRuns(bulletText);
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i]!;
      const isFirst = i === 0;
      result.push({
        text: run.text,
        options: {
          fontSize: style.fontSize,
          fontFace: style.fontFace,
          color: style.color,
          bold: run.options?.bold ?? false,
          ...(isFirst
            ? {
                bullet: { indent: style.bulletIndent, code: "2022" },
                paraSpaceAfter: style.paraSpaceAfter,
              }
            : { breakType: "none" }),
        },
      });
    }
  }

  return result;
}

/** Parse **đậm** inline thành text runs */
function parseBoldRuns(text: string): Array<{ text: string; options?: { bold?: boolean } }> {
  const runs: Array<{ text: string; options?: { bold?: boolean } }> = [];
  const RE = /\*{2}([^*]+)\*{2}/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = RE.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    runs.push({ text: m[1]!, options: { bold: true } });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });

  return runs.length > 0 ? runs : [{ text }];
}
