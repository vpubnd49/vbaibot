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
 * v3 - Thiết kế đa phong cách:
 * - Các theme tối (navy/blue/green/burgundy/slate/teal): header bar đậm + bullet
 * - Theme "zaloagent": nền trắng sạch, card bo tròn, icon emoji lớn,
 *   accent cam/xanh lá, badge tag — giống SaaS pitch deck hiện đại
 * - Hỗ trợ feature_cards_slide: 2-4 card tính năng cạnh nhau
 * - Hỗ trợ icon items: bullet hoặc card item kèm emoji Unicode
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
const SZ_BADGE = 11;
const SZ_ICON = 22;
const SZ_CARD_TITLE = 16;
const SZ_CARD_ITEM = 13;
const SZ_CARD_ICON = 28;

// ─── ZaloAgent specific layout constants ─────────────────────────────────────

const ZA_TOP_BAR_H = 0.06;       // accent gradient bar mỏng trên cùng
const ZA_BODY_TOP = 1.5;         // body bắt đầu thấp hơn (không header bar)
const ZA_BODY_H = H - ZA_BODY_TOP - FOOTER_H - 0.15;
const ZA_CARD_RADIUS = 0.12;     // bo tròn card (inches)
const ZA_CARD_PADDING = 0.25;    // padding trong card

// ─── Helper: detect zaloagent theme ──────────────────────────────────────────

function isCardTheme(t: PptxTheme): boolean {
  return t.cardBg !== undefined;
}

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
      case "feature_cards_slide":
        buildFeatureCards(slide, s, theme, num, total);
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
  if (isCardTheme(t)) {
    buildTitleCard(slide, data, t);
    return;
  }

  // ── Classic: Nền 2 tông ──
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

