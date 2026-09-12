/**
 * render-docx-from-pages.ts
 * Xuat file Word .docx tu nhieu trang van ban OCR.
 * Moi "trang" co the la 1 file, 1 trang PDF, hoac 1 chunk text.
 */
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import type { OcrRow } from "./batch-ocr-engine.js";

export type DocxFromPagesOptions = {
  title?: string;
  author?: string;
};

export type PageChunk = {
  filename: string;
  pageNum?: number;
  text: string;
};

/** Don gian: tach text thanh paragraphs, bo markdown headers */
function textToParagraphs(text: string): Paragraph[] {
  return text.split("\n").map(line => {
    const md = line.match(/^(#{1,3})\s+(.*)/);
    if (md) {
      const level = md[1]!.length;
      return new Paragraph({
        text: md[2]!.trim(),
        heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      });
    }
    if (line.startsWith("---")) {
      return new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "888888" } },
        spacing: { before: 100, after: 100 },
        children: [],
      });
    }
    return new Paragraph({
      children: [new TextRun({ text: line || " ", font: "Times New Roman", size: 26 })],
      spacing: { after: 80 },
    });
  });
}

export async function renderDocxFromPages(pages: PageChunk[], opts: DocxFromPagesOptions = {}): Promise<Buffer> {
  const children: Paragraph[] = [];

  if (opts.title) {
    children.push(new Paragraph({
      text: opts.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));
  }

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const label = page.pageNum
      ? `${page.filename} — Trang ${page.pageNum}`
      : page.filename;

    // Separator label cho moi file/trang
    if (pages.length > 1) {
      children.push(new Paragraph({
        text: label,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }));
    }

    children.push(...textToParagraphs(page.text));

    // Page break giua cac file (tru file cuoi)
    if (i < pages.length - 1) {
      children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    }
  }

  const doc = new Document({
    creator: opts.author ?? "vbaibot",
    title: opts.title,
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 }, // A4 NĐ30
        },
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

/** Helper: chuyen OcrRow[] thanh PageChunk[] de xuat Word */
export function rowsToPageChunks(rows: OcrRow[]): PageChunk[] {
  const text = rows.map((r, i) => {
    const line = Object.entries(r)
      .map(([k, v]) => `${k}: ${v ?? ""}`)
      .join("  |  ");
    return `${i + 1}. ${line}`;
  }).join("\n");
  return [{ filename: "OCR Data", text }];
}
