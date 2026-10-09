import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { dataDir } from "../../config/env.js";
import { getRecentMessages } from "../../conversation/history-store.js";
import { checkDocumentRateLimit } from "../../documents/document-rate-limit.js";
import { convertFile, ConvertError, CONVERT_TARGETS } from "../../documents/file-converter.js";
import { createLogger } from "../../shared/logger.js";
import { assertSafePathInside } from "../../shared/path-security-guard.js";
import { withNamedTempFile } from "../../shared/temp-file-store.js";
import type { ToolContext } from "./index.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import { collectRecentFilePaths } from "./read-document-tool.js";
import { collectRecentImagePaths } from "./read-image-tool.js";
import { originalNames, pickIndex } from "./recent-file-picker.js";

const log = createLogger("convert-file");
const MAX_SOURCES = 100;

/** File người dùng đã gửi, MỚI NHẤT TRƯỚC, mọi loại (kể cả âm thanh/video/file nén). */
export function collectConvertSources(ctx: ToolContext): string[] {
  const out: string[] = [];
  const add = (p?: string) => { if (p && !out.includes(p)) out.push(p); };
  const fromMessages = (msgs: any[]) => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      for (const f of msgs[i]?.files ?? []) add(f.localPath);
    }
  };
  fromMessages(ctx.batch as any[]);
  fromMessages(getRecentMessages(ctx.account.id, ctx.message.threadId) as any[]);
  collectRecentFilePaths(ctx).forEach(add);
  collectRecentImagePaths(ctx).forEach(add);
  return out.slice(0, MAX_SOURCES);
}

export function createConvertFileTool(ctx: ToolContext) {
  return tool({
    description:
      "Chuyển đổi định dạng file người dùng đã gửi (giống các trang convert online) rồi GỬI file kết quả. " +
      "Hỗ trợ: Word/Excel/CSV/TXT/MD/HTML ↔ PDF/DOCX/XLSX/CSV/TXT/MD/HTML; PDF → ảnh PNG/JPG (trang đầu); ảnh ↔ PNG/JPG/WEBP/GIF/PDF; " +
      "âm thanh/video ↔ MP3/WAV/M4A/MP4/WEBM/GIF; RAR/TAR/GZ → ZIP; file bất kỳ → ZIP. " +
      "Dùng khi người dùng nói 'chuyển/đổi file này sang…', 'convert', 'đổi đuôi', 'RAR sang ZIP'. KHÔNG dùng để soạn nội dung mới.",
    inputSchema: z.object({
      targetFormat: z.enum(CONVERT_TARGETS).describe("Định dạng đích (đuôi file, không có dấu chấm)"),
      fileIndex: z.coerce.number().int().min(0).default(0)
        .describe("Vị trí file nguồn trong các file người dùng đã gửi (0 = mới nhất)"),
      fileName: z.string().optional().describe("Một phần tên file gốc (không cần dấu); ưu tiên hơn fileIndex"),
      password: z.string().optional().describe("Mật khẩu nếu file nén RAR có mật khẩu"),
      caption: z.string().optional().describe("Lời nhắn gửi kèm file"),
    }),
    execute: async ({ targetFormat, fileIndex, fileName, password, caption }) => {
      try {
        const rate = checkDocumentRateLimit(`${ctx.account.id}:${ctx.message.threadId}`);
        if (!rate.ok) return ketQuaLoi(rate.reason);

        const sources = collectConvertSources(ctx);
        if (sources.length === 0) return ketQuaLoi("Không có file nào trong hội thoại gần đây để chuyển đổi. Hãy nhờ người dùng gửi file.");
        const picked = pickIndex(sources, originalNames(ctx), fileIndex, fileName);
        if ("error" in picked) return ketQuaLoi(picked.error);
        const rel = sources[picked.index]!;
        const abs = assertSafePathInside(path.isAbsolute(rel) ? rel : path.join(dataDir, rel), dataDir);

        const result = await convertFile(abs, targetFormat, password);
        const threadKey = `${ctx.account.id}:${ctx.message.threadId}`;
        await withNamedTempFile(result.fileName, result.data, (filePath) =>
          guiFileKemCaption(ctx.api, threadKey, ctx.message.threadId, ctx.message.threadType, filePath, caption),
        );
        ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(result.fileName, caption));
        log.info({ from: path.basename(abs), to: result.fileName, bytes: result.data.length }, "Đã chuyển đổi và gửi file");
        const note = result.note ? ` Lưu ý cho người dùng: ${result.note}.` : "";
        return `Đã chuyển "${path.basename(abs)}" sang ${result.fileName} (${Math.round(result.data.length / 1024)} KB) và GỬI cho người dùng rồi. KHÔNG gọi send_file để gửi lại.${note}`;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        if (!(err instanceof ConvertError)) log.warn({ err }, "Chuyển đổi file thất bại");
        return ketQuaLoi(`Không chuyển đổi được file (${reason}). Hãy báo lý do cho người dùng, không hứa đã gửi file.`);
      }
    },
  });
}
