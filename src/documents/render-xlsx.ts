import ExcelJS from "exceljs";
import type { Sheet, SpreadsheetCell } from "./document-content-schema.js";
import { computeSheetValues } from "./spreadsheet-formula-values.js";
import {
  addNoteRow,
  addSubtitleRow,
  addTitleRow,
  cellBorder,
  FONT_NAME,
  FONT_SIZE,
  styleHeaderRow,
} from "./render-xlsx-styles.js";
import { resolveTheme, type XlsxTheme } from "./xlsx-themes.js";

/**
 * Dựng file .xlsx từ nội dung model cung cấp.
 *
 * LUẬT BẤT DI BẤT DỊCH: mọi ô công thức phải kèm `result`. Thiếu nó thì file chỉ
 * có `<f>` mà không có `<v>`, và mọi công cụ xem trước sẽ hiện ô TRỐNG. Đó là lý
 * do duy nhất project chọn exceljs thay vì thư viện nhẹ hơn - xem test hồi quy
 * trong render-xlsx.test.ts.
 *
 * Style (banner navy, header trắng trên navy, số xanh, ghi chú đỏ) bóc từ file
 * mẫu của skill xlsx Anthropic - nằm ở `render-xlsx-styles.ts`.
 */

// Đo trên file mẫu được chấm là đẹp: cột STT 5, cột nội dung 34-42.
// Rộng hơn 42 thì dòng chữ dài quá tầm mắt, hẹp hơn 5 thì số 2 chữ số bị ###
const MIN_COLUMN_WIDTH = 5;
const MAX_COLUMN_WIDTH = 42;

const NUMBER_FORMAT = {
  plain: "#,##0",
  money: "#,##0",
  // Lưu dạng phân số: 0.15 hiện thành 15.0%
  percent: "0.0%",
} as const;

/** Excel cấm : \ / ? * [ ] trong tên sheet và giới hạn 31 ký tự */
export function safeSheetName(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31);
  return cleaned || fallback;
}

/**
 * Bảng màu cho tag `<color>text</color>` trong ô text Excel.
 * Dùng cho thanh Gantt (mỗi giai đoạn một màu) và highlight trong bảng.
 * ARGB không có alpha prefix vì ExcelJS font.color.argb dùng 6-ký-tự.
 */
const TEXT_COLORS: Record<string, string> = {
  blue:     "2F5496",
  green:    "548235",
  orange:   "ED7D31",
  purple:   "7030A0",
  red:      "C00000",
  teal:     "17646B",
  navy:     "1F3864",
  brown:    "8B6914",
  gray:     "808080",
  // Aliases tiếng Việt - model đôi khi dùng
  xanh:     "2F5496",
  "xanh lá":"548235",
  cam:      "ED7D31",
  tím:      "7030A0",
  đỏ:       "C00000",
  nâu:      "8B6914",
  xám:      "808080",
};

/**
 * Regex bắt cả bold `**text**` lẫn color `<color>text</color>`.
 * Thiết kế để bắt lồng nhau: `<blue>**GĐ 1**████</blue>`.
 * Thứ tự: color tag ưu tiên trước, bold parse bên trong mỗi segment.
 */
const COLOR_TAG_RE = /<(\w[\w\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]*)>([\s\S]*?)<\/\1>/g;

/**
 * Ô chữ có marker `**đậm**` và/hoặc `<color>text</color>` -> rich text
 * của ExcelJS. Model được dạy cả hai marker (tool Word dùng **bold**,
 * Gantt chart dùng color tag) nên ô Excel cũng phải hiểu.
 * Font phải khai lại từng đoạn vì rich text ghi đè font của ô.
 */
function textCellValue(text: string): ExcelJS.CellValue {
  const hasColor = COLOR_TAG_RE.test(text);
  COLOR_TAG_RE.lastIndex = 0; // reset regex state
  const hasBold = text.includes("**");
  if (!hasColor && !hasBold) return text;

  const runs: ExcelJS.RichText[] = [];
  let lastIndex = 0;

  // Bước 1: tách ra các đoạn có color tag và không có
  const segments: { text: string; color?: string }[] = [];
  if (hasColor) {
    for (const match of text.matchAll(COLOR_TAG_RE)) {
      const before = text.slice(lastIndex, match.index);
      if (before) segments.push({ text: before });
      const colorName = match[1].toLowerCase().trim();
      segments.push({ text: match[2], color: TEXT_COLORS[colorName] });
      lastIndex = match.index! + match[0].length;
    }
    const tail = text.slice(lastIndex);
    if (tail) segments.push({ text: tail });
  } else {
    segments.push({ text });
  }

  // Bước 2: trong mỗi segment, parse **bold** markers
  for (const seg of segments) {
    const parts = seg.text.split(/\*\*([^*]+)\*\*/g);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      const font: Partial<ExcelJS.Font> = { name: FONT_NAME, size: FONT_SIZE };
      if (i % 2 === 1) font.bold = true;
      if (seg.color) font.color = { argb: seg.color };
      runs.push({ text: parts[i], font: font as ExcelJS.Font });
    }
  }

  return runs.length > 0 ? { richText: runs } : "";
}

/**
 * Giá trị đưa cho exceljs; ô công thức luôn kèm result đã tính sẵn.
 *
 * `rowOffset`: model đánh số dòng coi header là dòng 1, nhưng banner/subtitle
 * đẩy bảng xuống dưới - mọi tham chiếu dòng trong công thức phải cộng thêm
 * offset, không thì công thức trỏ nhầm vào banner.
 */
