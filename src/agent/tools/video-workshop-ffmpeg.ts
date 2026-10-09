/**
 * Chạy ffmpeg/ffprobe cho video_workshop. Đối số CỐ ĐỊNH qua execFile (không
 * shell). Tách khỏi video-workshop-tool.ts để file tool dưới 200 dòng.
 */
import { execFile } from "node:child_process";

export function actionLabel(a: string): string {
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

function chay(bin: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (!err) return resolve(stdout);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return reject(new Error(`Máy chủ chưa cài ${bin}`));
      }
      // Chỉ giữ đuôi stderr: phần đầu là banner dài, phần cuối mới là lý do lỗi
      reject(new Error(String(stderr || err.message).slice(-300)));
    });
  });
}

export function runFfmpeg(args: string[]): Promise<string> {
  return chay("ffmpeg", args, 300_000);
}

export async function runFfprobe(filePath: string): Promise<string> {
  const stdout = await chay(
    "ffprobe",
    ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath],
    15_000,
  );
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
    return lines.join("\n");
  } catch {
    return stdout;
  }
}

/** Dựng đối số ffmpeg cho từng tác vụ; trả chuỗi lỗi nếu thiếu tham số. */
export function dungDoiSo(
  action: string,
  input: string,
  out: (ext: string) => string,
  o: { startTime?: string; duration?: string; text?: string; quality?: string },
): { args: string[]; outputFile: string } | string {
  switch (action) {
    case "extract_audio": {
      const f = out("mp3");
      return { outputFile: f, args: ["-i", input, "-vn", "-acodec", "libmp3lame", "-q:a", "2", "-y", f] };
    }
    case "compress": {
      const f = out("mp4");
      const crf = o.quality === "high" ? "23" : o.quality === "low" ? "35" : "28";
      return {
        outputFile: f,
        args: ["-i", input, "-c:v", "libx264", "-crf", crf, "-preset", "fast", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", f],
      };
    }
    case "to_gif": {
      const f = out("gif");
      return {
        outputFile: f,
        args: ["-i", input, "-ss", o.startTime ?? "0", "-t", o.duration ?? "10", "-vf", "fps=12,scale=480:-1:flags=lanczos", "-y", f],
      };
    }
    case "trim": {
      if (!o.startTime) return "Thiếu startTime.";
      const f = out("mp4");
      const args = ["-i", input, "-ss", o.startTime];
      if (o.duration) args.push("-t", o.duration);
      args.push("-c", "copy", "-y", f);
      return { outputFile: f, args };
    }
    case "add_text": {
      if (!o.text) return "Thiếu text.";
      const f = out("mp4");
      // drawtext: thoát \ : ' % để chữ người dùng không phá cú pháp filter
      const safeText = o.text.replace(/[\\:'%]/g, (c) => `\\${c}`);
      return {
        outputFile: f,
        args: [
          "-i", input,
          "-vf", `drawtext=text='${safeText}':fontsize=28:fontcolor=white:borderw=2:bordercolor=black:x=(w-tw)/2:y=h-th-20`,
          "-c:a", "copy", "-y", f,
        ],
      };
    }
    default:
      return "Tác vụ không hợp lệ.";
  }
}
