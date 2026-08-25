import { TextRun } from "docx";

/**
 * Chuyển text có đánh dấu inline markdown thành danh sách TextRun:
 * - `***đậm nghiêng***` → bold + italic
 * - `**đậm**` → bold
 * - `*nghiêng*` → italic
 *
 * Thứ tự quan trọng: phải parse `***` trước `**` trước `*` để không nhầm.
 */
export type TextRunBaseOptions = {
  bold?: boolean;
  font?: string;
  size?: number;
};

export function parseTextRuns(text: string, base: TextRunBaseOptions = {}): TextRun[] {
  const runs: TextRun[] = [];

  // Tokenizer: tách thành các đoạn [normal, marker, content, marker, normal...]
  // Regex xử lý 3 cấp: ***bold+italic***, **bold**, *italic*
  // Dùng lookahead/lookbehind để tránh match sai các dấu * liền nhau
  const TOKEN_RE = /\*{3}([^*]+)\*{3}|\*{2}([^*]+)\*{2}|\*([^*]+)\*/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    // Text trước marker
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      if (before) runs.push(new TextRun({ text: before, font: base.font, size: base.size, bold: base.bold }));
    }

    if (match[1] !== undefined) {
      // *** bold + italic ***
      runs.push(new TextRun({ text: match[1], font: base.font, size: base.size, bold: true, italics: true }));
    } else if (match[2] !== undefined) {
      // ** bold **
      runs.push(new TextRun({ text: match[2], font: base.font, size: base.size, bold: true }));
    } else if (match[3] !== undefined) {
      // * italic *
      runs.push(new TextRun({ text: match[3], font: base.font, size: base.size, bold: base.bold, italics: true }));
    }

    lastIndex = match.index + match[0].length;
  }

  // Text sau marker cuối
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) runs.push(new TextRun({ text: remaining, font: base.font, size: base.size, bold: base.bold }));
  }

  // Text rỗng hoặc toàn dấu * -> vẫn phải có 1 run để Paragraph hợp lệ
  return runs.length > 0 ? runs : [new TextRun({ text: "", font: base.font, size: base.size, bold: base.bold })];
}
