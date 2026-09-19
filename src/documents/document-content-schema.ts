import { z } from "zod";
import { XLSX_THEME_NAMES } from "./xlsx-themes.js";

/**
 * Schema nội dung tài liệu - hợp đồng giữa MODEL và renderer.
 *
 * Cố tình KHÔNG giống API của `docx`/`exceljs`: model chỉ cần hiểu vài khái niệm
 * quen thuộc (tiêu đề, đoạn văn, gạch đầu dòng, bảng), không phải biết DXA,
 * WidthType hay numFmt là gì. Đổi thư viện sau này chỉ sửa renderer - schema và
 * cách model gọi tool giữ nguyên.
 */

// ===== Tài liệu văn bản (.docx) =====

function normalizeString(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const text = obj.text ?? obj.content ?? obj.line ?? obj.value ?? "";
    let s = String(text);
    if (obj.bold && !s.startsWith("**")) s = `**${s}**`;
    if (obj.italic && !s.startsWith("*")) s = `*${s}*`;
    return s;
  }
  return String(val ?? "");
}

function normalizeStringArray(val: unknown): string[] {
  if (typeof val === "string") {
    const lines = val.split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.length > 0 ? lines : [val];
  }
  if (Array.isArray(val)) {
    const arr = val.map(normalizeString).filter((s) => s.trim().length > 0);
    return arr.length > 0 ? arr : [""];
  }
  if (val && typeof val === "object") {
    const s = normalizeString(val);
    return s.trim().length > 0 ? [s] : [""];
  }
  return [""];
}

const headingBlock = z.object({
  type: z.literal("heading"),
  text: z.preprocess(normalizeString, z.string().min(1)),
  /**
   * Cấp tiêu đề 1-3. CỐ Ý dùng khoảng số chứ KHÔNG dùng union của literal, dù
   * union diễn tả đúng ý hơn: schema này bay thẳng sang nhà cung cấp LLM, mà
   * union literal số dịch ra `enum: [1]` - trong khi `Schema.enum` của Google
   * là `repeated string`, chỉ nhận chuỗi. Nó chối cả request bằng 400
   * "(TYPE_STRING), 1", và vì bộ tool đi kèm mọi lượt nên bot câm hoàn toàn
   * (đã dính thật 06/08/2026, cùng họ với vụ `z.tuple()` ở ô công thức Excel).
   * Khoảng số ra `{"type":"integer","minimum":1,"maximum":3}` - không có `enum`
   * nên không vướng, mà vẫn chặn 0, 4 và số lẻ y như union.
   */
  level: z.number().int().min(1).max(3).default(2),
});

const paragraphBlock = z.object({
  type: z.literal("paragraph"),
  text: z
    .preprocess(normalizeString, z.string().min(1))
    .describe(
      "Đoạn văn xuôi. Đậm: **chữ đậm**, nghiêng: *chữ nghiêng*. " +
      "QUY TẮC BÔI ĐỎ KHI SỬA LỖI: Khi rà soát/sửa lỗi chính tả/biên tập câu từ, BẮT BUỘC dùng <red>từ đã sửa</red> (hoặc ~~từ cũ~~ <red>từ mới</red>) để bôi đỏ từ đã sửa trong file Word!"
    ),
  align: z
    .enum(["left", "center", "right", "justify"])
    .optional()
    .describe("center/right cho dòng lạc khoản (địa danh, ngày tháng); bỏ trống = justify"),
});

const bulletsBlock = z.object({
  type: z.literal("bullets"),
  items: z
    .preprocess(normalizeStringArray, z.array(z.string().min(1)).min(1))
    .describe("Các gạch đầu dòng (hỗ trợ <red>từ đã sửa</red> để bôi đỏ)"),
});

const tableBlock = z.object({
  type: z.literal("table"),
  headers: z.preprocess(normalizeStringArray, z.array(z.string()).min(1).max(8)),
  rows: z.preprocess(
    (val) => {
      if (Array.isArray(val)) {
        return val.map((row) => (Array.isArray(row) ? row.map(normalizeString) : normalizeStringArray(row)));
      }
      return [[""]];
    },
    z.array(z.array(z.string())).min(1),
  ),
});

