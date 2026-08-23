import { db } from "../conversation/database.js";

export type TransactionType = "thu" | "chi";

export type FinancialTransaction = {
  id: number;
  account_id: string;
  thread_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  voucher_info?: string;
  transaction_date: string;
  created_at: string;
};

export type FinancialCategory = {
  id: number;
  account_id: string;
  thread_id: string;
  name: string;
  type: "thu" | "chi" | "both";
  icon: string;
};

export function addTransaction(
  accountId: string,
  threadId: string,
  userId: string,
  data: {
    type: TransactionType;
    amount: number;
    category: string;
    description: string;
    voucherInfo?: string;
    transactionDate: string;
  }
): FinancialTransaction {
  const stmt = db.prepare(`
    INSERT INTO financial_transactions (
      account_id, thread_id, user_id, type, amount, category, description, voucher_info, transaction_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);
  return stmt.get(
    accountId,
    threadId,
    userId,
    data.type,
    data.amount,
    data.category,
    data.description,
    data.voucherInfo || null,
    data.transactionDate
  ) as FinancialTransaction;
}

export function listTransactions(
  accountId: string,
  threadId: string,
  opts?: {
    from?: string;
    to?: string;
    type?: TransactionType;
    category?: string;
    limit?: number;
  }
): FinancialTransaction[] {
  let sql = `SELECT * FROM financial_transactions WHERE account_id = ? AND thread_id = ?`;
  const params: any[] = [accountId, threadId];

  if (opts?.from) {
    sql += ` AND transaction_date >= ?`;
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ` AND transaction_date <= ?`;
    params.push(opts.to);
  }
  if (opts?.type) {
    sql += ` AND type = ?`;
    params.push(opts.type);
  }
  if (opts?.category) {
    sql += ` AND category = ?`;
    params.push(opts.category);
  }

  sql += ` ORDER BY transaction_date DESC, id DESC`;

  if (opts?.limit) {
    sql += ` LIMIT ?`;
    params.push(opts.limit);
  }

  const stmt = db.prepare(sql);
  return stmt.all(...params) as FinancialTransaction[];
}

export function getBalance(
  accountId: string,
  threadId: string
): { totalThu: number; totalChi: number; soDu: number } {
  const stmt = db.prepare(`
    SELECT type, SUM(amount) as total
    FROM financial_transactions
    WHERE account_id = ? AND thread_id = ?
    GROUP BY type
  `);
  const rows = stmt.all(accountId, threadId) as { type: string; total: number }[];

  let totalThu = 0;
  let totalChi = 0;

  for (const row of rows) {
    if (row.type === "thu") totalThu = row.total;
    if (row.type === "chi") totalChi = row.total;
  }

  return {
    totalThu,
    totalChi,
    soDu: totalThu - totalChi,
  };
}

export function getSummaryByCategory(
  accountId: string,
  threadId: string,
  opts?: { from?: string; to?: string }
): { category: string; type: string; total: number }[] {
  let sql = `
    SELECT category, type, SUM(amount) as total
    FROM financial_transactions
    WHERE account_id = ? AND thread_id = ?
  `;
  const params: any[] = [accountId, threadId];

  if (opts?.from) {
    sql += ` AND transaction_date >= ?`;
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ` AND transaction_date <= ?`;
    params.push(opts.to);
  }

  sql += ` GROUP BY type, category ORDER BY total DESC`;

  const stmt = db.prepare(sql);
  return stmt.all(...params) as { category: string; type: string; total: number }[];
}

export function getMonthlySummary(
  accountId: string,
  threadId: string,
  months: number = 6
): { month: string; thu: number; chi: number }[] {
  // Lấy tổng thu chi theo tháng (YYYY-MM)
  const stmt = db.prepare(`
    SELECT 
      substr(transaction_date, 1, 7) as month,
      SUM(CASE WHEN type = 'thu' THEN amount ELSE 0 END) as thu,
      SUM(CASE WHEN type = 'chi' THEN amount ELSE 0 END) as chi
    FROM financial_transactions
    WHERE account_id = ? AND thread_id = ?
    GROUP BY month
    ORDER BY month DESC
    LIMIT ?
  `);
  
  return stmt.all(accountId, threadId, months) as { month: string; thu: number; chi: number }[];
}

export function deleteTransaction(
  accountId: string,
  threadId: string,
  userId: string,
  txId: number
): boolean {
  // Chỉ cho phép người tạo xoá giao dịch
  const stmt = db.prepare(`
    DELETE FROM financial_transactions 
    WHERE id = ? AND account_id = ? AND thread_id = ? AND user_id = ?
  `);
  const result = stmt.run(txId, accountId, threadId, userId);
  return result.changes > 0;
}

export function getDefaultCategories() {
  return {
    thu: ["Lương/Thưởng", "Bán hàng", "Dịch vụ", "Lãi đầu tư", "Thu khác"],
    chi: [
      "Ăn uống",
      "Đi lại",
      "Thuê/Mặt bằng",
      "Điện nước internet",
      "Lương nhân viên",
      "Nguyên vật liệu",
      "Văn phòng phẩm",
      "Thuế/Phí",
      "Chi khác",
    ],
  };
}

export function ensureDefaultCategories(accountId: string, threadId: string) {
  // Kiểm tra đã có danh mục chưa
  const checkStmt = db.prepare(`SELECT COUNT(*) as count FROM financial_categories WHERE account_id = ? AND thread_id = ?`);
  const row = checkStmt.get(accountId, threadId) as { count: number };
  if (row.count > 0) return;

  const defaults = getDefaultCategories();
  const insertStmt = db.prepare(`
    INSERT INTO financial_categories (account_id, thread_id, name, type, icon)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const cat of defaults.thu) {
    insertStmt.run(accountId, threadId, cat, "thu", "💰");
  }
  for (const cat of defaults.chi) {
    insertStmt.run(accountId, threadId, cat, "chi", "💸");
  }
}
