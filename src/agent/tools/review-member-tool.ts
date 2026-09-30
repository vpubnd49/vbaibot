import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import type { ToolContext } from "./index.js";

const log = createLogger("review-member");

/**
 * Duyệt/từ chối thành viên đang chờ vào nhóm.
 *
 * zca-js APIs:
 *   getPendingGroupMembers(groupId) → { users: [{ uid, dpn, avatar }] }
 *   reviewPendingMemberRequest({ members, isApprove }, groupId)
 */
export function createReviewMemberTool(ctx: ToolContext) {
  return tool({
    description:
      'Duyệt hoặc từ chối thành viên đang chờ vào nhóm Zalo. ' +
      'Dùng khi: "duyệt thành viên", "chấp nhận vào nhóm", "từ chối vào nhóm", "xem ai đang chờ duyệt". ' +
      'CHỈ dùng trong nhóm và bot phải là admin/phó nhóm.',
    inputSchema: z.object({
      action: z.enum(["list", "approve", "reject", "approve_all", "reject_all"]).describe(
        "list = xem danh sách chờ, approve/reject = duyệt/từ chối 1 người, approve_all/reject_all = duyệt/từ chối tất cả",
      ),
      memberId: z.string().optional().describe("ID thành viên (chỉ dùng cho approve/reject)"),
    }),
    execute: async ({ action, memberId }) => {
      try {
        if (!ctx.message.isGroup) {
          return ketQuaLoi("Chức năng duyệt thành viên chỉ dùng trong nhóm.");
        }

        const groupId = ctx.message.threadId;

        if (action === "list") {
          const pending = await ctx.api.getPendingGroupMembers(groupId);
          if (!pending.users || pending.users.length === 0) {
            return { success: true, message: "Không có ai đang chờ duyệt vào nhóm.", pending: [] };
          }
          const list = pending.users.map((u) => ({
            id: u.uid,
            name: u.dpn,
          }));
          return {
            success: true,
            message: `Có ${list.length} người đang chờ duyệt.`,
            pending: list,
          };
        }

        if (action === "approve" || action === "reject") {
          if (!memberId) return ketQuaLoi("Thiếu ID thành viên.");
          const result = await ctx.api.reviewPendingMemberRequest(
            { members: memberId, isApprove: action === "approve" },
            groupId,
          );
          log.info({ groupId, memberId, action, result }, "Đã duyệt/từ chối thành viên");
          return {
            success: true,
            message: action === "approve"
              ? `Đã duyệt thành viên ${memberId} vào nhóm.`
              : `Đã từ chối thành viên ${memberId}.`,
          };
        }

        if (action === "approve_all" || action === "reject_all") {
          const pending = await ctx.api.getPendingGroupMembers(groupId);
          if (!pending.users || pending.users.length === 0) {
            return { success: true, message: "Không có ai đang chờ duyệt." };
          }
          const ids = pending.users.map((u) => u.uid);
          const isApprove = action === "approve_all";
          const result = await ctx.api.reviewPendingMemberRequest(
            { members: ids, isApprove },
            groupId,
          );
          log.info({ groupId, count: ids.length, isApprove, result }, "Đã duyệt/từ chối tất cả");
          return {
            success: true,
            message: isApprove
              ? `Đã duyệt tất cả ${ids.length} thành viên vào nhóm.`
              : `Đã từ chối tất cả ${ids.length} yêu cầu.`,
          };
        }

        return ketQuaLoi("Hành động không hợp lệ.");
      } catch (err) {
        log.error({ err, action }, "Lỗi duyệt thành viên");
        return ketQuaLoi(
          `Không thực hiện được: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  });
}