/**
 * Hai cột đặt cạnh nhau, không viền - dành cho bố cục mà văn bản Việt Nam
 * dùng nhiều nhất: phần đầu văn bản hành chính (tên cơ quan bên trái, quốc
 * hiệu - tiêu ngữ bên phải) và khối ký tên cuối văn bản (nơi nhận bên trái,
 * chức vụ + tên người ký bên phải). Không có block này thì model phải fake
 * bằng khoảng trắng và bố cục vỡ ngay khi mở file.
 */
const twoColumnsBlock = z.object({
  type: z.literal("two_columns"),
  left: z.preprocess(normalizeStringArray, z.array(z.string()).min(1)).describe("Các dòng cột trái"),
  right: z.preprocess(normalizeStringArray, z.array(z.string()).min(1)).describe("Các dòng cột phải"),
  left_align: z
    .enum(["left", "center"])
    .optional()
    .describe("Căn lề cột trái: center (mặc định, cho header) hoặc left (cho Nơi nhận)"),
  right_align: z
    .enum(["left", "center"])
    .optional()
    .describe("Căn lề cột phải: center (mặc định)"),
  ratio: z
    .array(z.number().int().min(20).max(80))
    .length(2)
    .optional()
    .describe("Tỷ lệ % bề rộng [cột trái, cột phải], mặc định [40, 60]"),
});

/**
 * Đường kẻ ngang trang trí - NĐ 30 yêu cầu gạch dưới tên cơ quan ban hành
 * và dưới tiêu ngữ. AI chèn block này ngay sau dòng cần gạch dưới.
 */
const separatorBlock = z.object({
  type: z.literal("separator"),
  width_percent: z
    .number()
    .int()
    .min(10)
    .max(100)
    .default(33)
    .describe("Chiều rộng đường kẻ (% bề rộng vùng nội dung): 33 cho cơ quan, 100 cho tiêu ngữ"),
});

const baseDocumentBlockSchema = z.discriminatedUnion("type", [
  headingBlock,
  paragraphBlock,
  bulletsBlock,
  tableBlock,
  twoColumnsBlock,
  separatorBlock,
]);

export const documentBlockSchema = z.preprocess((val: any) => {
  if (val && typeof val === "object") {
    const obj = { ...val };
    if (obj.type === "two_columns") {
      // Trường hợp model gửi `columns: [col1, col2]`
      if (Array.isArray(obj.columns) && obj.columns.length >= 2) {
        if (!obj.left) obj.left = obj.columns[0];
        if (!obj.right) obj.right = obj.columns[1];
      }
      // Pattern thực tế: model Đảng gửi col1/col2 thay vì left/right
      if (!obj.left && (obj.col1 || obj.column1 || obj.left_lines || obj.left_column)) {
        obj.left = obj.col1 || obj.column1 || obj.left_lines || obj.left_column;
      }
      if (!obj.right && (obj.col2 || obj.column2 || obj.right_lines || obj.right_column)) {
        obj.right = obj.col2 || obj.column2 || obj.right_lines || obj.right_column;
      }
      // Pattern thực tế: widths → ratio (model gửi widths: [45,55] thay vì ratio)
      if (!obj.ratio && Array.isArray(obj.widths) && obj.widths.length === 2) {
        obj.ratio = obj.widths;
      }
      if (!obj.ratio && Array.isArray(obj.width) && obj.width.length === 2) {
        obj.ratio = obj.width;
      }
      if (!obj.left) obj.left = [""];
      if (!obj.right) obj.right = [""];
    } else if (obj.type === "paragraph") {
      if (!obj.text && obj.paragraph) {
        if (typeof obj.paragraph === "string") obj.text = obj.paragraph;
        else if (typeof obj.paragraph === "object") {
          const p = obj.paragraph as Record<string, unknown>;
          obj.text = p.text ?? p.content ?? "";
          if (p.align && !obj.align) obj.align = p.align;
        }
      }
      // Pattern thực tế: model dùng content/value/description thay vì text
      if (!obj.text && obj.content) {
        obj.text = typeof obj.content === "string" ? obj.content : JSON.stringify(obj.content);
      }
      if (!obj.text && obj.value) {
        obj.text = typeof obj.value === "string" ? obj.value : JSON.stringify(obj.value);
      }
      if (!obj.text && obj.description) {
        obj.text = String(obj.description);
      }
    } else if (obj.type === "heading") {
      // Pattern thực tế: model gửi heading thay vì text, hoặc title thay vì text
      if (!obj.text && obj.heading) {
        obj.text = typeof obj.heading === "string" ? obj.heading : obj.heading.text;
      }
      if (!obj.text && obj.title) {
        obj.text = typeof obj.title === "string" ? obj.title : String(obj.title);
      }
      if (!obj.text && obj.content) {
        obj.text = typeof obj.content === "string" ? obj.content : String(obj.content);
      }
      if (!obj.text && obj.value) {
        obj.text = typeof obj.value === "string" ? obj.value : String(obj.value);
      }
      // Pattern thực tế: model gửi {type: "heading"} rỗng → default text
      if (!obj.text) {
        obj.text = "—";
      }
    } else if (obj.type === "bullets") {
      if (!obj.items && (obj.bullets || obj.lines || obj.list || obj.content)) {
        obj.items = obj.bullets || obj.lines || obj.list || obj.content;
      }
    } else if (obj.type === "table") {
      // Pattern thực tế: model dùng data/body thay vì rows, columns thay vì headers
      if (!obj.rows && (obj.data || obj.body)) {
        obj.rows = obj.data || obj.body;
      }
      if (!obj.headers && obj.columns && Array.isArray(obj.columns)) {
        // Chỉ khi columns là string[] (tên cột), không phải object[]
        if (obj.columns.every((c: unknown) => typeof c === "string")) {
          obj.headers = obj.columns;
        }
      }
    }
    return obj;
  }
  return val;
}, baseDocumentBlockSchema);

