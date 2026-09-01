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

/** Slide trang bìa */
const titleSlide = z.object({
  type: z.literal("title_slide"),
  title: z.string().min(1).describe("Tiêu đề chính bài trình chiếu"),
  subtitle: z.string().optional().describe("Phụ đề (thời gian, phạm vi, đơn vị)"),
  author: z.string().optional().describe("Tên tác giả / đơn vị trình bày"),
});

/** Slide ngăn phần - chuyển tiếp giữa các mục lớn */
const sectionSlide = z.object({
  type: z.literal("section_slide"),
  title: z.string().min(1).describe("Tên phần, vd: 'Phần II: Kết quả thực hiện'"),
  subtitle: z.string().optional().describe("Mô tả ngắn phần này"),
});

/** Slide nội dung chính - tiêu đề + danh sách bullet */
const contentSlide = z.object({
  type: z.literal("content_slide"),
  title: z.string().min(1).describe("Tiêu đề slide"),
  bullets: z
    .array(z.string().min(1))
    .min(1)
    .max(8)
    .describe("Các ý chính, mỗi ý ngắn gọn 1-2 dòng. Bôi đậm bằng **chữ đậm**"),
});

/** Slide hai cột - so sánh, đối chiếu */
const twoColumnsSlide = z.object({
  type: z.literal("two_columns_slide"),
  title: z.string().min(1).describe("Tiêu đề slide"),
  left_title: z.string().optional().describe("Tiêu đề cột trái"),
  left_items: z.array(z.string().min(1)).min(1).describe("Các ý cột trái"),
  right_title: z.string().optional().describe("Tiêu đề cột phải"),
  right_items: z.array(z.string().min(1)).min(1).describe("Các ý cột phải"),
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
  tableSlide,
  quoteSlide,
]);

export type PptxSlide = z.infer<typeof pptxSlideSchema>;

// Một số provider (đặc biệt Google) yêu cầu enum có literal string tĩnh trong schema.
// Giữ registry làm nguồn runtime nhưng khai báo enum tường minh cho JSON Schema ổn định.
export const pptxThemeSchema = z.enum(["navy", "blue", "green", "burgundy", "slate", "teal"]).optional().describe(
  "Tông màu: navy (trang trọng, mặc định) · blue (tài chính) · " +
    "green (nông nghiệp, môi trường) · burgundy (pháp lý) · " +
    "slate (kỹ thuật) · teal (y tế, giáo dục)",
);
