import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { forgetSentMessage, recentSentMessages } from "../../zalo/sent-message-tracker.js";
import type { ToolContext } from "./index.js";

const log = createLogger("recall-message");

/**
 * Thu hồi (xóa với mọi người) tin nhắn BOT đã gửi. Bot chỉ thu hồi được tin của
 * chính mình, trong vòng 1 giờ.
 *
 * zca-js API: `undo({ msgId, cliMsgId }, threadId, type)` - thu hồi cho tất cả.
 *
 * Id tin bot gửi lấy từ `sent-message-tracker` (ghi lại từ kết quả `sendMessage`).
 * Bản cũ dùng `msgId` của tin NGƯỜI DÙNG đang xử lý nên không bao giờ thu hồi
 * đúng tin của bot.
 *
 * `cliMsgId` lấy từ sự kiện tin của chính mình (`selfListen`); nếu chưa có
 * (listener chưa báo về) thì truyền 0 - Zalo định danh tin chủ yếu bằng `msgId`.
 */
export function createRecallMessageTool(ctx: ToolContext) {
  return tool({
    description:
      'Thu hồi (gỡ bỏ) tin nhắn bot đã gửi trước đó. Dùng khi người dùng nói "xóa tin", "thu hồi", "gỡ bỏ tin nhắn".' +
      " Chỉ thu hồi được tin nhắn CỦA BOT, gửi trong vòng 1 giờ gần nhất (không thu hồi được tin người khác).",
    inputSchema: z.object({
      count: z
        .coerce.number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe("Số tin gần nhất của bot cần thu hồi (mặc định 1, tối đa 5)"),
      reason: z.string().optional().describe("Lý do thu hồi (để log)"),
    }),
    execute: async ({ count, reason }) => {
      const threadId = ctx.message.threadId;
      const threadType = ctx.message.threadType;
      const threadKey = `${ctx.account.id}:${threadId}`;
      try {
        const targets = recentSentMessages(threadKey).slice(0, count ?? 1);
        if (targets.length === 0) {
          return ketQuaLoi(
            "Không có tin nào của bot trong vòng 1 giờ gần đây để thu hồi " +
              "(Zalo chỉ cho thu hồi tin trong vòng 1 giờ).",
          );
        }

        let recalled = 0;
        let lastError: unknown;
        for (const t of targets) {
          try {
            await ctx.api.undo(
              { msgId: t.msgId, cliMsgId: t.cliMsgId ?? 0 },
              threadId,
              threadType,
            );
            forgetSentMessage(threadKey, t.msgId);
            recalled += 1;
          } catch (err) {
            lastError = err;
            log.warn({ threadId, msgId: t.msgId, err }, "Thu hồi một tin thất bại");
          }
        }

        if (recalled === 0) {
          const detail = lastError instanceof Error ? lastError.message : String(lastError);
          return ketQuaLoi(
            `Không thu hồi được tin nhắn: ${detail}. Lưu ý: chỉ thu hồi được tin CỦA BOT và trong vòng 1 giờ.`,
          );
        }

        log.info({ threadId, reason, recalled, requested: targets.length }, "Đã thu hồi tin nhắn");
        return {
          success: true,
          message:
            recalled === targets.length
              ? `Đã thu hồi ${recalled} tin nhắn của bot.`
              : `Thu hồi được ${recalled}/${targets.length} tin nhắn của bot.`,
        };
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