export type DocumentBlock = z.infer<typeof documentBlockSchema>;

// ===== Bảng tính (.xlsx) =====

/**
 * Ô công thức chỉ nhận PHÉP CÓ SẴN, không nhận công thức tự do.
 *
 * Lý do: file phải kèm giá trị đã tính (`<v>`) thì công cụ xem trước mới hiện số
 * thay vì ô trống. Bot chỉ tính được kết quả khi biết chính xác phép đang làm -
 * cho model gõ "=SUMIFS(...)" thì không tính nổi.
 */
const columnLetter = z
  .string()
  .regex(/^[A-Za-z]{1,2}$/)
  .transform((s) => s.toUpperCase());

const multiplyFormula = z.object({
  kind: z.literal("formula"),
  op: z.literal("multiply"),
  /**
   * Chữ cái 2 cột cùng dòng cần nhân, vd ["B", "C"].
   *
   * CỐ Ý dùng `array().length(2)` chứ KHÔNG dùng `z.tuple()`, dù tuple diễn tả
   * đúng ý hơn: schema này bay thẳng sang nhà cung cấp LLM, mà `z.tuple()` dịch
   * ra JSON Schema kiểu draft-07 với `items` là một MẢNG. Lớp OpenAI-compatible
   * của Google chỉ nhận 2020-12, ở đó `items` bắt buộc là object hoặc boolean,
   * nên nó chối CẢ REQUEST bằng 400 - và vì bộ tool đi kèm mọi lượt, bot câm
   * hoàn toàn chứ không riêng lượt nào nhờ làm Excel (đã dính thật 06/08/2026).
   * Ràng buộc lúc chạy y hệt tuple: đúng 2 phần tử, mỗi phần tử đúng dạng cột.
   */
  columns: z.array(columnLetter).length(2),
});

const sumFormula = z.object({
  kind: z.literal("formula"),
  op: z.literal("sum"),
  /** Cột cần cộng, vd "D" */
  column: columnLetter,
  /** Cộng từ dòng nào tới dòng nào (số dòng như hiện trên Excel, tính cả header) */
  fromRow: z.number().int().min(1),
  toRow: z.number().int().min(1),
});

const textCell = z.object({
  kind: z.literal("text"),
  value: z.string(),
});

const numberCell = z.object({
  kind: z.literal("number"),
  value: z.number(),
  /** money = #,##0 (đơn vị ghi ở header) · percent = 0.0% (lưu dạng phân số) */
  format: z.enum(["plain", "money", "percent"]).default("plain"),
});

const MULTIPLY_RE = /^=\s*([A-Za-z]{1,2})\d+\s*\*\s*([A-Za-z]{1,2})\d+\s*$/;
const SUM_RE = /^=\s*SUM\(\s*([A-Za-z]{1,2})(\d+)\s*:\s*([A-Za-z]{1,2})(\d+)\s*\)\s*$/i;

