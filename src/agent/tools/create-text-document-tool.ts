import { tool } from "ai";
import { z } from "zod";
import { checkDocumentRateLimit } from "../../documents/document-rate-limit.js";
import { safeFileName } from "../../documents/document-limits.js";
import { renderTextDocument, type TextDocumentType } from "../../documents/render-text-documents.js";
import { renderPdf, type PdfSection } from "../../documents/render-pdf.js";
import { createLogger } from "../../shared/logger.js";
import { withNamedTempFile } from "../../shared/temp-file-store.js";
import type { ToolContext } from "./index.js";
import { ketQuaLoi, type KetQuaLoiTool } from "./tool-failure-result.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";

const log = createLogger("create-text-document");

const DELIVERED_NOTE =
  "Đã tạo và GỬI file cho người dùng rồi. KHÔNG gọi send_file để gửi lại file này.";

type Ctx = Pick<ToolContext, "api" | "account" | "message" | "ghiNhanDaGui">;

async function deliverFile(
  ctx: Ctx,
  fileName: string,
  data: Buffer,
  caption: string | undefined,
): Promise<string> {
  const threadKey = `${ctx.account.id}:${ctx.message.threadId}`;
  await withNamedTempFile(fileName, data, (filePath) =>
    guiFileKemCaption(
      ctx.api,
      threadKey,
      ctx.message.threadId,
      ctx.message.threadType,
      filePath,
      caption,
    ),
  );
  ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(fileName, caption));
  log.info(
    { accountId: ctx.account.id, threadId: ctx.message.threadId, fileName, bytes: data.length },
    "Đã gửi file văn bản tự tạo",
  );
  return `${DELIVERED_NOTE} (tên file: ${fileName}, ${Math.round(data.length / 1024)} KB)`;
}

async function guard(
  work: () => Promise<string | KetQuaLoiTool>,
): Promise<string | KetQuaLoiTool> {
  try {
    return await work();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log.warn({ err }, "Tạo/gửi file văn bản thất bại");
    return ketQuaLoi(
      `Không tạo được file (${reason}). Hãy thông báo cho người dùng và trả lời trực tiếp trong chat.`,
    );
  }
}

