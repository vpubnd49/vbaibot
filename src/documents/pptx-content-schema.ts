import { z } from "zod";
/**
 * Schema nội dung trình chiếu PowerPoint - hợp đồng giữa MODEL và renderer.
 *
 * Giống tư duy document-content-schema.ts: model chỉ cần hiểu vài khái niệm
 * quen thuộc (tiêu đề, bullet, bảng, trích dẫn), không phải biết API pptxgenjs.
 *
 * CẨN THẬN tương thích LLM Provider:
 * - Không dùng union literal số (Google Schema.enum chỉ nhận string)
 * - Không dùng z.tuple() (gây lỗi JSON schema draft-07)
 */

// ─── Shared sub-schemas ──────────────────────────────────────────────────────

/** Item có icon (emoji/unicode) dùng cho bullet hoặc card */
const iconItemSchema = z.object({
  icon: z.string().optional().describe("Emoji / icon Unicode, vd: \"📊\", \"✅\", \"🔍\". Bỏ trống nếu không cần icon."),
  text: z.string().min(1).describe("Nội dung ý chính. Bôi đậm bằng **chữ đậm**"),
});

/** Card trong feature_cards_slide */
const featureCardSchema = z.object({
  icon: z.string().optional().describe("Emoji / icon Unicode cho card, vd: \"📄\", \"🎨\""),
  title: z.string().min(1).describe("Tiêu đề card"),
  items: z.array(z.string().min(1)).min(1).max(8).describe("Danh sách tính năng / ý trong card"),
  accent_color: z.string().optional().describe("Mã màu hex accent riêng cho card, vd: \"FF6B35\" (cam), \"2E7D32\" (xanh lá). Bỏ trống dùng màu mặc định."),
});

/** Slide trang bìa */
const titleSlide = z.object({
  type: z.literal("title_slide"),
  title: z.string().min(1).describe("Tiêu đề chính bài trình chiếu"),
  subtitle: z.string().optional().describe("Phụ đề (thời gian, phạm vi, đơn vị)"),
  author: z.string().optional().describe("Tên tác giả / đơn vị trình bày"),
  badge: z.string().optional().describe("Badge/tag nhỏ phía trên tiêu đề, vd: '🟢 Hoạt động 24/7', '● ZALO AGENT'"),
});

/** Slide ngăn phần - chuyển tiếp giữa các mục lớn */
const sectionSlide = z.object({
  type: z.literal("section_slide"),
  title: z.string().min(1).describe("Tên phần, vd: 'Phần II: Kết quả thực hiện'"),
  subtitle: z.string().optional().describe("Mô tả ngắn phần này"),
  badge: z.string().optional(),
});

/** Slide nội dung chính - tiêu đề + danh sách bullet (có thể kèm icon) */
const contentSlide = z.object({
  type: z.literal("content_slide"),
  title: z.string().min(1).describe("Tiêu đề slide"),
  subtitle: z.string().optional().describe("Dòng mô tả phụ dưới tiêu đề"),
  badge: z.string().optional(),
  bullets: z
    .array(
      z.union([
        z.string().min(1),
        iconItemSchema,
      ]),
    )
    .min(1)
    .max(20)
    .describe(
      "Các ý chính. Mỗi phần tử có thể là string (bullet thường) hoặc {icon, text} (bullet kèm icon emoji). " +
      "Bôi đậm bằng **chữ đậm**",
    ),
});

/** Slide hai cột - so sánh, đối chiếu */
const twoColumnsSlide = z.object({
  type: z.literal("two_columns_slide"),
  title: z.string().min(1).describe("Tiêu đề slide"),
  subtitle: z.string().optional(),
  badge: z.string().optional(),
  left_title: z.string().optional().describe("Tiêu đề cột trái"),
  left_icon: z.string().optional().describe("Emoji icon cho tiêu đề cột trái, vd: \"📋\""),
  left_items: z.array(
    z.union([z.string().min(1), iconItemSchema]),
  ).min(1).describe("Các ý cột trái — string hoặc {icon, text}"),
  right_title: z.string().optional().describe("Tiêu đề cột phải"),
  right_icon: z.string().optional().describe("Emoji icon cho tiêu đề cột phải, vd: \"🔗\""),
  right_items: z.array(
    z.union([z.string().min(1), iconItemSchema]),
  ).min(1).describe("Các ý cột phải — string hoặc {icon, text}"),
});

/** Slide thẻ tính năng dạng card — layout giống SaaS pitch deck (2-4 card cạnh nhau) */
const featureCardsSlide = z.object({
  type: z.literal("feature_cards_slide"),
  title: z.string().min(1).describe("Tiêu đề slide"),
  subtitle: z.string().optional().describe("Mô tả phụ dưới tiêu đề"),
  badge: z.string().optional().describe("Badge/tag nhỏ phía trên tiêu đề, vd: '● ZALO AGENT · TÍNH NĂNG'"),
  cards: z.array(featureCardSchema).min(1).max(6).describe("Danh sách 2-4 card tính năng, mỗi card gồm icon + title + items"),
});

/** Slide bảng số liệu */
const tableSlide = z.object({
  type: z.literal("table_slide"),
  title: z.string().min(1).describe("Tiêu đề slide"),
  subtitle: z.string().optional(),
  badge: z.string().optional(),
  headers: z.array(z.string()).min(1).max(10).describe("Tiêu đề các cột"),
  rows: z.array(z.array(z.string())).min(1).max(25).describe("Dữ liệu các dòng"),
});