/**
 * Công thức viết dạng chuỗi "=B2*C2" / "=SUM(D2:D9)" - đây là cách model viết
 * TỰ NHIÊN nhất (đã thấy DeepSeek làm đúng vậy khi test), nên phải nhận thay vì
 * bắt nó học cấu trúc object riêng. Chuỗi "=" khác 2 dạng này bị từ chối kèm
 * hướng dẫn để model đổi sang số tính sẵn.
 */
const formulaString = z
  .string()
  .regex(/^=/)
  .transform((raw, ctx) => {
    const mul = raw.match(MULTIPLY_RE);
    if (mul) {
      return {
        kind: "formula",
        op: "multiply",
        columns: [mul[1]!.toUpperCase(), mul[2]!.toUpperCase()],
      } as const;
    }
    const sum = raw.match(SUM_RE);
    if (sum && sum[1]!.toUpperCase() === sum[3]!.toUpperCase()) {
      return {
        kind: "formula",
        op: "sum",
        column: sum[1]!.toUpperCase(),
        fromRow: Number(sum[2]),
        toRow: Number(sum[4]),
      } as const;
    }
    ctx.addIssue({
      code: "custom",
      message: `Chỉ hỗ trợ công thức "=B2*C2" (nhân 2 ô cùng dòng) hoặc "=SUM(D2:D9)" (cộng 1 cột). Công thức khác hãy tự tính rồi gửi số.`,
    });
    return z.NEVER;
  });

/**
 * Một ô nhận được NHIỀU dạng - chuỗi/số thuần là cách model gửi tự nhiên nhất
 * (giống bảng của tài liệu Word), object là dạng đầy đủ khi cần format.
 *
 * Dùng z.union thường, TUYỆT ĐỐI không discriminatedUnion theo "kind": hai
 * schema công thức cùng kind="formula" làm zod ném "Duplicate discriminator
 * value" ở MỌI lần parse - lỗi này từng làm create_excel_file chết 100% trên
 * Zalo thật trong khi toàn bộ test vẫn xanh (test gọi thẳng execute, không
 * qua tầng validate). Xem test hồi quy trong document-content-schema.test.ts.
 */
export const spreadsheetCellSchema = z.union([
  textCell,
  numberCell,
  multiplyFormula,
  sumFormula,
  formulaString,
  // Chuỗi "=" phải rơi vào formulaString ở trên - lọt xuống đây thành text là
  // công thức sai âm thầm biến thành chữ, người dùng không bao giờ biết
  z
    .string()
    .refine((s) => !s.startsWith("="))
    .transform((value) => ({ kind: "text", value }) as const),
  z.number().transform((value) => ({ kind: "number", value, format: "plain" }) as const),
]);

export type SpreadsheetCell = z.output<typeof spreadsheetCellSchema>;

export const sheetSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe('Tên sheet GIỮ NGUYÊN dấu tiếng Việt, vd "Tổng quan" (không viết "Tong quan")'),
  /** Bảng màu - model chọn theo ngữ cảnh tài liệu, không tự do hex */
  theme: z
    .enum(XLSX_THEME_NAMES)
    .optional()
    .describe(
      "Tông màu hợp nội dung: navy (trang trọng, mặc định) · blue (tài chính, báo giá) · " +
        "green (tăng trưởng, nông nghiệp, môi trường) · burgundy (rủi ro, pháp lý, sự cố) · " +
        "slate (kỹ thuật, vận hành) · teal (y tế, giáo dục, dịch vụ)",
    ),
  /** Banner tiêu đề nổi bật ở đầu sheet - nên có với báo cáo */
  title: z.string().optional().describe('Tiêu đề lớn đầu sheet, vd "BÁO CÁO TỔNG HỢP..."'),
  subtitle: z.string().optional().describe("Dòng phụ đề nhỏ dưới tiêu đề (phạm vi, khoảng thời gian)"),
  headers: z.array(z.string()).min(1).max(20),
  rows: z
    .array(z.array(spreadsheetCellSchema))
    .describe("Các dòng dữ liệu; có thể để rỗng khi người dùng yêu cầu file mẫu chỉ gồm tiêu đề và cột"),
  /** Ghi chú đỏ nghiêng cuối bảng - dùng cho lưu ý quan trọng, nguồn số liệu */
  note: z.string().optional().describe("Ghi chú/lưu ý quan trọng hiện cuối bảng"),
});

export type Sheet = z.output<typeof sheetSchema>;