export function createTextDocumentTool(ctx: Ctx) {
  return tool({
    description:
      "Tạo và gửi các loại file văn bản đa dạng cho người dùng: Markdown (.md), Văn bản thuần (.txt), Bảng dữ liệu (.csv), Báo cáo trang web (.html), hoặc Tài liệu PDF (.pdf). " +
      "Tự động gửi file kèm lời nhắn (caption) và hỗ trợ đầy đủ tiếng Việt UTF-8. " +
      "Dùng khi người dùng yêu cầu rõ định dạng file (.md, .txt, .csv, .html, .pdf) hoặc khi cần trích xuất bảng biểu / mã nguồn ra file riêng.",
    inputSchema: z.preprocess((raw: any) => {
      if (typeof raw === "string") {
        try { raw = JSON.parse(raw); } catch {}
      }
      if (raw && typeof raw === "object") {
        const copy: any = { ...raw };
        // Aliases cho content
        if (!copy.content && typeof copy.text === "string") copy.content = copy.text;
        if (!copy.content && typeof copy.body === "string") copy.content = copy.body;
        if (!copy.content && typeof copy.data === "string") copy.content = copy.data;
        if (!copy.content && typeof copy.markdown === "string") copy.content = copy.markdown;
        if (!copy.content && typeof copy.csv === "string") copy.content = copy.csv;
        if (!copy.content && typeof copy.html === "string") copy.content = copy.html;

        // Aliases cho fileName
        if (!copy.fileName && typeof copy.filename === "string") copy.fileName = copy.filename;
        if (!copy.fileName && typeof copy.name === "string") copy.fileName = copy.name;

        // Aliases cho format (model hay truyền type: "pdf" hoặc ext: "csv")
        if (!copy.format && typeof copy.type === "string") copy.format = copy.type.toLowerCase().replace(/^\./, "");
        if (!copy.format && typeof copy.ext === "string") copy.format = copy.ext.toLowerCase().replace(/^\./, "");
        if (!copy.format && typeof copy.extension === "string") copy.format = copy.extension.toLowerCase().replace(/^\./, "");
        if (copy.format === "markdown") copy.format = "md";
        if (copy.format === "text") copy.format = "txt";

        // Tự động suy luận format từ đuôi fileName hoặc cấu trúc dữ liệu
        const validFormats = ["md", "txt", "csv", "html", "pdf"];
        if (!copy.format || !validFormats.includes(copy.format)) {
          const fn = typeof copy.fileName === "string" ? copy.fileName.trim().toLowerCase() : "";
          const extMatch = fn.match(/\.(md|markdown|txt|csv|html|htm|pdf)$/i);
          if (extMatch) {
            const e = extMatch[1]!.toLowerCase();
            copy.format = e === "markdown" ? "md" : e === "htm" ? "html" : e;
          } else if (Array.isArray(copy.pdfSections) && copy.pdfSections.length > 0) {
            copy.format = "pdf";
          } else if (typeof copy.content === "string") {
            const trimmed = copy.content.trim();
            if (/^<!doctype html|^<html\b/i.test(trimmed)) {
              copy.format = "html";
            } else if (/^[^\n]+,[^\n]+\n[^\n]+,[^\n]+/.test(trimmed)) {
              copy.format = "csv";
            } else if (/^#\s|\n##\s/.test(trimmed)) {
              copy.format = "md";
            } else {
              copy.format = "txt";
            }
          } else {
            copy.format = "txt";
          }
        }

        // Tự động tạo fileName nếu model quên truyền
        if (!copy.fileName || typeof copy.fileName !== "string" || !copy.fileName.trim()) {
          const base = copy.title || copy.caption || `tai-lieu-${Date.now()}`;
          copy.fileName = `${String(base).slice(0, 60)}.${copy.format}`;
        }

        // Làm sạch pdfSections nếu model gõ sai key kiểu "{paragraphs"
        if (Array.isArray(copy.pdfSections)) {
          copy.pdfSections = copy.pdfSections.map((sec: any) => {
            if (!sec || typeof sec !== "object") return { paragraphs: [String(sec ?? "")] };
            const s: any = { ...sec };
            for (const k of Object.keys(s)) {
              const cleanKey = k.replace(/^[^a-zA-Z]+/, "");
              if (cleanKey && cleanKey !== k && s[cleanKey] === undefined) {
                s[cleanKey] = s[k];
              }
            }
            if (!s.paragraphs && typeof s.text === "string") s.paragraphs = [s.text];
            if (!s.paragraphs && typeof s.content === "string") s.paragraphs = [s.content];
            if (Array.isArray(s.paragraphs)) {
              s.paragraphs = s.paragraphs.map((p: any) => String(p ?? ""));
            }
            if (s.table && typeof s.table === "object") {
              s.table = {
                headers: Array.isArray(s.table.headers) ? s.table.headers.map((h: any) => String(h ?? "")) : ["Cột 1"],
                rows: Array.isArray(s.table.rows)
                  ? s.table.rows.map((r: any) => (Array.isArray(r) ? r.map((c: any) => String(c ?? "")) : [String(r ?? "")]))
                  : [],
              };
            }
            return s;
          });
        }

        return copy;
      }
      return raw;
    }, z.object({
      format: z
        .enum(["md", "txt", "csv", "html", "pdf"])
        .optional()
        .default("txt")
        .describe("Định dạng file muốn tạo: md (Markdown), txt (Text), csv (Bảng tính), html (Trang web), pdf (Tài liệu PDF)"),
      fileName: z.string().optional().default("tai-lieu.txt").describe('Tên file mong muốn, ví dụ: "bao-cao.md", "danh-sach.csv", "tai-lieu.html", "tong-hop.pdf"'),
      title: z.string().optional().describe("Tiêu đề của tài liệu (dùng cho HTML/PDF/Markdown)"),
      content: z
        .string()
        .optional()
        .describe("Nội dung chuỗi văn bản cho file md, txt, csv, html. Đối với CSV: các dòng phân cách bằng dấu phẩy hoặc tab."),
      pdfSections: z
        .array(
          z.object({
            title: z.string().optional(),
            paragraphs: z.array(z.string()).optional(),
            table: z
              .object({
                headers: z.array(z.string()),
                rows: z.array(z.array(z.string())),
              })
              .optional(),
          }),
        )
        .optional()
        .describe("Dữ liệu cấu trúc chia mục và bảng biểu khi xuất định dạng pdf"),
      caption: z.string().optional().describe("Lời nhắn gửi kèm file trên Zalo"),
    })),
    execute: ({ format = "txt", fileName = "tai-lieu.txt", title, content, pdfSections, caption }) =>
      guard(async () => {
        const rate = checkDocumentRateLimit(`${ctx.account.id}:${ctx.message.threadId}`);
        if (!rate.ok) return ketQuaLoi(rate.reason);

        let data: Buffer;
        const normalizedExt = format === "md" ? "md" : format;
        const targetFileName = safeFileName(fileName, normalizedExt);

        if (format === "pdf") {
          const sections: PdfSection[] = pdfSections && pdfSections.length > 0
            ? pdfSections
            : [
                {
                  title: title || "Nội dung tài liệu",
                  paragraphs: (content || "").split("\n").filter((p) => p.trim().length > 0),
                },
              ];
          data = renderPdf(title || targetFileName, sections);
        } else {
          const rawContent = content || "";
          if (!rawContent.trim()) {
            return ketQuaLoi("Nội dung tạo file không được để trống.");
          }
          data = renderTextDocument(rawContent, format as TextDocumentType, { title });
        }

        return deliverFile(ctx, targetFileName, data, caption);
      }),
  });
}
