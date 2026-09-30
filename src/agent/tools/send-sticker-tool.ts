import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import type { ToolContext } from "./index.js";

const log = createLogger("send-sticker");

/**
 * Gửi sticker vào cuộc trò chuyện.
 *
 * zca-js API:
 *   searchSticker(keyword, limit) → StickerBasic[]
 *   sendSticker({ id, cateId, type }, threadId, threadType)
 *
 * Flow: LLM quyết keyword → search → lấy sticker phù hợp nhất → gửi.
 */
export function createSendStickerTool(ctx: ToolContext) {
  return tool({
    description:
      'Gửi sticker (nhãn dán) vào cuộc trò chuyện để thể hiện cảm xúc. ' +
      'Dùng khi người dùng nói "gửi sticker", "gửi nhãn dán", hoặc khi cần phản hồi bằng biểu cảm vui vẻ.',
    inputSchema: z.object({
      keyword: z
        .string()
        .min(1)
        .max(50)
        .describe("Từ khóa tìm sticker (VD: vui, buồn, cảm ơn, chúc mừng, xin lỗi, yêu, giận, ok, hello)"),
    }),
    execute: async ({ keyword }) => {
      try {
        const threadId = ctx.message.threadId;
        const threadType = ctx.message.threadType;

        // Tìm sticker phù hợp
        const results = await ctx.api.searchSticker(keyword, 5);
        if (!results || results.length === 0) {
          return ketQuaLoi(`Không tìm thấy sticker nào cho "${keyword}". Thử từ khóa khác.`);
        }

        // Chọn sticker đầu tiên
        const sticker = results[0];
        await ctx.api.sendSticker(
          { id: sticker.sticker_id, cateId: sticker.cate_id, type: sticker.type },
          threadId,
          threadType,
        );

        log.info({ threadId, keyword, stickerId: sticker.sticker_id }, "Đã gửi sticker");
        return { success: true, message: `Đã gửi sticker "${keyword}" thành công.` };
      } catch (err) {
        log.error({ err, keyword }, "Lỗi gửi sticker");
        return ketQuaLoi(
          `Không gửi được sticker: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  });
}