/** Title slide cho zaloagent: nền trắng, accent bar gradient trên cùng, badge xanh lá */
function buildTitleCard(
  slide: Slide,
  data: Extract<PptxSlide, { type: "title_slide" }>,
  t: PptxTheme,
) {
  slide.background = { color: t.titleBg }; // FFFFFF

  // ── Accent bar gradient trên cùng (2 nửa — pptxgenjs không hỗ trợ gradient shape) ──
  const bar1 = t.topBarColor1 ?? t.accent;
  const bar2 = t.topBarColor2 ?? t.secondaryAccent ?? t.accent;
  addRect(slide, 0, 0, W / 2, ZA_TOP_BAR_H, bar1);
  addRect(slide, W / 2, 0, W / 2, ZA_TOP_BAR_H, bar2);

  // ── Đường accent cam nhạt ngang dưới cùng slide ──
  addRect(slide, 0, H - 0.04, W, 0.04, t.accent);

  let currentY = 1.2;

  // ── Badge / tag nhỏ ──
  if (data.badge) {
    addBadge(slide, data.badge, MX, currentY - 0.8, t);
    currentY += 0.1;
  }

  // ── Tiêu đề chính ── màu xanh đậm thay vì trắng ──
  slide.addText(data.title, {
    x: MX,
    y: currentY,
    w: BODY_W,
    h: 2.2,
    fontSize: SZ_TITLE + 2,
    fontFace: FONT_PRIMARY,
    color: t.titleText ?? t.headerBg,
    bold: true,
    align: "left",
    valign: "middle",
    lineSpacingMultiple: 1.15,
  });
  currentY += 2.4;

  // ── Phụ đề ──
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: MX,
      y: currentY,
      w: BODY_W,
      h: 0.7,
      fontSize: SZ_SUBTITLE,
      fontFace: FONT_PRIMARY,
      color: t.bodyText,
      align: "left",
      valign: "middle",
      italic: true,
    });
    currentY += 0.9;
  }

  // ── Tác giả / đơn vị ──
  if (data.author) {
    slide.addText(data.author, {
      x: MX,
      y: currentY + 0.3,
      w: BODY_W,
      h: 0.55,
      fontSize: SZ_AUTHOR,
      fontFace: FONT_PRIMARY,
      color: "888888",
      align: "left",
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
  if (isCardTheme(t)) {
    // Zaloagent: nền trắng, accent bar, tiêu đề xanh đậm
    slide.background = { color: t.slideBg };
    addTopBar(slide, t);
    addRect(slide, 0, H - 0.04, W, 0.04, t.secondaryAccent ?? t.accent);

    slide.addText(data.title, {
      x: MX,
      y: 2.0,
      w: BODY_W,
      h: 2.2,
      fontSize: SZ_SECTION,
      fontFace: FONT_PRIMARY,
      color: t.titleText ?? t.headerBg,
      bold: true,
      align: "center",
      valign: "middle",
      lineSpacingMultiple: 1.2,
    });

    // Đường accent cam
    addRect(slide, W / 2 - 2, 4.5, 4, 0.05, t.accent);

    if (data.subtitle) {
      slide.addText(data.subtitle, {
        x: MX,
        y: 4.8,
        w: BODY_W,
        h: 0.8,
        fontSize: SZ_SUBTITLE - 2,
        fontFace: FONT_PRIMARY,
        color: t.bodyText,
        align: "center",
        valign: "middle",
      });
    }
    return;
  }

  // Classic
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
  const normalizedBullets = normalizeBulletItems(data.bullets);

  if (isCardTheme(t)) {
    buildContentCard(slide, data.title, (data as any).subtitle, normalizedBullets, t, num, total);
    return;
  }

  // Classic
  slide.background = { color: t.slideBg };
  addHeaderBar(slide, data.title, t);
  addFooter(slide, num, total, t);

  const bulletTexts = normalizedBullets.map((b) =>
    b.icon ? `${b.icon}  ${b.text}` : b.text,
  );

  const items = flattenBullets(bulletTexts, {
    fontSize: SZ_BULLET,
    fontFace: FONT_PRIMARY,
    color: t.bodyText,
    bulletIndent: 24,
    paraSpaceAfter: 10,
    redAccent: t.redAccent,
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

/** Content slide cho zaloagent: nền trắng, card items với icon lớn */
function buildContentCard(
  slide: Slide,
  title: string,
  subtitle: string | undefined,
  bullets: NormalizedBulletItem[],
  t: PptxTheme,
  num: number,
  total: number,
) {
  slide.background = { color: t.slideBg };
  addTopBar(slide, t);
  addFooter(slide, num, total, t);

  let titleY = ZA_BODY_TOP - 1.0;

  // Tiêu đề
  slide.addText(title, {
    x: MX,
    y: titleY,
    w: BODY_W,
    h: 0.6,
    fontSize: SZ_SLIDE_TITLE + 2,
    fontFace: FONT_PRIMARY,
    color: t.titleText ?? t.headerBg,
    bold: true,
    valign: "middle",
  });
  titleY += 0.6;

  // Subtitle
  if (subtitle) {
    slide.addText(subtitle, {
      x: MX,
      y: titleY,
      w: BODY_W,
      h: 0.4,
      fontSize: SZ_SUBTITLE - 4,
      fontFace: FONT_PRIMARY,
      color: "888888",
      valign: "middle",
    });
    titleY += 0.45;
  }

  // Đường accent mỏng
  addRect(slide, MX, titleY + 0.05, BODY_W, 0.03, t.accent);
  const bodyY = titleY + 0.25;

  // Check if items have icons — render as icon list cards
  const hasIcons = bullets.some((b) => b.icon);

  if (hasIcons) {
    // Icon list: mỗi item là một dòng icon lớn + text
    const itemH = Math.min(0.65, (H - bodyY - FOOTER_H - 0.3) / bullets.length);
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i]!;
      const y = bodyY + i * itemH;

      if (b.icon) {
        // Icon tròn nền nhạt
        addRoundRect(slide, MX + 0.15, y + 0.08, 0.5, 0.45, t.badgeBg ?? "F5F5F5", t.cardBorder ?? "E0E0E0");
        slide.addText(b.icon, {
          x: MX + 0.15,
          y: y + 0.08,
          w: 0.5,
          h: 0.45,
          fontSize: SZ_ICON,
          fontFace: FONT_PRIMARY,
          align: "center",
          valign: "middle",
        });
      }

      const textRuns = parseBoldRuns(b.text);
      const formatted = textRuns.map((r) => ({
        text: r.text,
        options: {
          fontSize: SZ_BULLET,
          fontFace: FONT_PRIMARY,
          color: r.options?.bold ? (t.titleText ?? t.headerBg) : t.bodyText,
          bold: r.options?.bold ?? false,
        },
      }));

      slide.addText(formatted as any, {
        x: MX + (b.icon ? 0.85 : 0.15),
        y: y + 0.08,
        w: BODY_W - (b.icon ? 1.0 : 0.3),
        h: 0.45,
        valign: "middle",
      });
    }
  } else {
    // No icons — classic bullet style but with clean white background
    const bulletTexts = bullets.map((b) => b.text);
    const items = flattenBullets(bulletTexts, {
      fontSize: SZ_BULLET,
      fontFace: FONT_PRIMARY,
      color: t.bodyText,
      bulletIndent: 24,
      paraSpaceAfter: 10,
      redAccent: t.redAccent,
    });

    slide.addText(items as any, {
      x: MX + 0.1,
      y: bodyY,
      w: BODY_W - 0.2,
      h: H - bodyY - FOOTER_H - 0.2,
      valign: "top",
      lineSpacingMultiple: 1.3,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function buildTwoCols(
  slide: Slide,
  data: Extract<PptxSlide, { type: "two_columns_slide" }>,
  t: PptxTheme,
  num: number,
  total: number,
) {
  const leftItems = normalizeBulletItems(data.left_items);
  const rightItems = normalizeBulletItems(data.right_items);

  if (isCardTheme(t)) {
    buildTwoColsCard(slide, data.title, data.left_title, (data as any).left_icon, leftItems, data.right_title, (data as any).right_icon, rightItems, t, num, total);
    return;
  }

  // Classic
  slide.background = { color: t.slideBg };
  addHeaderBar(slide, data.title, t);
  addFooter(slide, num, total, t);

  const colW = (BODY_W - 0.5) / 2;

  // ── Cột trái ──
  const leftContent = buildColumnContent(data.left_title, leftItems.map((i) => i.icon ? `${i.icon}  ${i.text}` : i.text), t);
  slide.addText(leftContent as any, {
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
  const rightContent = buildColumnContent(data.right_title, rightItems.map((i) => i.icon ? `${i.icon}  ${i.text}` : i.text), t);
  slide.addText(rightContent as any, {
    x: MX + colW + 0.5,
    y: BODY_TOP,
    w: colW,
    h: BODY_H,
    valign: "top",
    lineSpacingMultiple: 1.25,
  });
}

/** Two columns cho zaloagent: 2 card bo tròn cạnh nhau */
function buildTwoColsCard(
  slide: Slide,
  title: string,
  leftTitle: string | undefined,
  leftIcon: string | undefined,
  leftItems: NormalizedBulletItem[],
  rightTitle: string | undefined,
  rightIcon: string | undefined,
  rightItems: NormalizedBulletItem[],
  t: PptxTheme,
  num: number,
  total: number,
) {
  slide.background = { color: t.slideBg };
  addTopBar(slide, t);
  addFooter(slide, num, total, t);

  // Tiêu đề
  slide.addText(title, {
    x: MX,
    y: ZA_BODY_TOP - 1.0,
    w: BODY_W,
    h: 0.6,
    fontSize: SZ_SLIDE_TITLE + 2,
    fontFace: FONT_PRIMARY,
    color: t.titleText ?? t.headerBg,
    bold: true,
    valign: "middle",
  });
  addRect(slide, MX, ZA_BODY_TOP - 0.25, BODY_W, 0.03, t.accent);

  const cardGap = 0.4;
  const cardW = (BODY_W - cardGap) / 2;
  const cardY = ZA_BODY_TOP + 0.05;
  const cardH = ZA_BODY_H - 0.3;

  // Card trái
  addRoundRect(slide, MX, cardY, cardW, cardH, t.cardBg ?? "FFFFFF", t.cardBorder ?? "E0E0E0");
  renderCardColumn(slide, MX + ZA_CARD_PADDING, cardY, cardW - ZA_CARD_PADDING * 2, cardH, leftTitle, leftIcon, leftItems, t, t.accent);

  // Card phải
  addRoundRect(slide, MX + cardW + cardGap, cardY, cardW, cardH, t.cardBg ?? "FFFFFF", t.cardBorder ?? "E0E0E0");
  renderCardColumn(slide, MX + cardW + cardGap + ZA_CARD_PADDING, cardY, cardW - ZA_CARD_PADDING * 2, cardH, rightTitle, rightIcon, rightItems, t, t.secondaryAccent ?? t.accent);
}

/** Render nội dung 1 cột trong card (icon title + items) */
function renderCardColumn(
  slide: Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string | undefined,
  icon: string | undefined,
  items: NormalizedBulletItem[],
  t: PptxTheme,
  accentColor: string,
) {
  let curY = y + ZA_CARD_PADDING;

  // Card title with icon
  if (title) {
    const titleParts: Array<{ text: string; options: Record<string, any> }> = [];
    if (icon) {
      titleParts.push({
        text: icon + "  ",
        options: { fontSize: SZ_CARD_TITLE + 4, fontFace: FONT_PRIMARY },
      });
    }
    titleParts.push({
      text: title,
      options: {
        fontSize: SZ_CARD_TITLE,
        fontFace: FONT_PRIMARY,
        color: accentColor,
        bold: true,
        breakType: icon ? "none" : undefined,
      },
    });
    slide.addText(titleParts as any, {
      x,
      y: curY,
      w,
      h: 0.5,
      valign: "middle",
    });
    curY += 0.6;
  }

  // Accent line dưới title
  addRect(slide, x, curY - 0.08, Math.min(w, 2.5), 0.03, accentColor);
  curY += 0.1;

  // Items
  const itemH = Math.min(0.55, (y + h - curY - ZA_CARD_PADDING) / items.length);
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const itemY = curY + i * itemH;

    if (item.icon) {
      slide.addText(item.icon, {
        x,
        y: itemY,
        w: 0.4,
        h: itemH,
        fontSize: SZ_CARD_ITEM + 2,
        fontFace: FONT_PRIMARY,
        align: "center",
        valign: "middle",
      });
    }

    const textRuns = parseBoldRuns(item.text);
    const formatted = textRuns.map((r) => ({
      text: r.text,
      options: {
        fontSize: SZ_CARD_ITEM,
        fontFace: FONT_PRIMARY,
        color: r.options?.bold ? accentColor : t.bodyText,
        bold: r.options?.bold ?? false,
      },
    }));

    slide.addText(formatted as any, {
      x: x + (item.icon ? 0.45 : 0),
      y: itemY,
      w: w - (item.icon ? 0.45 : 0),
      h: itemH,
      valign: "middle",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE CARDS SLIDE — 2-4 card tính năng cạnh nhau
// ─────────────────────────────────────────────────────────────────────────────

function buildFeatureCards(
  slide: Slide,
  data: Extract<PptxSlide, { type: "feature_cards_slide" }>,
  t: PptxTheme,
  num: number,
  total: number,
) {
  slide.background = { color: t.slideBg };
  if (isCardTheme(t)) {
    addTopBar(slide, t);
  } else {
    addHeaderBar(slide, data.title, t);
  }
  addFooter(slide, num, total, t);

  const bodyTop = isCardTheme(t) ? ZA_BODY_TOP : BODY_TOP;
  const bodyH = isCardTheme(t) ? ZA_BODY_H : BODY_H;

  // Badge
  if (isCardTheme(t) && data.badge) {
    addBadge(slide, data.badge, MX, bodyTop - 1.2, t);
  }

  // Tiêu đề (cho card theme, hiển thị trên nền trắng)
  if (isCardTheme(t)) {
    slide.addText(data.title, {
      x: MX,
      y: bodyTop - 1.0,
      w: BODY_W,
      h: 0.55,
      fontSize: SZ_SLIDE_TITLE + 4,
      fontFace: FONT_PRIMARY,
      color: t.titleText ?? t.headerBg,
      bold: true,
      valign: "middle",
    });

    if (data.subtitle) {
      slide.addText(data.subtitle, {
        x: MX,
        y: bodyTop - 0.4,
        w: BODY_W,
        h: 0.35,
        fontSize: SZ_SUBTITLE - 6,
        fontFace: FONT_PRIMARY,
        color: "888888",
        valign: "middle",
      });
    }
  }

  // Cards
  const cardCount = data.cards.length;
  const cardGap = 0.35;
  const totalGaps = (cardCount - 1) * cardGap;
  const cardW = (BODY_W - totalGaps) / cardCount;
  const cardY = bodyTop + 0.1;
  const cardH = bodyH - 0.5;

  const defaultAccents = [t.accent, t.secondaryAccent ?? t.accent, t.headerBg, "666666"];

  for (let ci = 0; ci < cardCount; ci++) {
    const card = data.cards[ci]!;
    const cardX = MX + ci * (cardW + cardGap);
    const cardAccent = card.accent_color || defaultAccents[ci % defaultAccents.length]!;

    // Card background với border
    addRoundRect(slide, cardX, cardY, cardW, cardH, t.cardBg ?? "FFFFFF", t.cardBorder ?? "E0E0E0");

    // Accent line trên cùng card
    addRect(slide, cardX + 0.1, cardY + 0.02, cardW - 0.2, 0.04, cardAccent);

    let innerY = cardY + ZA_CARD_PADDING + 0.1;
    const innerX = cardX + ZA_CARD_PADDING;
    const innerW = cardW - ZA_CARD_PADDING * 2;

    // Card icon
    if (card.icon) {
      // Icon lớn trong vòng tròn nền nhạt
      addRoundRect(slide, innerX, innerY, 0.65, 0.6, t.badgeBg ?? "F5F5F5", t.cardBorder ?? "E0E0E0");
      slide.addText(card.icon, {
        x: innerX,
        y: innerY,
        w: 0.65,
        h: 0.6,
        fontSize: SZ_CARD_ICON,
        fontFace: FONT_PRIMARY,
        align: "center",
        valign: "middle",
      });
      innerY += 0.7;
    }

    // Card title
    slide.addText(card.title, {
      x: innerX,
      y: innerY,
      w: innerW,
      h: 0.45,
      fontSize: SZ_CARD_TITLE,
      fontFace: FONT_PRIMARY,
      color: cardAccent,
      bold: true,
      valign: "middle",
    });
    innerY += 0.5;

    // Accent line dưới title
    addRect(slide, innerX, innerY, Math.min(innerW, 1.5), 0.025, cardAccent);
    innerY += 0.15;

    // Card items
    const maxItemH = (cardY + cardH - innerY - ZA_CARD_PADDING) / card.items.length;
    const itemH = Math.min(0.45, maxItemH);

    for (let ii = 0; ii < card.items.length; ii++) {
      const itemText = card.items[ii]!;
      const itemY = innerY + ii * itemH;

      // Bullet dot nhỏ
      slide.addText("•", {
        x: innerX,
        y: itemY,
        w: 0.2,
        h: itemH,
        fontSize: SZ_CARD_ITEM,
        fontFace: FONT_PRIMARY,
        color: cardAccent,
        align: "center",
        valign: "middle",
      });

      const textRuns = parseBoldRuns(itemText);
      const formatted = textRuns.map((r) => ({
        text: r.text,
        options: {
          fontSize: SZ_CARD_ITEM,
          fontFace: FONT_PRIMARY,
          color: r.options?.bold ? cardAccent : t.bodyText,
          bold: r.options?.bold ?? false,
        },
      }));

      slide.addText(formatted as any, {
        x: innerX + 0.22,
        y: itemY,
        w: innerW - 0.22,
        h: itemH,
        valign: "middle",
      });
    }
  }
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

  const bodyTop = isCardTheme(t) ? ZA_BODY_TOP : BODY_TOP;

  if (isCardTheme(t)) {
    addTopBar(slide, t);
    // Tiêu đề trên nền trắng
    slide.addText(data.title, {
      x: MX,
      y: bodyTop - 1.0,
      w: BODY_W,
      h: 0.6,
      fontSize: SZ_SLIDE_TITLE + 2,
      fontFace: FONT_PRIMARY,
      color: t.titleText ?? t.headerBg,
      bold: true,
      valign: "middle",
    });
    addRect(slide, MX, bodyTop - 0.25, BODY_W, 0.03, t.accent);
  } else {
    addHeaderBar(slide, data.title, t);
  }
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
    y: bodyTop,
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
  if (isCardTheme(t)) {
    // Zaloagent quote: nền trắng, accent cam, dấu ngoặc cam
    slide.background = { color: t.slideBg };
    addTopBar(slide, t);
    addRect(slide, 0, H - 0.04, W, 0.04, t.accent);

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

    slide.addText(data.quote, {
      x: MX + 1.0,
      y: 2.0,
      w: BODY_W - 2.0,
      h: 3.0,
      fontSize: SZ_QUOTE,
      fontFace: FONT_SERIF,
      color: t.titleText ?? t.headerBg,
      italic: true,
      align: "center",
      valign: "middle",
      lineSpacingMultiple: 1.4,
    });

    if (data.source) {
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
    return;
  }

  // Classic
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

/** Top bar gradient mỏng cho theme zaloagent */
function addTopBar(slide: Slide, t: PptxTheme) {
  const bar1 = t.topBarColor1 ?? t.accent;
  const bar2 = t.topBarColor2 ?? t.secondaryAccent ?? t.accent;
  addRect(slide, 0, 0, W / 2, ZA_TOP_BAR_H, bar1);
  addRect(slide, W / 2, 0, W / 2, ZA_TOP_BAR_H, bar2);
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

/** Vẽ hình chữ nhật bo tròn (dùng cho card) — pptxgenjs roundRect */
function addRoundRect(
  slide: Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: string,
  borderColor: string,
) {
  slide.addShape("roundRect" as any, {
    x,
    y,
    w,
    h,
    fill: { color: fillColor },
    line: { color: borderColor, width: 1 },
    rectRadius: ZA_CARD_RADIUS,
  });
}

/** Badge / tag nhỏ dạng bo tròn nền nhạt */
function addBadge(slide: Slide, text: string, x: number, y: number, t: PptxTheme) {
  const badgeW = Math.max(2.0, text.length * 0.12 + 0.4);
  addRoundRect(slide, x, y, badgeW, 0.32, t.badgeBg ?? "E8F5E9", t.cardBorder ?? "E0E0E0");
  slide.addText(text, {
    x,
    y,
    w: badgeW,
    h: 0.32,
    fontSize: SZ_BADGE,
    fontFace: FONT_PRIMARY,
    color: t.badgeText ?? "2E7D32",
    align: "center",
    valign: "middle",
    bold: true,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TEXT FORMATTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Normalize bullet item: string → {text}, {icon, text} → pass-through */
type NormalizedBulletItem = { icon?: string; text: string };

function normalizeBulletItems(
  items: Array<string | { icon?: string; text: string }>,
): NormalizedBulletItem[] {
  return items.map((item) =>
    typeof item === "string" ? { text: item } : item,
  );
}

/** Dựng nội dung cột cho slide hai cột (classic) */
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
    redAccent: t.redAccent,
  });
  result.push(...bulletItems);
  return result;
}

/**
 * Flatten mảng bullet text (có thể chứa **đậm** hoặc <red>đỏ</red>) thành mảng TextProps phẳng
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
  redAccent?: string;
};

function flattenBullets(
  bullets: string[],
  style: BulletStyle,
): Array<{ text: string; options: Record<string, any> }> {
  const result: Array<{ text: string; options: Record<string, any> }> = [];

  for (const bulletText of bullets) {
    const runs = parseTextRuns(bulletText);
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i]!;
      const isFirst = i === 0;
      result.push({
        text: run.text,
        options: {
          fontSize: style.fontSize,
          fontFace: style.fontFace,
          color: run.red ? (style.redAccent ?? style.color) : style.color,
          bold: run.bold ?? false,
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

/**
 * Parse inline markup thành text runs:
 * - **đậm** → bold
 * - <red>đỏ</red> → red highlight (giống file mẫu TTHC / PAKN dùng đỏ nhấn mạnh)
 * - ~~gạch ngang~~ <red>từ mới</red> → strikethrough + red (rà soát sửa lỗi)
 */
type TextRun = { text: string; bold?: boolean; red?: boolean };

function parseTextRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Match **bold**, <red>red</red>, or ~~strikethrough~~
  const RE = /\*{2}([^*]+)\*{2}|<red>([^<]*)<\/red>/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = RE.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      // **bold**
      runs.push({ text: m[1], bold: true });
    } else if (m[2] !== undefined) {
      // <red>text</red>
      runs.push({ text: m[2], red: true, bold: true });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });

  return runs.length > 0 ? runs : [{ text }];
}

/** Backward-compatible alias — dùng bởi buildColumnContent và renderCardColumn */
function parseBoldRuns(text: string): Array<{ text: string; options?: { bold?: boolean } }> {
  return parseTextRuns(text).map((r) => ({
    text: r.text,
    options: r.bold ? { bold: true } : undefined,
  }));
}

