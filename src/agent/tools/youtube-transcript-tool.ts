import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import type { ToolContext } from "./index.js";

const log = createLogger("youtube-transcript");

// YouTube video ID regex
const YT_REGEX = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/;

/**
 * Lấy transcript (phụ đề) từ video YouTube.
 *
 * Sử dụng YouTube innertube API để fetch captions mà không cần API key.
 */
export function createYouTubeTranscriptTool(ctx: ToolContext) {
  return tool({
    description:
      'Đọc phụ đề (transcript/subtitle) từ video YouTube. Trả về toàn bộ nội dung lời nói trong video. ' +
      'BẮT BUỘC GỌI TOOL NÀY khi người dùng gửi link YouTube và muốn biết nội dung, tóm tắt video.',
    inputSchema: z.object({
      url: z.string().describe("URL video YouTube"),
    }),
    execute: async ({ url }) => {
      try {
        const match = url.match(YT_REGEX);
        if (!match) {
          return ketQuaLoi("URL không phải video YouTube hợp lệ.");
        }
        const videoId = match[1]!;

        // Bước 1: Fetch trang video để lấy captions info
        const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
          },
        });
        const html = await pageRes.text();

        // Tìm captionTracks trong playerResponse
        const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        if (!captionMatch) {
          return ketQuaLoi("Video này không có phụ đề (subtitle). Không thể đọc nội dung.");
        }

        let tracks: { baseUrl: string; languageCode: string; name?: { simpleText?: string } }[];
        try {
          tracks = JSON.parse(captionMatch[1]);
        } catch {
          return ketQuaLoi("Không parse được thông tin phụ đề.");
        }

        if (tracks.length === 0) {
          return ketQuaLoi("Video không có phụ đề khả dụng.");
        }

        // Ưu tiên: vi > en > track đầu tiên
        const viTrack = tracks.find((t) => t.languageCode === "vi");
        const enTrack = tracks.find((t) => t.languageCode === "en");
        const track = viTrack ?? enTrack ?? tracks[0]!;

        // Bước 2: Fetch transcript XML
        const captionRes = await fetch(track.baseUrl + "&fmt=json3");
        if (!captionRes.ok) {
          // Fallback: try XML format
          const xmlRes = await fetch(track.baseUrl);
          const xml = await xmlRes.text();

          // Parse XML transcript
          const lines: string[] = [];
          const textMatches = xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs);
          for (const m of textMatches) {
            const text = m[1]!
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/<[^>]+>/g, "")
              .trim();
            if (text) lines.push(text);
          }

          if (lines.length === 0) {
            return ketQuaLoi("Không trích xuất được nội dung phụ đề.");
          }

          const transcript = lines.join(" ");
          log.info({ videoId, lang: track.languageCode, charCount: transcript.length }, "Đã lấy transcript YouTube");
          return {
            success: true,
            videoId,
            language: track.languageCode,
            transcript: transcript.slice(0, 15000), // Giới hạn 15k ký tự
            truncated: transcript.length > 15000,
          };
        }

        // Parse JSON3 format
        const json3 = (await captionRes.json()) as {
          events?: { segs?: { utf8: string }[] }[];
        };
        const segments =
          json3.events
            ?.flatMap((e) => e.segs ?? [])
            .map((s) => s.utf8.trim())
            .filter(Boolean) ?? [];

        if (segments.length === 0) {
          return ketQuaLoi("Transcript rỗng.");
        }

        const transcript = segments.join(" ");
        log.info({ videoId, lang: track.languageCode, charCount: transcript.length }, "Đã lấy transcript YouTube");
        return {
          success: true,
          videoId,
          language: track.languageCode,
          transcript: transcript.slice(0, 15000),
          truncated: transcript.length > 15000,
        };
      } catch (err) {
        log.error({ err, url }, "Lỗi lấy transcript YouTube");
        return ketQuaLoi(
          `Không lấy được phụ đề: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  });
}
