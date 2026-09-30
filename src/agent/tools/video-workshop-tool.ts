import { execFile } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiFile } from "./sent-by-tool-note.js";
import type { ToolContext } from "./index.js";

const log = createLogger("video-workshop");
const WORK_DIR = path.resolve("data/video-workshop");

/**
 * Xưởng Video FFmpeg — xử lý video/audio đa năng.
 * Server đã có ffmpeg + ffprobe.
 */
export function createVideoWorkshopTool(ctx: ToolContext) {
  return tool({
    description:
      'Xử lý video/audio bằng FFmpeg. Các tác vụ: ' +
      '(1) extract_audio: tách nhạc MP3 từ video, ' +
      '(2) compress: nén video nhỏ hơn, ' +
      '(3) to_gif: chuyển video thành GIF, ' +
      '(4) trim: cắt đoạn video, ' +
      '(5) add_text: thêm chữ/watermark vào video, ' +
      '(6) info: xem thông tin file. ' +
      'Dùng khi người dùng nói "nén video", "tách nhạc", "cắt video", "chuyển GIF", "thêm chữ vào video".',
    inputSchema: z.object({
      action: z.enum(["extract_audio", "compress", "to_gif", "trim", "add_text", "info"]).describe("Tác vụ xử lý"),
      inputPath: z.string().describe("Đường dẫn file nguồn (trong data/ hoặc URL đã tải)"),
      startTime: z.string().optional().describe("Thời gian bắt đầu (HH:MM:SS) cho trim"),
      duration: z.string().optional().describe("Thời lượng (giây hoặc HH:MM:SS) cho trim/to_gif"),
      text: z.string().optional().describe("Nội dung chữ cho add_text"),
      quality: z.enum(["low", "medium", "high"]).optional().describe("Chất lượng đầu ra (mặc định: medium)"),
    }),
    execute: async ({ action, inputPath, startTime, duration, text, quality }) => {
      try {
        fs.mkdirSync(WORK_DIR, { recursive: true });

        // Kiểm tra file tồn tại
        if (action !== "info" && !fs.existsSync(inputPath)) {
          return ketQuaLoi(`Không tìm thấy file: ${inputPath}`);
        }

        const timestamp = Date.now();
        const threadKey = `${ctx.account.id}:${ctx.message.threadId}`;

        if (action === "info") {
          const info = await runFfprobe(inputPath);
          return { success: true, message: info };
        }

        let outputFile: string;
        let args: string[];

        switch (action) {
          case "extract_audio": {
            outputFile = path.join(WORK_DIR, `audio_${timestamp}.mp3`);
            args = ["-i", inputPath, "-vn", "-acodec", "libmp3lame", "-q:a", "2", "-y", outputFile];
            break;
          }
          case "compress": {
            outputFile = path.join(WORK_DIR, `compressed_${timestamp}.mp4`);
            const crf = quality === "high" ? "23" : quality === "low" ? "35" : "28";
            args = [
              "-i", inputPath,
              "-c:v", "libx264", "-crf", crf, "-preset", "fast",
              "-c:a", "aac", "-b:a", "128k",
              "-movflags", "+faststart",
              "-y", outputFile,
            ];
            break;
          }
          case "to_gif": {
            outputFile = path.join(WORK_DIR, `gif_${timestamp}.gif`);
            const dur = duration ?? "10";
            const ss = startTime ?? "0";
            args = [
              "-i", inputPath, "-ss", ss, "-t", dur,
              "-vf", "fps=12,scale=480:-1:flags=lanczos",
              "-y", outputFile,
            ];
            break;
          }
          case "trim": {
            if (!startTime) return ketQuaLoi("Thiếu startTime.");
            outputFile = path.join(WORK_DIR, `trimmed_${timestamp}.mp4`);
            args = ["-i", inputPath, "-ss", startTime];
            if (duration) args.push("-t", duration);
            args.push("-c", "copy", "-y", outputFile);
            break;
          }
          case "add_text": {
            if (!text) return ketQuaLoi("Thiếu text.");
            outputFile = path.join(WORK_DIR, `text_${timestamp}.mp4`);
            const safeText = text.replace(/'/g, "'\\''");
            args = [
              "-i", inputPath,
              "-vf", `drawtext=text='${safeText}':fontsize=28:fontcolor=white:borderw=2:bordercolor=black:x=(w-tw)/2:y=h-th-20`,
              "-c:a", "copy",
              "-y", outputFile,
            ];
            break;
          }
          default:
            return ketQuaLoi("Tác vụ không hợp lệ.");
        }

        // Chạy FFmpeg
        await runFfmpeg(args);

        if (!fs.existsSync(outputFile)) {
          return ketQuaLoi("FFmpeg chạy xong nhưng không tạo được file đầu ra.");
        }

        const stats = fs.statSync(outputFile);
        if (stats.size > 50 * 1024 * 1024) {
          fs.unlinkSync(outputFile);
          return ketQuaLoi("File đầu ra >50MB, không gửi qua Zalo được. Thử giảm chất lượng hoặc cắt ngắn hơn.");
        }

        // Gửi file
        const tenHienThi = path.basename(outputFile);
        await guiFileKemCaption(
          ctx.api, threadKey,
          ctx.message.threadId, ctx.message.threadType,
          outputFile, `🎬 ${actionLabel(action)} xong!`,
          ctx.fileDaGuiTrongLuot,
        );
        ctx.ghiNhanDaGui?.(ghiChuDaGuiFile(tenHienThi, undefined));

        // Dọn file
        setTimeout(() => { try { fs.unlinkSync(outputFile); } catch { /* */ } }, 120_000);

        const sizeMB = (stats.size / 1048576).toFixed(1);
        log.info({ action, sizeMB }, "Video workshop: xong");
        return { success: true, message: `${actionLabel(action)} thành công! File: ${sizeMB} MB.` };
      } catch (err) {
        log.error({ err, action }, "Lỗi video workshop");
        return ketQuaLoi(`Lỗi xử lý: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  });
}

function actionLabel(a: string): string {
  const labels: Record<string, string> = {
    extract_audio: "🎵 Tách nhạc",
    compress: "📦 Nén video",
    to_gif: "🎞️ Tạo GIF",
    trim: "✂️ Cắt video",
    add_text: "✏️ Thêm chữ",
    info: "ℹ️ Thông tin",
  };
  return labels[a] ?? a;
}

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", args, { timeout: 300_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

function runFfprobe(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath],
      { timeout: 15_000 },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else {
          try {
            const info = JSON.parse(stdout) as {
              format?: { duration?: string; size?: string; format_name?: string };
              streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number }[];
            };
            const fmt = info.format;
            const video = info.streams?.find((s) => s.codec_type === "video");
            const audio = info.streams?.find((s) => s.codec_type === "audio");
            const lines = [
              `📁 Format: ${fmt?.format_name ?? "N/A"}`,
              `⏱️ Duration: ${fmt?.duration ? `${parseFloat(fmt.duration).toFixed(1)}s` : "N/A"}`,
              `📐 Size: ${fmt?.size ? `${(Number(fmt.size) / 1048576).toFixed(1)} MB` : "N/A"}`,
            ];
            if (video) lines.push(`🎥 Video: ${video.codec_name} ${video.width}x${video.height}`);
            if (audio) lines.push(`🎵 Audio: ${audio.codec_name}`);
            resolve(lines.join("\n"));
          } catch {
            resolve(stdout);
          }
        }
      },
    );
  });
}