function cellValue(
  cell: SpreadsheetCell,
  excelRow: number,
  rowOffset: number,
  computed: number | null,
): ExcelJS.CellValue {
  if (cell.kind === "text") return textCellValue(cell.value);
  if (cell.kind === "number") return cell.value;

  const formula =
    cell.op === "multiply"
      ? `${cell.columns[0]}${excelRow}*${cell.columns[1]}${excelRow}`
      : `SUM(${cell.column}${cell.fromRow + rowOffset}:${cell.column}${cell.toRow + rowOffset})`;

  // result phải là số; không tính được thì để 0 còn hơn để trống (ô trống trong
  // preview trông như lỗi, số 0 thì người đọc biết ngay là chưa có dữ liệu)
  return { formula, result: computed ?? 0 };
}

/**
 * Style ô dữ liệu. Theo quy ước skill xlsx: số NHẬP TAY tô màu, ô công thức để
 * đen - người đọc phân biệt được đâu là dữ liệu gốc, đâu là kết quả tính. Màu
 * số lấy từ theme (đậm cùng tông) thay vì xanh thuần cho hài hòa cả trang.
 */
function styleDataCell(
  target: ExcelJS.Cell,
  cell: SpreadsheetCell,
  theme: XlsxTheme,
  isStripe: boolean,
): void {
  target.border = cellBorder(theme);
  // Sọc xen kẽ rất nhạt - mắt dò ngang bảng dài không bị lạc dòng
  if (isStripe) {
    target.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.stripe } };
  }
  if (cell.kind === "text") {
    target.font = { name: FONT_NAME, size: FONT_SIZE };
    target.alignment = { wrapText: true, vertical: "top" };
    return;
  }
  if (cell.kind === "number") {
    target.font = { name: FONT_NAME, size: FONT_SIZE, color: { argb: theme.number } };
    target.numFmt = NUMBER_FORMAT[cell.format];
    return;
  }
  target.font = { name: FONT_NAME, size: FONT_SIZE };
  target.numFmt = NUMBER_FORMAT.money;
}

/** Bề rộng cột theo nội dung dài nhất, kẹp trong khoảng dễ đọc (dài thì wrap) */
function columnWidth(header: string, rows: SpreadsheetCell[][], colIndex: number): number {
  let longest = header.length;
  for (const row of rows) {
    const cell = row[colIndex];
    if (!cell) continue;
    const text =
      cell.kind === "text"
        ? cell.value
        : cell.kind === "number"
          ? cell.value.toLocaleString("vi-VN")
          : "0.000.000";
    longest = Math.max(longest, text.length);
  }
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, longest + 2));
}

export async function renderXlsx(sheets: Sheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();

  sheets.forEach((sheet, sheetIndex) => {
    // exceljs THROW khi 2 sheet trùng tên (kể cả trùng sau khi sanitize) -
    // đánh số phía sau thay vì để chết cả file
    let name = safeSheetName(sheet.name, `Sheet${sheetIndex + 1}`);
    for (let n = 2; usedNames.has(name.toLowerCase()); n++) {
      name = `${safeSheetName(sheet.name, `Sheet${sheetIndex + 1}`).slice(0, 28)} ${n}`;
    }
    usedNames.add(name.toLowerCase());
    const ws = workbook.addWorksheet(name);
    const columnCount = sheet.headers.length;
    const computedValues = computeSheetValues(sheet);
    const theme = resolveTheme(sheet.theme);

    // Đặt bề rộng cột TRƯỚC khi thêm dòng để addNoteRow ước lượng được chiều cao
    ws.columns = sheet.headers.map((h, i) => ({ width: columnWidth(h, sheet.rows, i) }));

    if (sheet.title) addTitleRow(ws, sheet.title, columnCount, theme);
    if (sheet.subtitle) addSubtitleRow(ws, sheet.subtitle, columnCount, theme);
    if (sheet.title || sheet.subtitle) ws.addRow([]); // dòng thở giữa banner và bảng

    // Header vốn đã đậm - chỉ cần bỏ marker ** nếu model lỡ đặt
    const headerRow = ws.addRow(sheet.headers.map((h) => h.replaceAll("**", "")));
    styleHeaderRow(headerRow, theme);
    const headerRowNumber = headerRow.number;
    // Model đánh số dòng coi header = dòng 1; banner đẩy bảng xuống thì mọi
    // tham chiếu trong công thức phải dịch theo
    const rowOffset = headerRowNumber - 1;

    sheet.rows.forEach((row, rowIndex) => {
      const excelRow = headerRowNumber + 1 + rowIndex;
      const added = ws.addRow(
        row.map((cell, colIndex) =>
          cellValue(cell, excelRow, rowOffset, computedValues[rowIndex]?.[colIndex] ?? null),
        ),
      );
      row.forEach((cell, colIndex) =>
        styleDataCell(added.getCell(colIndex + 1), cell, theme, rowIndex % 2 === 1),
      );
    });

    if (sheet.note) addNoteRow(ws, sheet.note, columnCount);

    // Cuộn dài vẫn thấy banner + tên cột
    ws.views = [{ state: "frozen", ySplit: headerRowNumber }];
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
