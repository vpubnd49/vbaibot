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
});

/** Slide nội dung chính - tiêu đề + danh sách bullet (có thể kèm icon) */
const contentSlide = z.object({
  type: z.literal("content_slide"),
  title: z.string().min(1).describe("Tiêu đề slide"),
  subtitle: z.string().optional().describe("Dòng mô tả phụ dưới tiêu đề (theme zaloagent hiển thị đẹp)"),
  bullets: z
    .array(
      z.union([
        z.string().min(1),
        iconItemSchema,
      ]),
    )
    .min(1)
    .max(8)
    .describe(
      "Các ý chính. Mỗi phần tử có thể là string (bullet thường) hoặc {icon, text} (bullet kèm icon emoji). " +
      "Bôi đậm bằng **chữ đậm**",
    ),
});

/** Slide hai cột - so sánh, đối chiếu */
const twoColumnsSlide = z.object({
  type: z.literal("two_columns_slide"),
  title: z.string().min(1).describe("Tiêu đề slide"),
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
  cards: z.array(featureCardSchema).min(2).max(4).describe("Danh sách 2-4 card tính năng, mỗi card gồm icon + title + items"),
});

/** Slide bảng số liệu */
const tableSlide = z.object({
  type: z.literal("table_slide"),
  title: z.string().min(1).describe("Tiêu đề slide"),
  headers: z.array(z.string()).min(1).max(6).describe("Tiêu đề các cột"),
  rows: z.array(z.array(z.string())).min(1).max(15).describe("Dữ liệu các dòng"),
});

/** Slide trích dẫn / nhấn mạnh */
const quoteSlide = z.object({
  type: z.literal("quote_slide"),
  quote: z.string().min(1).describe("Câu trích dẫn hoặc thông điệp nhấn mạnh"),
  source: z.string().optional().describe("Nguồn trích dẫn (tên người, văn bản)"),
});

export const pptxSlideSchema = z.discriminatedUnion("type", [
  titleSlide,
  sectionSlide,
  contentSlide,
  twoColumnsSlide,
  featureCardsSlide,
  tableSlide,
  quoteSlide,
]);

export type PptxSlide = z.infer<typeof pptxSlideSchema>;

// Một số provider (đặc biệt Google) yêu cầu enum có literal string tĩnh trong schema.
// Giữ registry làm nguồn runtime nhưng khai báo enum tường minh cho JSON Schema ổn định.
export const pptxThemeSchema = z.enum(["navy", "blue", "green", "burgundy", "slate", "teal", "zaloagent"]).optional().describe(
  "Tông màu: navy (trang trọng, mặc định) · blue (tài chính) · " +
    "green (nông nghiệp, môi trường) · burgundy (pháp lý) · " +
    "slate (kỹ thuật) · teal (y tế, giáo dục) · " +
    "zaloagent (trắng sạch, card layout hiện đại, accent cam/xanh lá — phù hợp giới thiệu sản phẩm, pitch deck)",
);
