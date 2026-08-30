import { tool } from "ai";
import { z } from "zod";
import { isVideoGenConfigured } from "../../config/runtime-video-settings.js";
import { generateVideo } from "../../video/video-generation-client.js";
import { checkVideoRateLimit } from "../../video/video-rate-limit.js";
import { enqueueSend } from "../../middleware/rate-limiter.js";
import { createLogger } from "../../shared/logger.js";
import { withNamedTempFile } from "../../shared/temp-file-store.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ghiChuDaGuiVideo, ghiChuDaGuiChu } from "./sent-by-tool-note.js";
import type { ToolContext } from "./index.js";

const log = createLogger("create-video");

export function createVideoTool(ctx: ToolContext, generate = generateVideo) {
  return tool({
    description: 'Tạo video ngắn (5-8 giây) từ mô tả bằng AI. Gửi file MP4 trực tiếp vào cuộc trò chuyện. BẮT BUỘC GỌI TOOL NÀY khi người dùng yêu cầu: "tạo video", "làm video", "quay clip", "video AI", "tạo phim ngắn".',
    inputSchema: z.object({
      prompt: z.string().min(1).max(2000).describe("Mô tả chi tiết nội dung video cần tạo"),
      aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().describe("Tỷ lệ khung hình"),
      durationSec: z.literal(5).or(z.literal(8)).optional().describe("Thời lượng video (giây)"),
      caption: z.string().optional().describe("Lời nhắn gửi kèm video"),
    }),
    execute: async ({ prompt, aspectRatio, durationSec, caption }) => {
      const threadKey = `${ctx.account.id}:${ctx.message.threadId}`;

      if (!isVideoGenConfigured()) {
        return ketQuaLoi("Tool tạo video chưa cấu hình API key. Nói thật với người dùng là chưa tạo được.");
      }

      const rate = checkVideoRateLimit(threadKey);
      if (!rate.ok) return ketQuaLoi(rate.reason);

      await enqueueSend(threadKey, () =>
        ctx.api.sendMessage(
          { msg: "Đang tạo video, đợi 1-3 phút nhé..." },
          ctx.message.threadId,
          ctx.message.threadType
        )
      ).then(() => {
        ctx.ghiNhanDaGui?.(ghiChuDaGuiChu("Đang tạo video, đợi 1-3 phút nhé..."));
      }).catch(() => {});

      try {
        const video = await generate({ prompt, aspectRatio, durationSec });
        const fileName = `video-${Date.now()}.mp4`;
        await withNamedTempFile(fileName, video.data, (filePath) =>
          guiFileKemCaption(
            ctx.api,
            threadKey,
            ctx.message.threadId,
            ctx.message.threadType,
            filePath,
            caption
          )
        );
        ctx.ghiNhanDaGui?.(ghiChuDaGuiVideo(caption));
        log.info(
          { accountId: ctx.account.id, threadId: ctx.message.threadId, kb: Math.round(video.data.length / 1024) },
          "Đã gửi video tự tạo"
        );
        return `Đã tạo và GỬI video cho người dùng rồi. KHÔNG gọi send_file để gửi lại. (${Math.round(video.data.length / 1024)} KB)`;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        log.warn({ err }, "Tạo video thất bại");
        return ketQuaLoi(`Tạo video thất bại (${reason}). Nói thật với người dùng.`);
      }
    },
  });
}
