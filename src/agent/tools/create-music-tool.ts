import { tool } from "ai";
import { z } from "zod";
import { isMusicGenConfigured } from "../../config/runtime-music-settings.js";
import { generateMusic } from "../../music/music-generation-client.js";
import { checkMusicRateLimit } from "../../music/music-rate-limit.js";
import { enqueueSend } from "../../middleware/rate-limiter.js";
import { withNamedTempFile } from "../../shared/temp-file-store.js";
import { guiFileKemCaption } from "./send-attachment-with-caption.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { ghiChuDaGuiChu, ghiChuDaGuiNhac } from "./sent-by-tool-note.js";
import { parseSheetMusic } from "../../music/sheet-music-parser.js";
import { composeSongLyrics } from "../../music/song-lyrics-composer.js";
import { collectRecentImagePaths } from "./read-image-tool.js";
import { loadStoredImage } from "../../conversation/media-store.js";
import type { ToolContext } from "./index.js";

export function createMusicTool(ctx: ToolContext, generate = generateMusic) {
  return tool({
    description:
      "Sáng tác bài hát hoàn chỉnh (có giọng hát và hòa âm phối khí) hoặc tạo bài hát từ bản phổ nhạc. " +
      "BẮT BUỘC GỌI TOOL NÀY khi người dùng yêu cầu: \"tạo nhạc\", \"sáng tác bài hát\", \"làm bài hát\", \"xuất ra file mp3\", \"xuất file mp3\", \"xuất file âm thanh bài hát\", \"hát bài này cho tôi nghe\", \"xuất bài hát\", \"hát bài này\", \"làm nhạc\".",
    inputSchema: z.object({
      mode: z.enum(["tu_ban_pho", "sang_tac_moi", "tao_beat_nhac"]).describe("Chế độ: 'tu_ban_pho' = Đọc bản phổ nhạc từ ảnh gửi kèm; 'sang_tac_moi' = Tự sáng tác lời & nhạc từ ý tưởng/văn bản; 'tao_beat_nhac' = Chỉ tạo nhạc nền không lời"),
      prompt: z.string().min(1).max(3000).describe("Mô tả nội dung, chủ đề hoặc yêu cầu sáng tác"),
      imageIndex: z.coerce.number().int().min(1).optional().describe("Chỉ dùng cho mode tu_ban_pho: Ảnh bản phổ nhạc thứ mấy trong chat (mặc định 1 - ảnh mới nhất)"),
      vocalType: z.enum(["nam", "nu", "song_ca", "top_ca"]).optional().describe("Giọng ca thể hiện"),
      style: z.string().optional().describe("Thể loại/phong cách phối khí"),
      caption: z.string().optional(),
    }),
    execute: async ({ mode, prompt, imageIndex, vocalType, style, caption }) => {
      const threadKey = `${ctx.account.id}:${ctx.message.threadId}`;

      if (!isMusicGenConfigured()) {
        return ketQuaLoi("Tool tạo nhạc chưa cấu hình API key. Nói thật với người dùng là chưa tạo nhạc được.");
      }

      const rate = checkMusicRateLimit(threadKey);
      if (!rate.ok) return ketQuaLoi(rate.reason);

      const sendNotice = async (notice: string) => {
        await enqueueSend(threadKey, () =>
          ctx.api.sendMessage({ msg: notice }, ctx.message.threadId, ctx.message.threadType)
        ).then(() => {
          ctx.ghiNhanDaGui?.(ghiChuDaGuiChu(notice));
        }).catch(() => {
          // Bỏ qua lỗi
        });
      };

      try {
        let finalMusicParams: Parameters<typeof generate>[0] = { prompt };
        
        if (mode === "tu_ban_pho") {
          const paths = collectRecentImagePaths(ctx);
          if (paths.length === 0) return ketQuaLoi("Không tìm thấy ảnh bản phổ nào trong hội thoại.");
          const idx = (imageIndex || 1) - 1;
          const relPath = paths[idx];
          if (!relPath) return ketQuaLoi(`Chỉ có ${paths.length} ảnh, không tìm thấy ảnh thứ ${idx + 1}.`);
          
          const image = loadStoredImage(relPath);
          if (!image) return ketQuaLoi("Ảnh đã bị xóa khỏi bộ nhớ.");

          await sendNotice("Đang đọc và phân tích bản phổ nhạc...");
          const sheetInfo = await parseSheetMusic(image);
          
          const titleDesc = sheetInfo.title || "bài hát";
          await sendNotice(`Đã đọc xong bản phổ "[${titleDesc}]". Đang hòa âm phối khí và tạo bản hát hoàn chỉnh...`);
          
          finalMusicParams = {
            prompt: prompt,
            title: sheetInfo.title,
            lyrics: sheetInfo.lyrics,
            styleTags: sheetInfo.styleTags,
            vocalType: vocalType,
            instrumental: false,
          };
          
        } else if (mode === "sang_tac_moi") {
          await sendNotice("Đang sáng tác lời bài hát...");
          
          const song = await composeSongLyrics({
            topic: prompt,
            style: style,
            singerGender: vocalType,
          });
          
          await sendNotice(`Đã viết xong lời cho bài hát "${song.title}". Đang tiến hành tạo nhạc...`);
          
          finalMusicParams = {
            prompt: prompt,
            title: song.title,
            lyrics: song.lyrics,
            styleTags: song.styleTags,
            vocalType: vocalType,
            instrumental: false,
          };
          
        } else if (mode === "tao_beat_nhac") {
          await sendNotice("Đang tạo nhạc nền, đợi 30 giây - 2 phút nhé...");
          finalMusicParams = {
            prompt: prompt,
            instrumental: true,
            styleTags: style,
          };
        }

        const music = await generate(finalMusicParams);
        const fileName = `nhac-${Date.now()}.mp3`;

        await withNamedTempFile(fileName, music.data, (filePath) =>
          guiFileKemCaption(
            ctx.api,
            threadKey,
            ctx.message.threadId,
            ctx.message.threadType,
            filePath,
            caption
          )
        );

        ctx.ghiNhanDaGui?.(ghiChuDaGuiNhac(caption));
        return "Đã tạo và GỬI file nhạc cho người dùng rồi. KHÔNG gọi send_file để gửi lại.";
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        return ketQuaLoi(`Tạo nhạc thất bại (${reason}). Nói thật với người dùng.`);
      }
    },
  });
}
