import path from "node:path";
import fs from "node:fs";
import { tool } from "ai";
import { z } from "zod";
import { dataDir } from "../../config/env.js";
import { createLogger } from "../../shared/logger.js";
import { assertSafePathInside } from "../../shared/path-security-guard.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import type { ToolContext } from "./index.js";
import { collectConvertSources } from "./convert-file-tool.js";
import { originalNames, pickIndex } from "./recent-file-picker.js";
import { actionLabel, dungDoiSo, runFfmpeg, runFfprobe } from "./video-workshop-ffmpeg.js";

const log = createLogger("video-workshop");
const WORK_DIR = path.resolve("data/video-workshop");

/**
 * Xưởng Video FFmpeg — xử lý video/audio đa năng.
 *
 * BẢO MẬT: trước đây nhận `inputPath` tự do do model điền → có thể bị prompt
 * injection dụ đọc file của cuộc trò chuyện KHÁC (data/media/<acc>/<thread khác>)
 * rồi gửi vào đây, hoặc đưa URL/giao thức đặc biệt cho ffmpeg (SSRF). Giờ chỉ
 * chọn trong các file người dùng đã gửi Ở CHÍNH hội thoại này (fileName/fileIndex).
 */
export function createVideoWorkshopTool(ctx: ToolContext) {
  return tool({
    description:
      "Xử lý video/audio NGƯỜI DÙNG ĐÃ GỬI trong hội thoại bằng FFmpeg. Các tác vụ: " +
      "(1) extract_audio: tách nhạc MP3 từ video, " +
      "(2) compress: nén video nhỏ hơn, " +
      "(3) to_gif: chuyển video thành GIF, " +
      "(4) trim: cắt đoạn video, " +
      "(5) add_text: thêm chữ/watermark vào video, " +
      "(6) info: xem thông tin file. " +
      'Dùng khi người dùng nói "nén video", "tách nhạc", "cắt video", "chuyển GIF", "thêm chữ vào video".',
    inputSchema: z.object({
      action: z.enum(["extract_audio", "compress", "to_gif", "trim", "add_text", "info"]).describe("Tác vụ xử lý"),
      fileName: z.string().optional().describe("Một phần tên file gốc người dùng đã gửi (không cần dấu); ưu tiên hơn fileIndex"),
      fileIndex: z.coerce.number().int().min(0).default(0).describe("Vị trí file trong các file đã gửi (0 = mới nhất)"),
      startTime: z.string().optional().describe("Thời gian bắt đầu (HH:MM:SS) cho trim"),
      duration: z.string().optional().describe("Thời lượng (giây hoặc HH:MM:SS) cho trim/to_gif"),
      text: z.string().optional().describe("Nội dung chữ cho add_text"),
      quality: z.enum(["low", "medium", "high"]).optional().describe("Chất lượng đầu ra (mặc định: medium)"),
    }),
    execute: async ({ action, fileName, fileIndex, startTime, duration, text, quality }) => {
      try {
        const sources = collectConvertSources(ctx);
        if (sources.length === 0) return ketQuaLoi("Chưa có file video/âm thanh nào trong hội thoại. Hãy nhờ người dùng gửi file.");
        const picked = pickIndex(sources, originalNames(ctx), fileIndex, fileName);
        if ("error" in picked) return ketQuaLoi(picked.error);
        const rel = sources[picked.index]!;
        const inputPath = assertSafePathInside(path.isAbsolute(rel) ? rel : path.join(dataDir, rel), dataDir);
        if (!fs.existsSync(inputPath)) return ketQuaLoi(`File đã gửi không còn trên máy chủ: ${path.basename(inputPath)}`);

        if (action === "info") return { success: true, message: await runFfprobe(inputPath) };

        fs.mkdirSync(WORK_DIR, { recursive: true });
        const timestamp = Date.now();
        const built = dungDoiSo(action, inputPath, (ext) => path.join(WORK_DIR, `${action}_${timestamp}.${ext}`), {
          startTime, duration, text, quality,
        });
        if (typeof built === "string") return ketQuaLoi(built);
        const { args, outputFile } = built;

        await runFfmpeg(args);
        if (!fs.existsSync(outputFile)) return ketQuaLoi("FFmpeg chạy xong nhưng không tạo được file đầu ra.");

        const stats = fs.statSync(outputFile);
        if (stats.size > 50 * 1024 * 1024) {
          fs.unlinkSync(outputFile);
          return ketQuaLoi("File đầu ra >50MB, không gửi qua Zalo được. Thử giảm chất lượng hoặc cắt ngắn hơn.");
        }

        try {
          await guiFileKemCaption(
            ctx.api, `${ctx.account.id}:${ctx.message.threadId}`,
            ctx.message.threadId, ctx.message.threadType,
            outputFile, `🎬 ${actionLabel(action)} xong!`,
            ctx.fileDaGuiTrongLuot,
          );
        } finally {
          // Dọn file sau khi Zalo đã kịp tải lên
          setTimeout(() => { try { fs.unlinkSync(outputFile); } catch { /* */ } }, 120_000);
        }
        ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(path.basename(outputFile), undefined));

        const sizeMB = (stats.size / 1048576).toFixed(1);
        log.info({ action, sizeMB }, "Video workshop: xong");
        return { success: true, message: `${actionLabel(action)} thành công! File: ${sizeMB} MB. Đã GỬI cho người dùng.` };
      } catch (err) {
        log.error({ err, action }, "Lỗi video workshop");
        return ketQuaLoi(`Lỗi xử lý: ${err instanceof Error ? err.message : String(err)}. Không được báo là đã gửi file.`);
      }
    },
  });
}
