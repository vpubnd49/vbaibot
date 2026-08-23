import { tool } from "ai";
import { z } from "zod";
import type { API, ThreadType } from "zca-js";
import { generatePodcastScript } from "../../voice/podcast-script.js";
import { generateMultiSpeakerAudio } from "../../voice/gemini-tts.js";
import { generateMultiSpeakerAudioEdge } from "../../voice/edge-tts.js";
import { saveVoiceFile } from "../../voice/voice-file-store.js";
import { getTtsSettings } from "../../config/runtime-tts-settings.js";
import { enqueueSend } from "../../middleware/rate-limiter.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("create-voice-tool");

/**
 * Ghi chú dành cho tin gửi vào history khi tool xuất voice thành công.
 */
function ghiChuDaGuiVoice(durationSecs: number): string {
  const phut = Math.floor(durationSecs / 60);
  const giay = Math.round(durationSecs % 60);
  return `[Đã gửi tin nhắn thoại tổng hợp ~ ${phut > 0 ? `${phut} phút ` : ""}${giay} giây]`;
}

export function createVoiceSummaryTool(ctx: {
  api: API;
  threadId: string;
  threadType: ThreadType;
  threadKey: string;
  accountId: string;
  ghiNhanDaGui?: (noiDung: string) => void;
}) {
  return tool({
    description:
      "Chuyển nội dung tổng hợp / phân tích thành TIN NHẮN THOẠI dạng podcast 2 người thảo luận (giọng Bắc chuẩn) rồi gửi trực tiếp trong chat. " +
      "BẮT BUỘC gọi tool này khi người dùng yêu cầu: " +
      "\"xuất file âm thanh giọng nói\", \"đọc tóm tắt bằng giọng nói\", \"xuất audio\", \"làm podcast\", \"đọc lại cho nghe\", \"phân tích bằng giọng nói\". " +
      "Tool này sẽ tự động viết kịch bản hội thoại 2 người (Anh và Chị) và tạo file âm thanh gửi vào Zalo.",
    inputSchema: z.object({
      content: z
        .string()
        .min(20)
        .max(20000)
        .describe(
          "Nội dung cần chuyển thành podcast. Có thể là bản tóm tắt, báo cáo, kết quả tra cứu, phân tích, " +
          "hoặc bất kỳ văn bản nào người dùng muốn nghe. Lấy từ ngữ cảnh hoặc kết quả bạn vừa phân tích trong cuộc trò chuyện.",
        ),
      style: z
        .enum(["summary", "deep-dive", "brief"])
        .optional()
        .describe(
          "Phong cách podcast: 'summary' (tóm tắt cân bằng, mặc định), " +
          "'deep-dive' (phân tích chuyên sâu), 'brief' (ngắn gọn 1-2 phút)",
        ),
    }),
    execute: async ({ content, style }) => {
      // Lấy cấu hình TTS
      const ttsSettings = getTtsSettings();

      if (!ttsSettings.publicBaseUrl) {
        return ketQuaLoi(
          "Chưa cấu hình địa chỉ công khai (TTS_PUBLIC_BASE_URL) của server. " +
          "Cần để Zalo tải được file audio.",
        );
      }

      try {
        // Bước 1: Sinh kịch bản podcast 2 người
        log.info("Bước 1: Sinh kịch bản podcast...");
        const script = await generatePodcastScript({
          content,
          hostNames: [ttsSettings.hostMaleName, ttsSettings.hostFemaleName],
          style: style ?? "summary",
          maxLengthChars: style === "brief" ? 2000 : style === "deep-dive" ? 8000 : 5000,
        });

        // Bước 2: Sinh audio (ưu tiên Edge TTS Neural chuẩn Bắc, hoặc Gemini TTS nếu có key)
        log.info("Bước 2: Sinh audio podcast đa giọng...");
        let audioBuffer: Buffer;
        let format = "mp3";

        if (ttsSettings.apiKey) {
          try {
            audioBuffer = await generateMultiSpeakerAudio({
              script,
              voices: [
                { speakerAlias: ttsSettings.hostMaleName, speakerId: ttsSettings.maleVoice },
                { speakerAlias: ttsSettings.hostFemaleName, speakerId: ttsSettings.femaleVoice },
              ],
              apiKey: ttsSettings.apiKey,
              model: ttsSettings.model,
            });
            format = "wav";
          } catch (geminiErr) {
            log.warn({ geminiErr }, "Gemini TTS lỗi, chuyển sang Edge TTS Neural");
            audioBuffer = await generateMultiSpeakerAudioEdge({
              script,
              maleVoice: ttsSettings.maleVoice.includes("Neural") ? ttsSettings.maleVoice : "vi-VN-NamMinhNeural",
              femaleVoice: ttsSettings.femaleVoice.includes("Neural") ? ttsSettings.femaleVoice : "vi-VN-HoaiMyNeural",
              hostMaleName: ttsSettings.hostMaleName,
              hostFemaleName: ttsSettings.hostFemaleName,
            });
            format = "mp3";
          }
        } else {
          audioBuffer = await generateMultiSpeakerAudioEdge({
            script,
            maleVoice: ttsSettings.maleVoice.includes("Neural") ? ttsSettings.maleVoice : "vi-VN-NamMinhNeural",
            femaleVoice: ttsSettings.femaleVoice.includes("Neural") ? ttsSettings.femaleVoice : "vi-VN-HoaiMyNeural",
            hostMaleName: ttsSettings.hostMaleName,
            hostFemaleName: ttsSettings.hostFemaleName,
          });
          format = "mp3";
        }

        // Bước 3: Lưu file audio
        log.info("Bước 3: Lưu file audio...");
        const { filename } = await saveVoiceFile(ctx.accountId, ctx.threadId, audioBuffer, format);

        // Bước 4: Gửi voice message qua Zalo
        const voiceUrl = `${ttsSettings.publicBaseUrl}/voice/${ctx.accountId}/${filename}`;
        log.info({ voiceUrl }, "Bước 4: Gửi voice message qua Zalo...");

        await enqueueSend(ctx.threadKey, async () => {
          return await ctx.api.sendVoice({ voiceUrl }, ctx.threadId, ctx.threadType);
        });

        // Ước lượng thời lượng
        const durationSecs = format === "mp3" ? audioBuffer.length / 6000 : audioBuffer.length / 48000;
        ctx.ghiNhanDaGui?.(ghiChuDaGuiVoice(durationSecs));

        log.info({ filename, durationSecs: Math.round(durationSecs) }, "Đã gửi voice thành công");
        return `Đã tạo và gửi tin nhắn thoại podcast thành công (khoảng ${Math.max(15, Math.round(durationSecs))} giây). Không cần gửi thêm tin nhắn văn bản nào nữa về nội dung vừa đọc.`;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error({ error: msg }, "Lỗi khi tạo voice podcast");
        return ketQuaLoi(`Không thể tạo bản audio: ${msg}`);
      }
    },
  });
}
