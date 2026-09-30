import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import type { ToolContext } from "./index.js";

const log = createLogger("forward-to-owner");

/**
 * Chuyển tiếp tin nhắn đến chủ bot (admin) khi có việc gấp hoặc ai đó tag chủ.
 *
 * Dùng adminUserIds từ account config để biết chủ là ai.
 * Gửi tin nhắn tóm tắt vào chat riêng giữa bot và chủ.
 */
export function createForwardToOwnerTool(ctx: ToolContext) {
  return tool({
    description:
      'Chuyển tiếp tin nhắn hoặc báo cáo cho CHỦ BOT (admin). ' +
      'Dùng khi: (1) có người nhắn gấp/khẩn, (2) ai đó tag/gọi chủ, ' +
      '(3) có vấn đề cần chủ xử lý, (4) người dùng nói "báo chủ", "gọi sếp", "nhắn admin".',
    inputSchema: z.object({
      summary: z.string().describe("Tóm tắt nội dung cần báo cho chủ"),
      urgency: z.enum(["normal", "urgent"]).optional().describe("Mức độ: normal hoặc urgent"),
      senderName: z.string().optional().describe("Tên người gửi tin gốc"),
    }),
    execute: async ({ summary, urgency, senderName }) => {
      try {
        const admins = ctx.account.adminUserIds;
        if (!admins || admins.length === 0) {
          return ketQuaLoi("Chưa cấu hình admin. Vào Settings → Accounts để thêm Admin User IDs.");
        }

        const prefix = urgency === "urgent" ? "🚨 KHẨN" : "📩 Thông báo";
        const from = senderName ? `\nTừ: ${senderName}` : "";
        const threadInfo = ctx.message.isGroup ? `\nNhóm: ${ctx.message.threadId}` : "";
        const msg = `${prefix}${from}${threadInfo}\n\n${summary}`;

        // Gửi cho admin đầu tiên (chat riêng)
        const adminId = admins[0];
        await ctx.api.sendMessage(
          { msg, quote: undefined },
          adminId,
          0, // ThreadType.User = 0
        );

        log.info({ adminId, urgency, summary: summary.slice(0, 100) }, "Đã chuyển tin cho chủ");
        return {
          success: true,
          message: "Đã báo cho chủ bot. Chủ sẽ xem và phản hồi sớm.",
        };
      } catch (err) {
        log.error({ err }, "Lỗi chuyển tin cho chủ");
        return ketQuaLoi(
          `Không gửi được cho chủ: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  });
}
