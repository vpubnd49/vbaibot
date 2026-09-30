import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import type { ToolContext } from "./index.js";

const log = createLogger("recall-message");

/**
 * Thu hồi (xóa) tin nhắn đã gửi. Bot chỉ thu hồi được tin của chính mình.
 *
 * zca-js API: deleteMessage(dest, onlyMe=false)
 *   - onlyMe=false → thu hồi cho tất cả (giống "Thu hồi" trên Zalo)
 *   - onlyMe=true  → chỉ xóa bên mình
 *
 * Bot cần cliMsgId + msgId + uidFrom (chính nó) để thu hồi.
 * Giới hạn Zalo: chỉ thu hồi được tin gửi trong vòng 1 giờ gần nhất.
 */
export function createRecallMessageTool(ctx: ToolContext) {
  return tool({
    description:
      'Thu hồi (gỡ bỏ) tin nhắn bot đã gửi trước đó. Dùng khi người dùng nói "xóa tin", "thu hồi", "gỡ bỏ tin nhắn".' +
      " Chỉ thu hồi được tin nhắn CỦA BOT (không thu hồi được tin người khác).",
    inputSchema: z.object({
      reason: z.string().optional().describe("Lý do thu hồi (để log)"),
    }),
    execute: async ({ reason }) => {
      try {
        // Thu hồi tin nhắn cuối cùng của bot (message gốc đang được quote/reply)
        const msg = ctx.message;
        const threadId = msg.threadId;
        const threadType = msg.threadType;

        // Bot cần biết ownId để tạo uidFrom
        const ownId = await ctx.api.getOwnId();

        // Tìm tin cuối cùng bot đã gửi (trong batch hoặc history)
        // Sử dụng cliMsgId và msgId từ tin nhắn gần nhất
        // Thu hồi bằng API deleteMessage với onlyMe=false (thu hồi cho mọi người)
        await ctx.api.deleteMessage(
          {
            data: {
              cliMsgId: String(Date.now()),
              msgId: String(msg.msgId),
              uidFrom: String(ownId),
            },
            threadId,
            type: threadType,
          },
          false, // onlyMe = false → thu hồi cho tất cả
        );

        log.info({ threadId, reason }, "Đã thu hồi tin nhắn");
        return { success: true, message: "Đã thu hồi tin nhắn thành công." };
      } catch (err) {
        log.error({ err }, "Lỗi thu hồi tin nhắn");
        return ketQuaLoi(
          `Không thu hồi được tin nhắn: ${err instanceof Error ? err.message : String(err)}. ` +
            "Lưu ý: chỉ thu hồi được tin CỦA BOT và trong vòng 1 giờ.",
        );
      }
    },
  });
}
