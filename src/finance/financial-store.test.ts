import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addTransaction,
  listTransactions,
  getBalance,
  getSummaryByCategory,
  getMonthlySummary,
  deleteTransaction,
  ensureDefaultCategories,
} from "./financial-store.js";

test("Financial store: ghi nhận thu chi và tính số dư", () => {
  const accountId = "test-acc-fin";
  const threadId = "test-thread-fin-" + Date.now();
  const userId = "test-user-1";

  ensureDefaultCategories(accountId, threadId);

  // Thêm khoản thu
  const txThu = addTransaction(accountId, threadId, userId, {
    type: "thu",
    amount: 10000000,
    category: "Lương/Thưởng",
    description: "Lương tháng 8",
    transactionDate: "2026-08-01",
  });
  assert.ok(txThu.id > 0);
  assert.equal(txThu.type, "thu");
  assert.equal(txThu.amount, 10000000);

  // Thêm khoản chi
  const txChi = addTransaction(accountId, threadId, userId, {
    type: "chi",
    amount: 2500000,
    category: "Ăn uống",
    description: "Tiệc công ty",
    transactionDate: "2026-08-05",
  });
  assert.ok(txChi.id > 0);
  assert.equal(txChi.type, "chi");
  assert.equal(txChi.amount, 2500000);

  // Kiểm tra số dư
  const balance = getBalance(accountId, threadId);
  assert.equal(balance.totalThu, 10000000);
  assert.equal(balance.totalChi, 2500000);
  assert.equal(balance.soDu, 7500000);

  // Liệt kê giao dịch
  const list = listTransactions(accountId, threadId);
  assert.equal(list.length, 2);

  // Thống kê danh mục
  const summary = getSummaryByCategory(accountId, threadId);
  assert.ok(summary.length >= 2);

  // Thống kê theo tháng
  const monthly = getMonthlySummary(accountId, threadId);
  assert.ok(monthly.length >= 1);
  assert.equal(monthly[0]!.month, "2026-08");

  // Xóa giao dịch
  const deleted = deleteTransaction(accountId, threadId, userId, txChi.id);
  assert.equal(deleted, true);

  const balanceAfter = getBalance(accountId, threadId);
  assert.equal(balanceAfter.totalChi, 0);
  assert.equal(balanceAfter.soDu, 10000000);
});
