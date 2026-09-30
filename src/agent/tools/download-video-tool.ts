import { execFile } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { enqueueSend } from "../../middleware/rate-limiter.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import type { ToolContext } from "./index.js";

const log = createLogger("download-video");

// Thư mục tạm lưu video
const DOWNLOAD_DIR = path.resolve("data/downloads");

/** Regex nhận diện các platform video phổ biến */
const SUPPORTED_URL =
  /(?:youtube\.com|youtu\.be|tiktok\.com|facebook\.com|fb\.watch|instagram\.com|twitter\.com|x\.com)/i;

/**
 * Tải video từ YouTube, TikTok, Facebook, Instagram bằng yt-dlp.
 * File được giới hạn 50MB để gửi qua Zalo.
 */
export function createDownloadVideoTool(ctx: ToolContext) {
  return tool({
    description:
      'Tải video từ YouTube, TikTok, Facebook, Instagram rồi gửi file cho người dùng. ' +
      'BẮT BUỘC GỌI TOOL NÀY khi người dùng gửi link video và nói "tải về", "download", "tải video", "lấy video". ' +
      'Cũng dùng được để tách nhạc MP3 khi audioOnly=true. ' +
      'Hỗ trợ: YouTube, TikTok, Facebook, Instagram.',
    inputSchema: z.object({
      url: z.string().describe("URL video cần tải"),
      audioOnly: z.boolean().optional().describe("Chỉ tải âm thanh (MP3) thay vì video. Dùng khi người dùng nói 'tải nhạc', 'lấy mp3', 'tách audio'"),
      caption: z.string().optional().describe("Lời nhắn gửi kèm file"),
    }),
    execute: async ({ url, audioOnly, caption }) => {
      try {
        if (!SUPPORTED_URL.test(url)) {
          return ketQuaLoi(
            "URL không được hỗ trợ. Chỉ tải được từ: YouTube, TikTok, Facebook, Instagram.",
          );
        }

        const threadKey = `${ctx.account.id}:${ctx.message.threadId}`;

        // Tạo thư mục download
        fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

        const timestamp = Date.now();
        const ext = audioOnly ? "mp3" : "mp4";
        const outputFile = path.join(DOWNLOAD_DIR, `dl_${timestamp}.${ext}`);

        // Gửi thông báo đang tải
        await enqueueSend(threadKey, () =>
          ctx.api.sendMessage(
            { msg: audioOnly ? "🎵 Đang tải âm thanh..." : "📥 Đang tải video...", quote: undefined },
            ctx.message.threadId,
            ctx.message.threadType,
          ),
        );

        // Tạo args cho yt-dlp
        const args: string[] = [
          "--no-playlist",
          "--max-filesize", "50m",
          "--socket-timeout", "30",
          "-o", outputFile,
        ];

        if (audioOnly) {
          args.push("-x", "--audio-format", "mp3", "--audio-quality", "0");
        } else {
          args.push(
            "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "--merge-output-format", "mp4",
          );
        }
        args.push(url);

        // Chạy yt-dlp
        await new Promise<void>((resolve, reject) => {
          execFile("yt-dlp", args, { timeout: 120_000 }, (err, _stdout, stderr) => {
            if (err) {
              log.error({ err, stderr }, "yt-dlp lỗi");
              reject(new Error(stderr || err.message));
            } else {
              resolve();
            }
          });
        });

        // Kiểm tra file tồn tại (yt-dlp có thể thêm suffix)
        let actualFile = outputFile;
        if (!fs.existsSync(outputFile)) {
          // Tìm file gần đúng
          const dir = path.dirname(outputFile);
          const base = `dl_${timestamp}`;
          const found = fs.readdirSync(dir).find((f) => f.startsWith(base));
          if (found) actualFile = path.join(dir, found);
          else return ketQuaLoi("Tải xong nhưng không tìm thấy file. Video có thể quá lớn (>50MB).");
        }

        const stats = fs.statSync(actualFile);
        if (stats.size > 50 * 1024 * 1024) {
          fs.unlinkSync(actualFile);
          return ketQuaLoi("File quá lớn (>50MB), không gửi qua Zalo được.");
        }

        // Gửi file
        const tenHienThi = path.basename(actualFile);
        await guiFileKemCaption(
          ctx.api,
          threadKey,
          ctx.message.threadId,
          ctx.message.threadType,
          actualFile,
          caption ?? (audioOnly ? "🎵 File âm thanh đây!" : "📹 Video đây!"),
          ctx.fileDaGuiTrongLuot,
        );
        ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(tenHienThi, caption));

        // Dọn file sau khi gửi
        setTimeout(() => {
          try { fs.unlinkSync(actualFile); } catch { /* ignore */ }
        }, 60_000);

        log.info({ url, audioOnly, size: stats.size }, "Đã tải và gửi video/audio");
        return {
          success: true,
          message: audioOnly
            ? "Đã tải và gửi file âm thanh thành công."
            : "Đã tải và gửi video thành công.",
        };
      } catch (err) {
        log.error({ err, url }, "Lỗi tải video");
        return ketQuaLoi(
          `Không tải được: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  });
}
