import { getBalance, getSummaryByCategory, getMonthlySummary } from "./financial-store.js";

// Định dạng tiền tệ VNĐ
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + " đ";
}

export function generateCashflowReport(
  accountId: string,
  threadId: string,
  opts?: { from?: string; to?: string }
): string {
  const balance = getBalance(accountId, threadId);
  const summary = getSummaryByCategory(accountId, threadId, opts);
  const monthly = getMonthlySummary(accountId, threadId, 6);

  let report = `📊 **BÁO CÁO TÀI CHÍNH**\n\n`;
  
  if (opts?.from && opts?.to) {
    report += `📅 Thời gian: ${opts.from} đến ${opts.to}\n\n`;
  }

  // 1. TỔNG QUAN
  report += `**TỔNG QUAN:**\n`;
  report += `🔸 Tổng thu: ${formatCurrency(balance.totalThu)}\n`;
  report += `🔸 Tổng chi: ${formatCurrency(balance.totalChi)}\n`;
  report += `🔸 Số dư hiện tại: ${formatCurrency(balance.soDu)}\n\n`;

  // 2. CHI TIẾT THEO DANH MỤC
  const topThu = summary.filter((s) => s.type === "thu").slice(0, 5);
  const topChi = summary.filter((s) => s.type === "chi").slice(0, 5);

  if (topThu.length > 0) {
    report += `📈 **TOP NGUỒN THU:**\n`;
    topThu.forEach((item) => {
      report += `- ${item.category}: ${formatCurrency(item.total)}\n`;
    });
    report += `\n`;
  }

  if (topChi.length > 0) {
    report += `📉 **TOP KHOẢN CHI:**\n`;
    topChi.forEach((item) => {
      report += `- ${item.category}: ${formatCurrency(item.total)}\n`;
    });
    report += `\n`;
  }

  // 3. TỔNG HỢP THEO THÁNG
  if (monthly.length > 0) {
    report += `📅 **BIẾN ĐỘNG THEO THÁNG (Gần nhất):**\n`;
    monthly.forEach((m) => {
      report += `- Tháng ${m.month}: Thu ${formatCurrency(m.thu)} | Chi ${formatCurrency(m.chi)}\n`;
    });
  }

  return report;
}
