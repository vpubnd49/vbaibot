import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import {
  createTicket,
  updateTicketStatus,
  addTicketNote,
  listTickets,
  getTicket,
  ticketStats,
  type TicketStatus,
  type TicketPriority,
} from "../../conversation/ticket-store.js";
import type { ToolContext } from "./index.js";

const log = createLogger("ticket-tool");

/**
 * Quản lý yêu cầu hỗ trợ (ticket/phiếu) của khách hàng.
 *
 * Agent tự động tạo ticket khi khách nhắn về vấn đề cần theo dõi,
 * hoặc admin ra lệnh tạo/cập nhật.
 */
export function createTicketTool(ctx: ToolContext) {
  return tool({
    description:
      'Quản lý phiếu hỗ trợ khách hàng (ticket). ' +
      'Dùng khi: "tạo phiếu", "ghi nhận yêu cầu", "cập nhật trạng thái", "xem ticket", ' +
      '"danh sách yêu cầu", "đóng phiếu", "thống kê hỗ trợ".',
    inputSchema: z.object({
      action: z.enum(["create", "update_status", "add_note", "list", "get", "stats"]).describe(
        "create = tạo mới, update_status = đổi trạng thái, add_note = thêm ghi chú, list = danh sách, get = xem chi tiết, stats = thống kê",
      ),
      ticketId: z.number().optional().describe("ID phiếu (cho update/get/add_note)"),
      subject: z.string().optional().describe("Tiêu đề yêu cầu (cho create)"),
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional().describe("Trạng thái mới"),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Mức ưu tiên"),
      note: z.string().optional().describe("Ghi chú thêm"),
      statusFilter: z.string().optional().describe("Lọc theo trạng thái (cho list)"),
    }),
    execute: async ({ action, ticketId, subject, status, priority, note, statusFilter }) => {
      try {
        const accountId = ctx.account.id;

        if (action === "create") {
          if (!subject) return ketQuaLoi("Thiếu tiêu đề yêu cầu.");
          const ticket = createTicket({
            accountId,
            threadId: ctx.message.threadId,
            senderId: ctx.message.senderId ?? "unknown",
            senderName: ctx.message.senderName ?? "",
            subject,
            priority: priority as TicketPriority | undefined,
          });
          log.info({ ticketId: ticket.id, subject }, "Tạo ticket mới");
          return {
            success: true,
            message: `Đã tạo phiếu hỗ trợ #${ticket.id}: "${subject}". Trạng thái: Đang mở.`,
            ticket,
          };
        }

        if (action === "update_status") {
          if (!ticketId || !status) return ketQuaLoi("Thiếu ticketId hoặc status.");
          const ok = updateTicketStatus(accountId, ticketId, status as TicketStatus);
          if (!ok) return ketQuaLoi(`Không tìm thấy phiếu #${ticketId}.`);
          return { success: true, message: `Đã cập nhật phiếu #${ticketId} → ${status}.` };
        }

        if (action === "add_note") {
          if (!ticketId || !note) return ketQuaLoi("Thiếu ticketId hoặc note.");
          const ok = addTicketNote(accountId, ticketId, note);
          if (!ok) return ketQuaLoi(`Không tìm thấy phiếu #${ticketId}.`);
          return { success: true, message: `Đã thêm ghi chú vào phiếu #${ticketId}.` };
        }

        if (action === "list") {
          const tickets = listTickets(accountId, statusFilter ?? "");
          if (tickets.length === 0) {
            return { success: true, message: "Chưa có phiếu hỗ trợ nào.", tickets: [] };
          }
          const summary = tickets.map(
            (t) => `#${t.id} [${t.status}] ${t.priority === "urgent" ? "🔴" : t.priority === "high" ? "🟡" : ""} ${t.subject}`,
          );
          return {
            success: true,
            message: `Có ${tickets.length} phiếu:\n${summary.join("\n")}`,
            tickets,
          };
        }

        if (action === "get") {
          if (!ticketId) return ketQuaLoi("Thiếu ticketId.");
          const ticket = getTicket(accountId, ticketId);
          if (!ticket) return ketQuaLoi(`Không tìm thấy phiếu #${ticketId}.`);
          return { success: true, ticket };
        }

        if (action === "stats") {
          const s = ticketStats(accountId);
          return {
            success: true,
            message: `📊 Thống kê hỗ trợ:\n• Tổng: ${s.total}\n• Đang mở: ${s.open_count}\n• Đang xử lý: ${s.in_progress}\n• Đã giải quyết: ${s.resolved}`,
            stats: s,
          };
        }

        return ketQuaLoi("Hành động không hợp lệ.");
      } catch (err) {
        log.error({ err, action }, "Lỗi ticket");
        return ketQuaLoi(
          `Lỗi xử lý phiếu: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  });
}
