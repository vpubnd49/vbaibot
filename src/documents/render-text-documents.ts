/**
 * Render các định dạng văn bản: Markdown (.md), Text (.txt), CSV (.csv), HTML (.html)
 * Có kèm UTF-8 BOM để Excel / Windows mở không bao giờ bị lỗi font tiếng Việt.
 */

export type TextDocumentType = "md" | "txt" | "csv" | "html" | "markdown" | "text";

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * Tạo template HTML chuẩn hoá, responsive, đẹp mắt cho báo cáo hoặc bảng biểu
 */
export function wrapHtmlReport(content: string, title?: string): string {
  const pageTitle = title?.trim() || "Báo cáo tổng hợp";
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    :root {
      --primary: #1e40af;
      --primary-light: #eff6ff;
      --text: #1f2937;
      --bg: #f9fafb;
      --card-bg: #ffffff;
      --border: #e5e7eb;
      --header: #111827;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      margin: 0;
      padding: 24px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--card-bg);
      padding: 32px 40px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    h1, h2, h3, h4 {
      color: var(--header);
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 700;
    }
    h1 {
      font-size: 1.875rem;
      border-bottom: 2px solid var(--primary);
      padding-bottom: 8px;
      margin-top: 0;
      color: var(--primary);
    }
    h2 { font-size: 1.5rem; }
    h3 { font-size: 1.25rem; }
    p { margin: 0.8em 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 0.95rem;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background-color: var(--primary-light);
      color: var(--primary);
      font-weight: 600;
      border-top: 1px solid var(--border);
    }
    tr:hover {
      background-color: #f3f4f6;
    }
    code, pre {
      background: #f1f5f9;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
    }
    code { padding: 2px 6px; color: #b91c1c; }
    pre { padding: 16px; overflow-x: auto; }
    blockquote {
      border-left: 4px solid var(--primary);
      margin: 16px 0;
      padding: 8px 16px;
      background: var(--primary-light);
      border-radius: 0 8px 8px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      font-size: 0.85rem;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(pageTitle)}</h1>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      Được tạo tự động bởi Zalo Agent • ${new Date().toLocaleDateString("vi-VN")}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Render chuỗi văn bản thành Buffer kèm UTF-8 BOM
 */
export function renderTextDocument(
  content: string,
  type: TextDocumentType,
  options?: { title?: string; isFullHtml?: boolean },
): Buffer {
  let outputContent = content;

  if ((type === "html" || type === "txt") && type === "html" && !options?.isFullHtml) {
    // Nếu là HTML và chưa có thẻ <html> thì bọc khung template đẹp mắt
    if (!content.trim().toLowerCase().startsWith("<!doctype") && !content.trim().toLowerCase().startsWith("<html")) {
      outputContent = wrapHtmlReport(content, options?.title);
    }
  }

  const contentBuffer = Buffer.from(outputContent, "utf8");
  return Buffer.concat([UTF8_BOM, contentBuffer]);
}
