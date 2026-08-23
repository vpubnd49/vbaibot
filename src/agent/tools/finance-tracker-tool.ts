import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./tool-catalog-types.js";
import { wrapUntrustedContent } from "./wrap-untrusted-content.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { 
  addTransaction, 
  listTransactions, 
  getBalance, 
  deleteTransaction, 
  ensureDefaultCategories 
} from "../../finance/financial-store.js";
import { generateCashflowReport } from "../../finance/cashflow-report.js";

export function createFinanceTrackerTool(ctx: ToolContext) {
  return tool({
    description: "Ghi nhận thu chi, theo dõi dòng tiền, tổng hợp báo cáo tài chính cá nhân hoặc nhóm.",
    inputSchema: z.object({
      action: z.enum(["add", "list", "balance", "summary", "report", "delete"])
        .describe("Hành động cần thực hiện: thêm (add), liệt kê (list), xem số dư (balance), xem báo cáo (report), xoá (delete)"),
      type: z.enum(["thu", "chi"]).optional()
        .describe("Loại giao dịch, dùng cho action=add hoặc lọc list"),
      amount: z.number().positive().optional()
        .describe("Số tiền giao dịch (dùng cho action=add)"),
      category: z.string().optional()
        .describe("Danh mục giao dịch (VD: Lương/Thưởng, Ăn uống...)"),
      description: z.string().optional()
        .describe("Mô tả chi tiết giao dịch"),
      transactionDate: z.string().optional()
        .describe("Ngày giao dịch định dạng YYYY-MM-DD. Mặc định là ngày hôm nay nếu không cung cấp."),
      transactionId: z.number().optional()
        .describe("ID của giao dịch cần thao tác (dùng cho action=delete)"),
      from: z.string().optional()
        .describe("Từ ngày (YYYY-MM-DD) dùng để lọc hoặc xem báo cáo"),
      to: z.string().optional()
        .describe("Đến ngày (YYYY-MM-DD) dùng để lọc hoặc xem báo cáo"),
    }),
    execute: async ({ action, type, amount, category, description, transactionDate, transactionId, from, to }) => {
      try {
        const accountId = ctx.account.id;
        const threadId = ctx.message.threadId;
        const userId = ctx.message.senderId;

        // Khởi tạo danh mục mặc định nếu chưa có
        ensureDefaultCategories(accountId, threadId);

        if (action === "add") {
          if (!type || !amount) {
            return ketQuaLoi("Thiếu type hoặc amount để thêm giao dịch.");
          }
          const today = new Date().toISOString().split("T")[0];
          const dateStr = transactionDate || today;
          
          const cat = category || "Khác";
          const desc = description || "";

          const tx = addTransaction(accountId, threadId, userId, {
            type,
            amount,
            category: cat,
            description: desc,
            transactionDate: dateStr
          });

          return wrapUntrustedContent(
            `Đã ghi nhận giao dịch: ID=${tx.id} | ${type === 'thu' ? '+' : '-'}${amount} đ | ${cat} | Ngày: ${dateStr}${desc ? ` | ${desc}` : ''}`,
            "kết quả thêm giao dịch"
          );
        }

        if (action === "list") {
          const list = listTransactions(accountId, threadId, { from, to, type, category, limit: 20 });
          if (list.length === 0) return wrapUntrustedContent("Không có giao dịch nào.", "danh sách giao dịch");
          
          const lines = list.map(tx => 
            `[ID: ${tx.id}] ${tx.transaction_date} - ${tx.type === 'thu' ? '+' : '-'}${tx.amount}đ - ${tx.category}${tx.description ? ` - ${tx.description}` : ''}`
          );
          return wrapUntrustedContent(lines.join("\n"), "danh sách giao dịch");
        }

        if (action === "balance" || action === "summary") {
          const bal = getBalance(accountId, threadId);
          return wrapUntrustedContent(
            `Tổng thu: ${bal.totalThu} đ\nTổng chi: ${bal.totalChi} đ\nSố dư: ${bal.soDu} đ`,
            "số dư hiện tại"
          );
        }

        if (action === "report") {
          const report = generateCashflowReport(accountId, threadId, { from, to });
          return wrapUntrustedContent(report, "báo cáo tài chính");
        }

        if (action === "delete") {
          if (!transactionId) return ketQuaLoi("Thiếu transactionId để xóa.");
          const ok = deleteTransaction(accountId, threadId, userId, transactionId);
          if (ok) {
            return wrapUntrustedContent(`Đã xoá thành công giao dịch ID=${transactionId}`, "kết quả xoá giao dịch");
          } else {
            return ketQuaLoi(`Không tìm thấy giao dịch ID=${transactionId} hoặc bạn không có quyền xoá.`);
          }
        }

        return ketQuaLoi(`Hành động '${action}' không được hỗ trợ.`);
      } catch (err) {
        return ketQuaLoi(`Lỗi khi xử lý sổ thu chi (${err instanceof Error ? err.message : String(err)})`);
      }
    },
  });
}
