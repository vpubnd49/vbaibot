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
    inputSchema: z.object({
      format: z
        .enum(["md", "txt", "csv", "html", "pdf"])
        .describe("Định dạng file muốn tạo: md (Markdown), txt (Text), csv (Bảng tính), html (Trang web), pdf (Tài liệu PDF)"),
      fileName: z.string().min(1).describe('Tên file mong muốn, ví dụ: "bao-cao.md", "danh-sach.csv", "tai-lieu.html", "tong-hop.pdf"'),
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
    }),
    execute: ({ format, fileName, title, content, pdfSections, caption }) =>
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
