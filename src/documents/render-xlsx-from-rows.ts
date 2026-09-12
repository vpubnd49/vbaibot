/**
 * render-xlsx-from-rows.ts
 * Xuat file Excel dep tu OcrRow[] — dung cho ket qua OCR bang bieu.
 * Kien truc: tai su dung ExcelJS va style da co trong render-xlsx-styles.ts.
 */
import ExcelJS from "exceljs";
import { FONT_NAME } from "./render-xlsx-styles.js";
import type { OcrRow } from "./batch-ocr-engine.js";

export type XlsxFromRowsOptions = {
  sheetName?: string;
  title?: string;
  subtitle?: string;
  /** Ten cot dung de highlight (top N se to mau) */
  sortColumn?: string;
  /** So hang top de to vang (mac dinh: 3) */
  topN?: number;
};

// Mau theo thu hang
const RANK_COLORS = ["FFFFF176", "FFFFFFB3", "FFFFECB3", "FFFFE082", "FFE9EFF7"] as const;
const STRIPE_COLOR = "FFE9EFF7";
const HEADER_COLOR = "FF1F4E79";
const HEADER_FONT  = "FFFFFFFF";

function autoDetectColumns(rows: OcrRow[]): string[] {
  const all = new Set<string>();
  for (const row of rows.slice(0, 20)) {
    for (const k of Object.keys(row)) all.add(k);
  }
  // Sap xep: truong quen truoc
  const priority = ["rank", "stt", "so_bao_danh", "ho_ten", "ngay_sinh", "don_vi",
    "diem_viet", "diem_trac_nghiem", "tong_diem", "ghi_chu"];
  return [
    ...priority.filter(p => all.has(p)),
    ...[...all].filter(k => !priority.includes(k)).sort(),
  ];
}

function viHeader(key: string): string {
  const map: Record<string, string> = {
    rank: "Hang", stt: "STT", so_bao_danh: "So bao danh",
    ho_ten: "Ho va ten", ngay_sinh: "Ngay sinh", don_vi: "Don vi cong tac",
    diem_viet: "Diem Viet", diem_trac_nghiem: "Diem Trac nghiem",
    tong_diem: "Tong diem", ghi_chu: "Ghi chu",
  };
  return map[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function colWidth(key: string): number {
  const w: Record<string, number> = {
    rank: 7, stt: 7, so_bao_danh: 14, ho_ten: 28,
    ngay_sinh: 13, don_vi: 36, diem_viet: 12,
    diem_trac_nghiem: 14, tong_diem: 13, ghi_chu: 22,
  };
  return w[key] ?? 16;
}

export async function renderXlsxFromRows(rows: OcrRow[], opts: XlsxFromRowsOptions = {}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "vbaibot-ocr"; wb.created = new Date();
  const sheetName = (opts.sheetName ?? "Ket qua OCR").slice(0, 31);
  const ws = wb.addWorksheet(sheetName, { pageSetup: { paperSize: 9, orientation: "landscape" } });

  const columns = autoDetectColumns(rows);
  const hasRank = opts.sortColumn && rows.length > 0;
  const finalCols = hasRank && !columns.includes("rank") ? ["rank", ...columns] : columns;

  // ── Column widths ──
  ws.columns = finalCols.map(k => ({ key: k, width: colWidth(k) }));

  // ── Title banner ──
  if (opts.title) {
    const titleRow = ws.addRow([opts.title]);
    titleRow.height = 32;
    const titleCell = titleRow.getCell(1);
    titleCell.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: HEADER_FONT } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_COLOR } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.mergeCells(titleRow.number, 1, titleRow.number, finalCols.length);
    if (opts.subtitle) {
      const subRow = ws.addRow([opts.subtitle]);
      subRow.height = 20;
      const subCell = subRow.getCell(1);
      subCell.font = { name: FONT_NAME, size: 11, italic: true };
      subCell.alignment = { horizontal: "center" };
      ws.mergeCells(subRow.number, 1, subRow.number, finalCols.length);
    }
    ws.addRow([]); // dong tho
  }

  // ── Header row ──
  const hdrData = finalCols.map(k => viHeader(k));
  const hdr = ws.addRow(hdrData);
  hdr.height = 28;
  hdr.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_COLOR } };
    cell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: HEADER_FONT } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "thin" } };
  });

  // ── Data rows ──
  const topN = opts.topN ?? 3;
  rows.forEach((row, idx) => {
    const values = finalCols.map(k => k === "rank" ? idx + 1 : (row[k] ?? ""));
    const r = ws.addRow(values);
    r.height = 18;

    const rankColor = idx < topN ? RANK_COLORS[Math.min(idx, RANK_COLORS.length - 1)] :
      idx % 2 === 1 ? STRIPE_COLOR : "FFFFFFFF";

    r.eachCell((cell, ci) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rankColor } };
      cell.font = { name: FONT_NAME, size: 10, bold: idx < topN };
      const colKey = finalCols[ci - 1] ?? "";
      const isNumber = colKey.startsWith("diem") || colKey === "tong_diem" || colKey === "rank" || colKey === "stt";
      cell.alignment = isNumber
        ? { horizontal: "center", vertical: "middle" }
        : { vertical: "middle", wrapText: true };
      cell.border = { top: { style: "hair" }, left: { style: "thin" }, bottom: { style: "hair" }, right: { style: "thin" } };
    });
  });

  // ── Freeze + autofilter ──
  ws.views = [{ state: "frozen", ySplit: ws.lastRow!.number - rows.length }];
  if (rows.length > 0) {
    const firstDataRow = ws.lastRow!.number - rows.length + 1;
    ws.autoFilter = { from: { row: firstDataRow - 1, column: 1 }, to: { row: ws.lastRow!.number, column: finalCols.length } };
  }

  // ── Sheet 2: Thong ke ──
  if (opts.sortColumn) {
    const ws2 = wb.addWorksheet("Thong ke");
    ws2.columns = [
      { header: "Chỉ số", key: "label", width: 24 },
      { header: "Giá trị", key: "value", width: 14 },
    ];
    ws2.getRow(1).eachCell(c => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E7D32" } };
      c.font = { name: FONT_NAME, bold: true, color: { argb: HEADER_FONT } };
      c.alignment = { horizontal: "center" };
    });
    const scores = rows.map(r => Number(r[opts.sortColumn!] ?? 0)).filter(n => n > 0);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    [
      ["Tong thi sinh", rows.length],
      ["Diem cao nhat", scores.length ? Math.max(...scores) : ""],
      ["Diem thap nhat", scores.length ? Math.min(...scores) : ""],
      ["Diem trung binh", scores.length ? +avg.toFixed(2) : ""],
      ["Thi sinh dat (>= 100)", scores.filter(s => s >= 100).length],
    ].forEach(([label, value]) => {
      const r = ws2.addRow({ label, value });
      r.eachCell(c => { c.alignment = { horizontal: "center" }; });
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
