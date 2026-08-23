import {
  AlignmentType,
  BorderStyle,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  WidthType,
} from "docx";
import { parseTextRuns } from "./docx-text-runs.js";
import { CONTENT_WIDTH_DXA, TABLE_CELL_MARGINS } from "./render-docx-styles.js";

/** Phần dựng bảng của renderer .docx - tách khỏi render-docx.ts cho gọn */

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const HIDDEN_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
} as const;

/** Chia đều bề rộng cho N cột, dồn phần dư vào cột cuối để tổng khớp tuyệt đối */
export function columnWidths(count: number, total = CONTENT_WIDTH_DXA): number[] {
  const each = Math.floor(total / count);
  const widths = Array.from({ length: count }, () => each);
  widths[count - 1] = total - each * (count - 1);
  return widths;
}

function buildCell(text: string, width: number, isHeader: boolean): TableCell {
  return new TableCell({
    // Bảng cần DUAL WIDTH: cả table lẫn từng cell, đều DXA.
    // PERCENTAGE trông vẫn ổn trong Word nhưng vỡ khi mở bằng Google Docs.
    width: { size: width, type: WidthType.DXA },
    // CLEAR chứ không SOLID - SOLID render ra nền đen đặc
    shading: isHeader ? { type: ShadingType.CLEAR, fill: "F1F5F9" } : undefined,
    children: [
      new Paragraph({
        children: parseTextRuns(text, { bold: isHeader }),
        spacing: { after: 0 },
      }),
    ],
  });
}

export function buildTable(headers: string[], rows: string[][]): Table {
  const widths = columnWidths(headers.length);
  return new Table({
    columnWidths: widths,
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    // Đệm trong ô - thiếu là chữ dính sát viền
    margins: TABLE_CELL_MARGINS,
    rows: [
      new TableRow({
        children: headers.map((h, i) => buildCell(h, widths[i]!, true)),
        tableHeader: true, // lặp lại header khi bảng tràn sang trang sau
      }),
      ...rows.map(
        (row) =>
          new TableRow({ children: row.map((cell, i) => buildCell(cell, widths[i]!, false)) }),
      ),
    ],
  });
}

/**
 * Hai cột không viền cạnh nhau - phần đầu văn bản hành chính (cơ quan | quốc
 * hiệu) và khối ký tên (nơi nhận | chức vụ + tên).
 * - ratio: tỷ lệ % [trái, phải], mặc định [40, 60] theo NĐ 30
 * - left_align / right_align: căn lề từng cột (center/left)
 */
export type TwoColumnsOptions = {
  left_align?: "left" | "center";
  right_align?: "left" | "center";
  ratio?: [number, number];
};

export function buildTwoColumns(
  left: string[],
  right: string[],
  options: TwoColumnsOptions = {},
): Table {
  const { left_align = "center", right_align = "center", ratio = [40, 60] } = options;
  const leftWidth = Math.round((CONTENT_WIDTH_DXA * ratio[0]) / 100);
  const rightWidth = CONTENT_WIDTH_DXA - leftWidth;

  const ALIGN_MAP = { left: AlignmentType.LEFT, center: AlignmentType.CENTER } as const;

  /** Cỡ chữ Nơi nhận 11pt (22 half-pt), danh sách nơi nhận nhỏ hơn thân văn bản */
  const NOI_NHAN_SIZE = 22;

  const makeCell = (lines: string[], width: number, align: "left" | "center") =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      children: lines.map((line) => {
        // Dòng bắt đầu bằng "- " trong khối Nơi nhận: cỡ 11pt
        const isNoiNhanItem = align === "left" && line.trimStart().startsWith("-");
        return new Paragraph({
          children: parseTextRuns(line).map((run) => {
            if (isNoiNhanItem) {
              // Override cỡ chữ cho dòng nơi nhận
              (run as any).properties = { ...(run as any).properties, size: NOI_NHAN_SIZE };
            }
            return run;
          }),
          alignment: ALIGN_MAP[align],
          spacing: { after: 0 },
        });
      }),
    });

  return new Table({
    columnWidths: [leftWidth, rightWidth],
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    borders: HIDDEN_BORDERS,
    margins: TABLE_CELL_MARGINS,
    rows: [
      new TableRow({
        children: [
          makeCell(left, leftWidth, left_align),
          makeCell(right, rightWidth, right_align),
        ],
      }),
    ],
  });
}
