import { TextRun } from "docx";

/**
 * Chuyển text có đánh dấu inline formatting thành danh sách TextRun của docx:
 * - `<b>nội dung</b>` hoặc `**nội dung**` hoặc `<strong>nội dung</strong>` → In đậm (Bold)
 * - `<i>nội dung</i>` hoặc `*nội dung*` hoặc `<em>nội dung</em>` → In nghiêng (Italics)
 * - `<u>nội dung</u>` → Gạch chân (Underline)
 * - `~~gạch ngang~~` hoặc `<s>gạch ngang</s>` → Strikethrough (chữ bị gạch bỏ)
 * - `<red>nội dung</red>` hoặc `[red]nội dung[/red]` → Chữ màu đỏ (FF0000), in đậm phục vụ bôi đỏ từ đã sửa
 * - `<green>nội dung</green>` hoặc `[green]nội dung[/green]` → Chữ màu xanh lá (008000), in đậm
 * - `<blue>nội dung</blue>` hoặc `[blue]nội dung[/blue]` → Chữ màu xanh dương (0000FF), in đậm
 * - Tự động sửa lỗi typo của LLM như `<b1. Tiêu đề</b>` thành `<b>1. Tiêu đề</b>`
 * - Tự động strip sạch mọi thẻ HTML lạ (như `<p>`, `<div>`, `<span>...</span>`, v.v.), TUYỆT ĐỐI không để lộ mã code HTML trong văn bản Word.
 */
export type TextRunBaseOptions = {
  bold?: boolean;
  italics?: boolean;
  font?: string;
  size?: number;
  color?: string;
};

/**
 * Tiền xử lý văn bản: chuẩn hóa các biến thể thẻ và sửa lỗi gõ nhầm thẻ của AI
 */
function normalizeInlineMarkup(text: string): string {
  let s = text;

  // Sửa lỗi LLM gõ nhầm thẻ thiếu dấu > (ví dụ <b1. ...</b> hoặc <i2.1. ...</i>)
  s = s.replace(/<b\s*(?=[0-9])([^>]*?)<\/b>/gi, "<b>$1</b>");
  s = s.replace(/<i\s*(?=[0-9])([^>]*?)<\/i>/gi, "<i>$1</i>");

  // Chuẩn hóa thẻ ngoặc vuông [red]...[/red]
  s = s.replace(/\[(?:red|do)\]([\s\S]*?)\[\/(?:red|do)\]/gi, "<red>$1</red>");
  s = s.replace(/\[green\]([\s\S]*?)\[\/green\]/gi, "<green>$1</green>");
  s = s.replace(/\[blue\]([\s\S]*?)\[\/blue\]/gi, "<blue>$1</blue>");

  // Chuẩn hóa thẻ span / font có màu
  s = s.replace(/<span\b[^>]*color:\s*(?:red|#f00|#ff0000)[^>]*>([\s\S]*?)<\/span>/gi, "<red>$1</red>");
  s = s.replace(/<span\b[^>]*color:\s*(?:green|#008000|#0f0)[^>]*>([\s\S]*?)<\/green>/gi, "<green>$1</green>");
  s = s.replace(/<span\b[^>]*color:\s*(?:blue|#0000ff|#00f)[^>]*>([\s\S]*?)<\/blue>/gi, "<blue>$1</blue>");
  s = s.replace(/<font\b[^>]*color=["']?(?:red|#f00|#ff0000)["']?[^>]*>([\s\S]*?)<\/font>/gi, "<red>$1</red>");
  s = s.replace(/<font\b[^>]*color=["']?(?:green|#008000|#0f0)["']?[^>]*>([\s\S]*?)<\/font>/gi, "<green>$1</green>");
  s = s.replace(/<font\b[^>]*color=["']?(?:blue|#0000ff|#00f)["']?[^>]*>([\s\S]*?)<\/font>/gi, "<blue>$1</blue>");

  // Chuẩn hóa các thẻ tương đương
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, "<b>$1</b>");
  s = s.replace(/<em>([\s\S]*?)<\/em>/gi, "<i>$1</i>");
  s = s.replace(/<do>([\s\S]*?)<\/do>/gi, "<red>$1</red>");

  // Markdown formatting
  s = s.replace(/~~([\s\S]*?)~~/g, "<s>$1</s>");
  s = s.replace(/\*{3}([^*]+)\*{3}/g, "<b><i>$1</i></b>");
  s = s.replace(/\*{2}([^*]+)\*{2}/g, "<b>$1</b>");
  s = s.replace(/\*([^*]+)\*/g, "<i>$1</i>");

  return s;
}

export function parseTextRuns(text: string, base: TextRunBaseOptions = {}): TextRun[] {
  if (!text) {
    return [new TextRun({ text: "", font: base.font, size: base.size, bold: base.bold, italics: base.italics, color: base.color })];
  }

  const normalized = normalizeInlineMarkup(text);
  const runs: Array<{
    text: string;
    bold: boolean;
    italics: boolean;
    underline: boolean;
    strike: boolean;
    color?: string;
  }> = [];

  // Match mọi thẻ HTML: <tag> hoặc </tag>
  const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)(?:\s+[^>]*)?>/g;
  const FORMAT_TAGS = new Set(["b", "i", "u", "s", "red", "green", "blue"]);

  const stack: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  function pushText(chunk: string) {
    if (!chunk) return;
    const isBold =
      stack.includes("b") ||
      stack.includes("red") ||
      stack.includes("green") ||
      stack.includes("blue") ||
      (base.bold ?? false);
    const isItalics = stack.includes("i") || (base.italics ?? false);
    const isUnderline = stack.includes("u");
    const isStrike = stack.includes("s");

    // Lấy màu từ tag gần nhất trong stack
    let activeColor = base.color;
    for (let i = stack.length - 1; i >= 0; i--) {
      const t = stack[i];
      if (t === "red") {
        activeColor = "FF0000";
        break;
      }
      if (t === "green") {
        activeColor = "008000";
        break;
      }
      if (t === "blue") {
        activeColor = "0000FF";
        break;
      }
      if (t === "s") {
        activeColor = "888888";
        break;
      }
    }

    runs.push({
      text: chunk,
      bold: isBold,
      italics: isItalics,
      underline: isUnderline,
      strike: isStrike,
      color: activeColor,
    });
  }

  while ((match = TAG_RE.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      pushText(normalized.slice(lastIndex, match.index));
    }

    const isClosing = match[0].startsWith("</");
    const tagName = match[1]!.toLowerCase();

    if (tagName === "br") {
      pushText("\n");
    } else if (FORMAT_TAGS.has(tagName)) {
      if (isClosing) {
        const idx = stack.lastIndexOf(tagName);
        if (idx !== -1) {
          stack.splice(idx, 1);
        }
      } else {
        stack.push(tagName);
      }
    }
    // Các thẻ HTML khác (<p>, <div>, <span>, ...) tự động bị bỏ qua/strip sạch

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < normalized.length) {
    pushText(normalized.slice(lastIndex));
  }

  if (runs.length === 0) {
    return [new TextRun({ text: "", font: base.font, size: base.size, bold: base.bold, italics: base.italics, color: base.color })];
  }

  return runs.map(
    (r) =>
      new TextRun({
        text: r.text,
        font: base.font,
        size: base.size,
        bold: r.bold,
        italics: r.italics,
        underline: r.underline ? {} : undefined,
        strike: r.strike,
        color: r.color,
      }),
  );
}
