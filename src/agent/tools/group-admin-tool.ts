import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import type { ToolContext } from "./index.js";

const log = createLogger("group-admin");

/**
 * Quản trị nhóm: đổi tên nhóm, kick thành viên.
 *
 * zca-js APIs:
 *   changeGroupName(name, groupId)
 *   removeUserFromGroup(memberId, groupId)
 *
 * Bot phải là admin/phó nhóm để dùng được.
 */
export function createGroupAdminTool(ctx: ToolContext) {
  return tool({
    description:
      'Quản trị nhóm Zalo: đổi tên nhóm hoặc kick (xóa) thành viên. ' +
      'Bot phải là ADMIN hoặc PHÓ NHÓM mới dùng được. ' +
      'Dùng khi người dùng yêu cầu "đổi tên nhóm", "kick", "xóa thành viên", "đuổi". ' +
      'CHỈ dùng trong nhóm.',
    inputSchema: z.object({
      action: z.enum(["rename", "kick"]).describe("Hành động: rename = đổi tên, kick = xóa thành viên"),
      newName: z.string().optional().describe("Tên mới cho nhóm (chỉ dùng khi action=rename)"),
      memberId: z.string().optional().describe("ID thành viên cần kick (chỉ dùng khi action=kick)"),
      reason: z.string().optional().describe("Lý do thực hiện (để log)"),
    }),
    execute: async ({ action, newName, memberId, reason }) => {
      try {
        if (!ctx.message.isGroup) {
          return ketQuaLoi("Chức năng quản trị nhóm chỉ dùng được trong nhóm.");
        }

        const groupId = ctx.message.threadId;

        if (action === "rename") {
          if (!newName?.trim()) return ketQuaLoi("Thiếu tên mới cho nhóm.");
          await ctx.api.changeGroupName(newName.trim(), groupId);
          log.info({ groupId, newName, reason }, "Đã đổi tên nhóm");
          return { success: true, message: `Đã đổi tên nhóm thành "${newName.trim()}".` };
        }

        if (action === "kick") {
          if (!memberId) return ketQuaLoi("Thiếu ID thành viên cần kick.");
          await ctx.api.removeUserFromGroup(memberId, groupId);
          log.info({ groupId, memberId, reason }, "Đã kick thành viên");
          return { success: true, message: `Đã xóa thành viên ${memberId} khỏi nhóm.` };
        }

        return ketQuaLoi("Hành động không hợp lệ.");
      } catch (err) {
        log.error({ err, action }, "Lỗi quản trị nhóm");
        return ketQuaLoi(
          `Không thực hiện được: ${err instanceof Error ? err.message : String(err)}. ` +
            "Bot có thể chưa phải admin/phó nhóm.",
        );
      }
    },
  });
}
