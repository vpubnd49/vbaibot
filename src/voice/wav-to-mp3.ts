/**
 * Chuyển đổi WAV buffer → MP3 qua ffmpeg.
 *
 * Gemini TTS trả về PCM bọc WAV — file 2.5 phút nặng ~14MB. Zalo PC bị lỗi
 * "Tin nhắn thoại không thể tải" khi voice message quá lớn (cache nghẽn hoặc
 * timeout khi tải). Chuyển sang MP3 giảm còn ~2MB, tương thích mọi client.
 *
 * Dùng ffmpeg pipe (stdin → stdout) thay vì file tạm: nhanh hơn vì không
 * cần ghi/đọc ổ đĩa, và không để lại file rác nếu crash giữa chừng.
 */

import { execFile } from "node:child_process";
import { createLogger } from "../shared/logger.js";

const log = createLogger("wav-to-mp3");

/**
 * Chuyển WAV Buffer → MP3 Buffer qua ffmpeg pipe.
 *
 * @param wavBuffer - Buffer chứa file WAV (PCM)
 * @returns Buffer chứa file MP3
 * @throws Error nếu ffmpeg không có hoặc chuyển đổi thất bại
 */
export async function convertWavBufferToMp3(wavBuffer: Buffer): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const child = execFile(
      "ffmpeg",
      [
        "-y",
        "-loglevel", "error",
        // Đọc WAV từ stdin
        "-i", "pipe:0",
        // Mã hóa MP3 chất lượng 4 (~130kbps, cân bằng giữa chất lượng và kích thước)
        "-codec:a", "libmp3lame",
        "-q:a", "4",
        // Xuất MP3 ra stdout
        "-f", "mp3",
        "pipe:1",
      ],
      { encoding: "buffer", maxBuffer: 50 * 1024 * 1024, timeout: 120_000 },
      (err, stdout, stderr) => {
        if (err) {
          const stderrText = stderr ? stderr.toString("utf8").slice(0, 500) : "";
          log.error({ err, stderr: stderrText }, "ffmpeg WAV→MP3 thất bại");
          reject(new Error(`Chuyển WAV→MP3 thất bại: ${stderrText || err.message}`));
          return;
        }
        if (!stdout || stdout.length === 0) {
          reject(new Error("ffmpeg không trả về dữ liệu MP3"));
          return;
        }
        resolve(stdout);
      },
    );

    // Ghi WAV vào stdin của ffmpeg
    if (child.stdin) {
      child.stdin.on("error", () => {
        // Pipe error khi ffmpeg đóng sớm (lỗi input) — lỗi chính nằm ở callback
      });
      child.stdin.end(wavBuffer);
    } else {
      reject(new Error("Không mở được stdin của ffmpeg"));
    }
  });
}
