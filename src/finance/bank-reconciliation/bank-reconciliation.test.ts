/**
 * bank-reconciliation.test.ts
 *
 * Test suite toàn diện cho Ứng dụng Đối soát Ngân hàng & Sổ Kế toán.
 * Kiểm tra các tiêu chí nghiệm thu theo skill vn-finance-app-builder & vn-accounting:
 * 1. Khớp chính xác (Tier 1: Mã tham chiếu + Số tiền)
 * 2. Khớp theo quy tắc (Tier 2: Số tiền + Ngày + Tên đối tác)
 * 3. Khớp 1-Nhiều (Tier 3: Batch payment gộp 2 hóa đơn)
 * 4. Bất biến chống ghép liều (Ambiguous handling)
 * 5. Bảng giải trình chênh lệch & đề xuất định khoản chuẩn TT 200
 * 6. Tính toán cân đối số học bằng BigInt (0 VND variance)
 * 7. Phân quyền & Nguyên tắc Bốn mắt (Maker không được tự duyệt)
 * 8. Khóa kỳ kế toán (Chống sửa đổi sau khi locked)
 * 9. Lịch sử duyệt & Audit trail
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOCK_BANK_TRANSACTIONS,
  MOCK_CLOSING_BALANCES,
  MOCK_LEDGER_ENTRIES,
  MOCK_OPENING_BALANCES,
  MOCK_USERS,
} from "./mock-data.js";
import { ReconciliationError, ReconciliationService } from "./reconciliation-service.js";

describe("Bank Reconciliation Application (vn-finance-app-builder & vn-accounting)", () => {
  it("Khởi tạo phiên đối soát thành công và từ chối vai trò AUDITOR can thiệp", () => {
    const service = new ReconciliationService();

    // 1. Auditor cố gắng khởi tạo -> Bị từ chối
    assert.throws(
      () =>
        service.createReconciliationSession({
          reportId: "REC-2026-10",
          period: "2026-10",
          bankAccount: "0071001234567",
          openingBalanceBank: MOCK_OPENING_BALANCES.bank,
          closingBalanceBank: MOCK_CLOSING_BALANCES.bank,
          openingBalanceLedger: MOCK_OPENING_BALANCES.ledger,
          closingBalanceLedger: MOCK_CLOSING_BALANCES.ledger,
          bankTransactions: MOCK_BANK_TRANSACTIONS,
          ledgerEntries: MOCK_LEDGER_ENTRIES,
          actor: MOCK_USERS.auditor,
        }),
      (err: unknown) => {
        return (
          err instanceof ReconciliationError &&
          err.code === "PERMISSION_DENIED"
        );
      }
    );

    // 2. Maker khởi tạo -> Thành công
    const report = service.createReconciliationSession({
      reportId: "REC-2026-10",
      period: "2026-10",
      bankAccount: "0071001234567",
      openingBalanceBank: MOCK_OPENING_BALANCES.bank,
      closingBalanceBank: MOCK_CLOSING_BALANCES.bank,
      openingBalanceLedger: MOCK_OPENING_BALANCES.ledger,
      closingBalanceLedger: MOCK_CLOSING_BALANCES.ledger,
      bankTransactions: MOCK_BANK_TRANSACTIONS,
      ledgerEntries: MOCK_LEDGER_ENTRIES,
      actor: MOCK_USERS.maker,
    });

    assert.equal(report.status, "DRAFT");
    assert.equal(report.totalBankTransactions, 8);
    assert.equal(report.totalLedgerEntries, 9);
    assert.equal(report.auditHistory.length, 1);
    assert.equal(report.auditHistory[0]!.action, "IMPORT_DATA");
  });

  it("Chạy matching tự động: Nhận diện đúng Exact Match, Rule Match, Batch Match và Ambiguous", () => {
    const service = new ReconciliationService();
    service.createReconciliationSession({
      reportId: "REC-2026-10",
      period: "2026-10",
      bankAccount: "0071001234567",
      openingBalanceBank: MOCK_OPENING_BALANCES.bank,
      closingBalanceBank: MOCK_CLOSING_BALANCES.bank,
      openingBalanceLedger: MOCK_OPENING_BALANCES.ledger,
      closingBalanceLedger: MOCK_CLOSING_BALANCES.ledger,
      bankTransactions: MOCK_BANK_TRANSACTIONS,
      ledgerEntries: MOCK_LEDGER_ENTRIES,
      actor: MOCK_USERS.maker,
    });

    const report = service.runAutoMatching("REC-2026-10", MOCK_USERS.maker);

    // 1. Kiểm tra Tier 1 (Exact Match): BTX-01 (150tr) và BTX-02 (80tr)
    const exactMatches = report.matchedPairs.filter((p) => p.status === "EXACT_MATCH");
    assert.equal(exactMatches.length, 2, "Phải có đúng 2 cặp Exact Match theo mã FT");
    assert.ok(exactMatches.some((p) => p.matchedAmount === 150_000_000n));
    assert.ok(exactMatches.some((p) => p.matchedAmount === 80_000_000n));

    // 2. Kiểm tra Tier 2 (Rule Match): BTX-03 (45tr - Đại Phát)
    const ruleMatches = report.matchedPairs.filter((p) => p.status === "RULE_MATCH");
    assert.ok(
      ruleMatches.some((p) => p.matchedAmount === 45_000_000n),
      "Giao dịch 45 triệu phải khớp theo Rule Match"
    );

    // 3. Kiểm tra Tier 3 (Batch Match): BTX-04 (60tr) khớp gộp 2 hóa đơn 25tr + 35tr
    const batchMatches = report.matchedPairs.filter((p) => p.status === "BATCH_MATCH");
    assert.equal(batchMatches.length, 1, "Phải nhận diện được 1 batch match");
    assert.equal(batchMatches[0]!.matchedAmount, 60_000_000n);
    assert.equal(batchMatches[0]!.ledgerEntryIds.length, 2);

    // 4. Kiểm tra Ambiguous Match: BTX-05 & BTX-06 (12tr) không được tự tiện ghép bừa
    const ambiguous = report.matchedPairs.filter((p) => p.status === "AMBIGUOUS");
    assert.ok(ambiguous.length >= 1, "Phải phát hiện cặp giao dịch mơ hồ 12 triệu");
    assert.equal(ambiguous[0]!.requiresReview, true);
  });

  it("Phân tích chênh lệch và tính bảng cân đối điều chỉnh (Variance = 0)", () => {
    const service = new ReconciliationService();
    service.createReconciliationSession({
      reportId: "REC-2026-10",
      period: "2026-10",
      bankAccount: "0071001234567",
      openingBalanceBank: MOCK_OPENING_BALANCES.bank,
      closingBalanceBank: MOCK_CLOSING_BALANCES.bank,
      openingBalanceLedger: MOCK_OPENING_BALANCES.ledger,
      closingBalanceLedger: MOCK_CLOSING_BALANCES.ledger,
      bankTransactions: MOCK_BANK_TRANSACTIONS,
      ledgerEntries: MOCK_LEDGER_ENTRIES,
      actor: MOCK_USERS.maker,
    });

    const report = service.runAutoMatching("REC-2026-10", MOCK_USERS.maker);

    // Giải quyết 2 mục ambiguous: gán BTX-05 với LED-06, BTX-06 với LED-07
    const ambPairs = report.matchedPairs.filter((p) => p.status === "AMBIGUOUS");
    assert.equal(ambPairs.length, 2, "Có 2 giao dịch mơ hồ cần giải quyết");
    service.confirmManualMatch("REC-2026-10", ambPairs[0]!.id, "LED-06", MOCK_USERS.maker, "Khớp hóa đơn KH An Phú");
    service.confirmManualMatch("REC-2026-10", ambPairs[1]!.id, "LED-07", MOCK_USERS.maker, "Khớp hóa đơn KH Bình Minh");

    const resolvedReport = service.getReport("REC-2026-10")!;

    // Kiểm tra các khoản chênh lệch phát hiện
    const feeItem = resolvedReport.discrepancies.find((d) => d.type === "BANK_FEE_NOT_RECORDED");
    assert.ok(feeItem, "Phải phát hiện phí ngân hàng chưa ghi sổ");
    assert.equal(feeItem!.amount, 110_000n);
    assert.equal(feeItem!.suggestedAccountingEntry?.debitAccount, "6427");
    assert.equal(feeItem!.suggestedAccountingEntry?.creditAccount, "1121");

    const interestItem = resolvedReport.discrepancies.find((d) => d.type === "INTEREST_NOT_RECORDED");
    assert.ok(interestItem, "Phải phát hiện lãi tiền gửi chưa ghi sổ");
    assert.equal(interestItem!.amount, 850_000n);
    assert.equal(interestItem!.suggestedAccountingEntry?.debitAccount, "1121");
    assert.equal(interestItem!.suggestedAccountingEntry?.creditAccount, "515");

    const inTransitItem = resolvedReport.discrepancies.find((d) => d.type === "DEPOSIT_IN_TRANSIT");
    assert.ok(inTransitItem, "Phải phát hiện tiền đang chuyển cuối kỳ");
    assert.equal(inTransitItem!.amount, 35_000_000n);

    const outstandingItem = resolvedReport.discrepancies.find((d) => d.type === "OUTSTANDING_CHECK_OR_UNC");
    assert.ok(outstandingItem, "Phải phát hiện UNC chưa thanh toán");
    assert.equal(outstandingItem!.amount, 50_000_000n);

    // Kiểm tra Bảng Cân đối Điều chỉnh (Reconciliation Statement)
    // Dư NH điều chỉnh: 579.740.000 + 35.000.000 - 50.000.000 = 564.740.000 VND
    assert.equal(resolvedReport.summary.adjustedBankBalance, 564_740_000n);
    // Dư Sổ điều chỉnh: 564.000.000 + 850.000 - 110.000 = 564.740.000 VND
    assert.equal(resolvedReport.summary.adjustedLedgerBalance, 564_740_000n);

    // Sai lệch cuối cùng phải bằng 0 tuyệt đối
    assert.equal(resolvedReport.summary.variance, 0n);
    assert.equal(resolvedReport.summary.isBalanced, true);
  });

  it("Chặn trình duyệt khi còn giao dịch AMBIGUOUS chưa được xác nhận", () => {
    const service = new ReconciliationService();
    service.createReconciliationSession({
      reportId: "REC-2026-10",
      period: "2026-10",
      bankAccount: "0071001234567",
      openingBalanceBank: MOCK_OPENING_BALANCES.bank,
      closingBalanceBank: MOCK_CLOSING_BALANCES.bank,
      openingBalanceLedger: MOCK_OPENING_BALANCES.ledger,
      closingBalanceLedger: MOCK_CLOSING_BALANCES.ledger,
      bankTransactions: MOCK_BANK_TRANSACTIONS,
      ledgerEntries: MOCK_LEDGER_ENTRIES,
      actor: MOCK_USERS.maker,
    });

    service.runAutoMatching("REC-2026-10", MOCK_USERS.maker);

    // Trình duyệt ngay khi còn ambiguous -> Bị từ chối
    assert.throws(
      () => service.submitForApproval("REC-2026-10", MOCK_USERS.maker),
      (err: unknown) => {
        return (
          err instanceof ReconciliationError &&
          err.code === "UNRESOLVED_AMBIGUITY"
        );
      }
    );
  });

  it("Thực thi Nguyên tắc Bốn mắt (Four-Eyes Principle): Maker không được tự phê duyệt", () => {
    const service = new ReconciliationService();
    service.createReconciliationSession({
      reportId: "REC-2026-10",
      period: "2026-10",
      bankAccount: "0071001234567",
      openingBalanceBank: MOCK_OPENING_BALANCES.bank,
      closingBalanceBank: MOCK_CLOSING_BALANCES.bank,
      openingBalanceLedger: MOCK_OPENING_BALANCES.ledger,
      closingBalanceLedger: MOCK_CLOSING_BALANCES.ledger,
      bankTransactions: MOCK_BANK_TRANSACTIONS,
      ledgerEntries: MOCK_LEDGER_ENTRIES,
      actor: MOCK_USERS.maker,
    });

    service.runAutoMatching("REC-2026-10", MOCK_USERS.maker);

    // Gỡ các mục ambiguous bằng xác nhận thủ công
    const reportBefore = service.getReport("REC-2026-10")!;
    const ambList = reportBefore.matchedPairs.filter((p) => p.status === "AMBIGUOUS");
    service.confirmManualMatch("REC-2026-10", ambList[0]!.id, "LED-06", MOCK_USERS.maker, "Hóa đơn An Phú");
    service.confirmManualMatch("REC-2026-10", ambList[1]!.id, "LED-07", MOCK_USERS.maker, "Hóa đơn Bình Minh");

    // Trình duyệt hợp lệ
    service.submitForApproval("REC-2026-10", MOCK_USERS.maker);
    assert.equal(service.getReport("REC-2026-10")!.status, "SUBMITTED");

    // Người lập (Maker) cố tình tự duyệt -> BỊ TỪ CHỐI
    assert.throws(
      () => service.approveReconciliation("REC-2026-10", MOCK_USERS.maker),
      (err: unknown) => {
        return (
          err instanceof ReconciliationError &&
          err.code === "PERMISSION_DENIED" // Maker không có role CHECKER
        );
      }
    );

    // Kế toán trưởng (Checker) phê duyệt -> THÀNH CÔNG
    const approvedReport = service.approveReconciliation("REC-2026-10", MOCK_USERS.checker);
    assert.equal(approvedReport.status, "APPROVED");
    assert.equal(approvedReport.approvedBy, MOCK_USERS.checker.id);
    assert.ok(approvedReport.approvedAt);
  });

  it("Khóa kỳ (Period Lock) và ngăn chặn mọi sửa đổi trái phép sau khi khóa", () => {
    const service = new ReconciliationService();
    service.createReconciliationSession({
      reportId: "REC-2026-10",
      period: "2026-10",
      bankAccount: "0071001234567",
      openingBalanceBank: MOCK_OPENING_BALANCES.bank,
      closingBalanceBank: MOCK_CLOSING_BALANCES.bank,
      openingBalanceLedger: MOCK_OPENING_BALANCES.ledger,
      closingBalanceLedger: MOCK_CLOSING_BALANCES.ledger,
      bankTransactions: MOCK_BANK_TRANSACTIONS,
      ledgerEntries: MOCK_LEDGER_ENTRIES,
      actor: MOCK_USERS.maker,
    });

    service.runAutoMatching("REC-2026-10", MOCK_USERS.maker);
    const r = service.getReport("REC-2026-10")!;
    const ambs = r.matchedPairs.filter((p) => p.status === "AMBIGUOUS");
    service.confirmManualMatch("REC-2026-10", ambs[0]!.id, "LED-06", MOCK_USERS.maker, "Hóa đơn An Phú");
    service.confirmManualMatch("REC-2026-10", ambs[1]!.id, "LED-07", MOCK_USERS.maker, "Hóa đơn Bình Minh");

    service.submitForApproval("REC-2026-10", MOCK_USERS.maker);
    service.approveReconciliation("REC-2026-10", MOCK_USERS.checker);

    // 1. Khóa kỳ thành công bởi CHECKER
    const lockedReport = service.lockPeriod("REC-2026-10", MOCK_USERS.checker);
    assert.equal(lockedReport.status, "LOCKED");

    // 2. Thử chạy lại matching trên kỳ đã khóa -> Bị từ chối
    assert.throws(
      () => service.runAutoMatching("REC-2026-10", MOCK_USERS.maker),
      (err: unknown) => {
        return (
          err instanceof ReconciliationError &&
          err.code === "PERIOD_LOCKED"
        );
      }
    );

    // 3. Thử chỉnh sửa manual match trên kỳ đã khóa -> Bị từ chối
    assert.throws(
      () => service.confirmManualMatch("REC-2026-10", "MATCH-0001", "LED-06", MOCK_USERS.maker, "Chỉnh sửa sau khóa"),
      (err: unknown) => {
        return (
          err instanceof ReconciliationError &&
          err.code === "PERIOD_LOCKED"
        );
      }
    );

    // 4. Kiểm tra đầy đủ dấu vết kiểm toán (Audit Trail)
    const auditActions = lockedReport.auditHistory.map((a) => a.action);
    assert.ok(auditActions.includes("IMPORT_DATA"));
    assert.ok(auditActions.includes("RUN_MATCHING"));
    assert.ok(auditActions.includes("CONFIRM_MANUAL_MATCH"));
    assert.ok(auditActions.includes("SUBMIT_RECONCILIATION"));
    assert.ok(auditActions.includes("APPROVE_RECONCILIATION"));
    assert.ok(auditActions.includes("LOCK_PERIOD"));
  });
});