/** Slide trích dẫn / nhấn mạnh */
const quoteSlide = z.object({
  type: z.literal("quote_slide"),
  quote: z.string().min(1).describe("Câu trích dẫn hoặc thông điệp nhấn mạnh"),
  source: z.string().optional().describe("Nguồn trích dẫn (tên người, văn bản)"),
  badge: z.string().optional(),
});

const rawUnion = z.discriminatedUnion("type", [
  titleSlide,
  sectionSlide,
  contentSlide,
  twoColumnsSlide,
  featureCardsSlide,
  tableSlide,
  quoteSlide,
]);

export const pptxSlideSchema = z.preprocess((val: any) => {
  if (val && typeof val === "object") {
    const copy: any = { ...val };

    // 1. Ánh xạ camelCase sang snake_case
    if (copy.subTitle && !copy.subtitle) copy.subtitle = copy.subTitle;
    if (copy.leftTitle && !copy.left_title) copy.left_title = copy.leftTitle;
    if (copy.rightTitle && !copy.right_title) copy.right_title = copy.rightTitle;
    if (copy.leftIcon && !copy.left_icon) copy.left_icon = copy.leftIcon;
    if (copy.rightIcon && !copy.right_icon) copy.right_icon = copy.rightIcon;
    if (copy.leftItems && !copy.left_items) copy.left_items = copy.leftItems;
    if (copy.rightItems && !copy.right_items) copy.right_items = copy.rightItems;
    if (copy.accentColor && !copy.accent_color) copy.accent_color = copy.accentColor;

    // 2. Ánh xạ items / points / content sang bullets
    if (!copy.bullets && Array.isArray(copy.items)) copy.bullets = copy.items;
    if (!copy.bullets && Array.isArray(copy.points)) copy.bullets = copy.points;
    if (!copy.bullets && Array.isArray(copy.content)) copy.bullets = copy.content;

    // 3. Đoán type nếu thiếu hoặc model điền sai
    if (!copy.type || typeof copy.type !== "string") {
      if (Array.isArray(copy.cards)) copy.type = "feature_cards_slide";
      else if (Array.isArray(copy.headers) || Array.isArray(copy.rows)) copy.type = "table_slide";
      else if (copy.quote) copy.type = "quote_slide";
      else if (copy.left_items || copy.right_items) copy.type = "two_columns_slide";
      else if (Array.isArray(copy.bullets)) copy.type = "content_slide";
      else if (copy.author || (copy.badge && !copy.bullets)) copy.type = "title_slide";
      else copy.type = "content_slide";
    }

    // 4. Chuẩn hóa theo từng type cụ thể
    if (copy.type === "content_slide") {
      if (!copy.title) copy.title = copy.subtitle || "Nội dung chính";
      if (!Array.isArray(copy.bullets) || copy.bullets.length === 0) {
        const fallback = typeof copy.content === "string" ? copy.content : "Nội dung";
        copy.bullets = [fallback];
      }
      copy.bullets = copy.bullets.map((b: any) => {
        if (typeof b === "string") return b.trim() || " ";
        if (b && typeof b === "object") {
          return {
            icon: b.icon || undefined,
            text: b.text || b.content || b.title || b.desc || String(b),
          };
        }
        return String(b || " ");
      });
      if (copy.bullets.length > 20) copy.bullets = copy.bullets.slice(0, 20);
    } else if (copy.type === "two_columns_slide") {
      if (!copy.title) copy.title = copy.subtitle || "Nội dung so sánh";
      if (!Array.isArray(copy.left_items) || copy.left_items.length === 0) copy.left_items = ["Ý chính 1"];
      if (!Array.isArray(copy.right_items) || copy.right_items.length === 0) copy.right_items = ["Ý chính 2"];
    } else if (copy.type === "title_slide") {
      if (!copy.title) copy.title = copy.subtitle || copy.badge || "Bài trình chiếu";
    } else if (copy.type === "section_slide") {
      if (!copy.title) copy.title = copy.subtitle || "Phần tiếp theo";
    } else if (copy.type === "quote_slide") {
      if (!copy.quote) copy.quote = copy.title || copy.content || "Thông điệp chính";
    } else if (copy.type === "table_slide") {
      if (!copy.title) copy.title = copy.subtitle || "Bảng số liệu";
      if (!Array.isArray(copy.headers) || copy.headers.length === 0) copy.headers = ["Hạng mục", "Chi tiết"];
      if (!Array.isArray(copy.rows) || copy.rows.length === 0) copy.rows = [["Dữ liệu", "Chi tiết"]];
    } else if (copy.type === "feature_cards_slide") {
      if (!copy.title) copy.title = copy.subtitle || "Các tính năng";
      if (!Array.isArray(copy.cards) || copy.cards.length === 0) {
        copy.cards = [{ title: "Hạng mục 1", items: ["Chi tiết"] }];
      }
    }

    return copy;
  }
  return val;
}, rawUnion);

export type PptxSlide = z.infer<typeof rawUnion>;

// Một số provider (đặc biệt Google) yêu cầu enum có literal string tĩnh trong schema.
// Giữ registry làm nguồn runtime nhưng khai báo enum tường minh cho JSON Schema ổn định.
export const pptxThemeSchema = z.enum(["navy", "blue", "green", "burgundy", "slate", "teal", "zaloagent"]).optional().describe(
  "Tông màu: navy (trang trọng, mặc định) · blue (tài chính) · " +
    "green (nông nghiệp, môi trường) · burgundy (pháp lý) · " +
    "slate (kỹ thuật) · teal (y tế, giáo dục) · " +
    "zaloagent (trắng sạch, card layout hiện đại, accent cam/xanh lá — phù hợp giới thiệu sản phẩm, pitch deck)",
);
