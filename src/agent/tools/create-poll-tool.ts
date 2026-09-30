import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import type { ToolContext } from "./index.js";

const log = createLogger("create-poll");

/**
 * Tạo bình chọn (poll) trong nhóm Zalo.
 *
 * zca-js API: createPoll(options, groupId)
 * Chỉ hoạt động trong NHÓM (threadType = group).
 */
export function createPollTool(ctx: ToolContext) {
  return tool({
    description:
      'Tạo cuộc bình chọn (poll/thăm dò ý kiến) trong nhóm. ' +
      'BẮT BUỘC GỌI TOOL NÀY khi người dùng nói "tạo bình chọn", "thăm dò ý kiến", "tạo poll", "vote", "bỏ phiếu". ' +
      'CHỈ dùng được trong NHÓM, không dùng trong chat riêng.',
    inputSchema: z.object({
      question: z.string().min(1).max(500).describe("Câu hỏi bình chọn"),
      options: z.array(z.string()).min(2).max(10).describe("Danh sách lựa chọn (2-10 mục)"),
      allowMultiChoices: z.boolean().optional().describe("Cho phép chọn nhiều đáp án (mặc định: false)"),
      isAnonymous: z.boolean().optional().describe("Ẩn danh người bỏ phiếu (mặc định: false)"),
    }),
    execute: async ({ question, options, allowMultiChoices, isAnonymous }) => {
      try {
        if (!ctx.message.isGroup) {
          return ketQuaLoi("Bình chọn chỉ tạo được trong nhóm, không dùng được trong chat riêng.");
        }

        const groupId = ctx.message.threadId;

        await ctx.api.createPoll(
          {
            question,
            options,
            allowMultiChoices: allowMultiChoices ?? false,
            allowAddNewOption: false,
            hideVotePreview: false,
            isAnonymous: isAnonymous ?? false,
            expiredTime: 0, // không hết hạn
          },
          groupId,
        );

        log.info({ groupId, question, optionCount: options.length }, "Đã tạo bình chọn");
        return {
          success: true,
          message: `Đã tạo bình chọn "${question}" với ${options.length} lựa chọn.`,
        };
      } catch (err) {
        log.error({ err }, "Lỗi tạo bình chọn");
        return ketQuaLoi(
          `Không tạo được bình chọn: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  });
}
