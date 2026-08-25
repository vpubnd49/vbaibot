import { TextRun } from "docx";

/**
 * Chuyển text có đánh dấu inline formatting thành danh sách TextRun của docx:
 * - `<red>nội dung</red>` hoặc `[red]nội dung[/red]` → Chữ màu đỏ (FF0000) phục vụ bôi đỏ từ đã sửa
 * - `<green>nội dung</green>` hoặc `[green]nội dung[/green]` → Chữ màu xanh lá (008000)
 * - `<blue>nội dung</blue>` hoặc `[blue]nội dung[/blue]` → Chữ màu xanh dương (0000FF)
 * - `~~gạch ngang~~` → Strikethrough (chữ bị gạch bỏ)
 * - `***đậm nghiêng***` → Bold + Italic
 * - `**đậm**` → Bold
 * - `*nghiêng*` → Italic
 */
export type TextRunBaseOptions = {
  bold?: boolean;
  italics?: boolean;
  font?: string;
  size?: number;
  color?: string;
};

export function parseTextRuns(text: string, base: TextRunBaseOptions = {}): TextRun[] {
  if (!text) {
    return [new TextRun({ text: "", font: base.font, size: base.size, bold: base.bold, italics: base.italics, color: base.color })];
  }

  const runs: TextRun[] = [];

  // Regex nhận diện các thẻ tag màu sắc, strikethrough và markdown formatting
  // 1: <red>...</red> hoặc [red]...[/red]
  // 2: <green>...</green> hoặc [green]...[/green]
  // 3: <blue>...</blue> hoặc [blue]...[/blue]
  // 4: ~~strike~~
  // 5: ***bold+italic***
  // 6: **bold**
  // 7: *italic*
  const TOKEN_RE = /<(?:red|do)>([\s\S]*?)<\/(?:red|do)>|\[(?:red|do)\]([\s\S]*?)\[\/(?:red|do)\]|<green>([\s\S]*?)<\/green>|\[green\]([\s\S]*?)\[\/green\]|<blue>([\s\S]*?)<\/blue>|\[blue\]([\s\S]*?)\[\/blue\]|~~([\s\S]*?)~~|\*{3}([^*]+)\*{3}|\*{2}([^*]+)\*{2}|\*([^*]+)\*/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    // Text trước marker
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      if (before) {
        runs.push(new TextRun({
          text: before,
          font: base.font,
          size: base.size,
          bold: base.bold,
          italics: base.italics,
          color: base.color,
        }));
      }
    }

    const [
      ,
      redTag,
      redBracket,
      greenTag,
      greenBracket,
      blueTag,
      blueBracket,
      strikeText,
      boldItalicText,
      boldText,
      italicText,
    ] = match;

    const redContent = redTag ?? redBracket;
    const greenContent = greenTag ?? greenBracket;
    const blueContent = blueTag ?? blueBracket;

    if (redContent !== undefined) {
      // Bôi đỏ từ đã sửa
      runs.push(new TextRun({
        text: redContent,
        font: base.font,
        size: base.size,
        bold: true,
        color: "FF0000",
      }));
    } else if (greenContent !== undefined) {
      runs.push(new TextRun({
        text: greenContent,
        font: base.font,
        size: base.size,
        bold: true,
        color: "008000",
      }));
    } else if (blueContent !== undefined) {
      runs.push(new TextRun({
        text: blueContent,
        font: base.font,
        size: base.size,
        bold: true,
        color: "0000FF",
      }));
    } else if (strikeText !== undefined) {
      // Từ cũ bị gạch bỏ
      runs.push(new TextRun({
        text: strikeText,
        font: base.font,
        size: base.size,
        strike: true,
        color: "888888",
      }));
    } else if (boldItalicText !== undefined) {
      runs.push(new TextRun({
        text: boldItalicText,
        font: base.font,
        size: base.size,
        bold: true,
        italics: true,
        color: base.color,
      }));
    } else if (boldText !== undefined) {
      runs.push(new TextRun({
        text: boldText,
        font: base.font,
        size: base.size,
        bold: true,
        italics: base.italics,
        color: base.color,
      }));
    } else if (italicText !== undefined) {
      runs.push(new TextRun({
        text: italicText,
        font: base.font,
        size: base.size,
        bold: base.bold,
        italics: true,
        color: base.color,
      }));
    }

    lastIndex = match.index + match[0].length;
  }

  // Text sau marker cuối
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) {
      runs.push(new TextRun({
        text: remaining,
        font: base.font,
        size: base.size,
        bold: base.bold,
        italics: base.italics,
        color: base.color,
      }));
    }
  }

  return runs.length > 0
    ? runs
    : [new TextRun({ text: "", font: base.font, size: base.size, bold: base.bold, italics: base.italics, color: base.color })];
}
