/**
 * reconciliation-service.ts
 *
 * Dịch vụ Quản lý Quy trình Đối soát Ngân hàng & Phân quyền Duyệt (Four-Eyes Principle).
 *
 * Tuân thủ bất biến từ skill vn-finance-app-builder:
 * - Tách biệt vai trò: Người lập (MAKER) KHÔNG được tự duyệt (CHECKER).
 * - Bất biến khóa kỳ: Kỳ đã LOCKED cấm mọi thao tác sửa đổi.
 * - Sửa sau khi duyệt làm mất hiệu lực phê duyệt, quay lại trạng thái DRAFT.
 * - Toàn bộ thao tác đều ghi Audit Log có danh tính, thời điểm, hành động và lý do.
 */

import { analyzeDiscrepancies } from "./discrepancy-service.js";
import { runReconciliationMatching } from "./matching-engine.js";
import type {
  AuditEvent,
  BankTransaction,
  LedgerEntry,
  ReconciliationReport,
  User,
} from "./types.js";

export class ReconciliationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ReconciliationError";
  }
}

export class ReconciliationService {
  private reports = new Map<string, ReconciliationReport>();
  private bankTxsStore = new Map<string, BankTransaction[]>(); // reportId -> bank transactions
  private ledgerEntriesStore = new Map<string, LedgerEntry[]>(); // reportId -> ledger entries

  /** Tạo một kỳ đối soát mới (Chỉ dành cho MAKER hoặc CHECKER) */
  public createReconciliationSession(params: {
    reportId: string;
    period: string;
    bankAccount: string;
    currency?: "VND" | "USD";
    openingBalanceBank: bigint;
    closingBalanceBank: bigint;
    openingBalanceLedger: bigint;
    closingBalanceLedger: bigint;
    bankTransactions: BankTransaction[];
    ledgerEntries: LedgerEntry[];
    actor: User;
  }): ReconciliationReport {
    const { actor, reportId } = params;

    if (actor.role === "AUDITOR") {
      throw new ReconciliationError(
        "PERMISSION_DENIED",
        "Vai trò AUDITOR chỉ có quyền xem, không được tạo phiên đối soát."
      );
    }

    if (this.reports.has(reportId)) {
      throw new ReconciliationError(
        "ALREADY_EXISTS",
        `Phiên đối soát ${reportId} đã tồn tại trong hệ thống.`
      );
    }

    const auditHistory: AuditEvent[] = [
      {
        id: `AUDIT-${Date.now()}-01`,
        timestamp: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: "IMPORT_DATA",
        targetId: reportId,
        details: `Khởi tạo phiên đối soát kỳ ${params.period} cho TK ${params.bankAccount} với ${params.bankTransactions.length} GD ngân hàng và ${params.ledgerEntries.length} bút toán sổ cái.`,
      },
    ];

    const report: ReconciliationReport = {
      id: reportId,
      period: params.period,
      bankAccount: params.bankAccount,
      currency: params.currency ?? "VND",
      status: "DRAFT",
      createdBy: actor.id,
      openingBalanceBank: params.openingBalanceBank,
      closingBalanceBank: params.closingBalanceBank,
      openingBalanceLedger: params.openingBalanceLedger,
      closingBalanceLedger: params.closingBalanceLedger,
      totalBankTransactions: params.bankTransactions.length,
      totalLedgerEntries: params.ledgerEntries.length,
      matchedPairs: [],
      discrepancies: [],
      summary: {
        adjustedBankBalance: params.closingBalanceBank,
        adjustedLedgerBalance: params.closingBalanceLedger,
        isBalanced: false,
        variance: params.closingBalanceBank - params.closingBalanceLedger,
      },
      auditHistory,
    };

    this.reports.set(reportId, report);
    this.bankTxsStore.set(reportId, [...params.bankTransactions]);
    this.ledgerEntriesStore.set(reportId, [...params.ledgerEntries]);

    return report;
  }

  /** Chạy engine so khớp tự động và tính bảng chênh lệch */
  public runAutoMatching(reportId: string, actor: User): ReconciliationReport {
    const report = this.getReportOrThrow(reportId);
    this.assertNotLocked(report);

    if (report.status === "APPROVED") {
      // Sửa sau khi duyệt làm mất hiệu lực phê duyệt
      report.status = "DRAFT";
      report.approvedBy = undefined;
      report.approvedAt = undefined;
    }

    const bankTxs = this.bankTxsStore.get(reportId) ?? [];
    const ledgerEntries = this.ledgerEntriesStore.get(reportId) ?? [];

    const matchResult = runReconciliationMatching(bankTxs, ledgerEntries);

    const unmatchedBank = bankTxs.filter((b) =>
      matchResult.unmatchedBankTxIds.includes(b.id)
    );
    const unmatchedLedger = ledgerEntries.filter((l) =>
      matchResult.unmatchedLedgerEntryIds.includes(l.id)
    );

    const analysis = analyzeDiscrepancies({
      closingBalanceBank: report.closingBalanceBank,
      closingBalanceLedger: report.closingBalanceLedger,
      unmatchedBankTxs: unmatchedBank,
      unmatchedLedgerEntries: unmatchedLedger,
    });

    report.matchedPairs = [...matchResult.matchedPairs, ...matchResult.ambiguousPairs];
    report.discrepancies = analysis.discrepancies;
    report.summary = {
      adjustedBankBalance: analysis.summary.adjustedBankBalance,
      adjustedLedgerBalance: analysis.summary.adjustedLedgerBalance,
      isBalanced: analysis.summary.isBalanced,
      variance: analysis.summary.variance,
    };

    report.auditHistory.push({
      id: `AUDIT-${Date.now()}-RUN`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "RUN_MATCHING",
      targetId: reportId,
      details: `Chạy đối soát tự động: Khớp ${matchResult.matchedPairs.length} cặp, Mơ hồ ${matchResult.ambiguousPairs.length}, Chênh lệch ${analysis.discrepancies.length} mục. Cân đối: ${analysis.summary.isBalanced ? "ĐẠT" : "LỆCH"}.`,
    });

    return report;
  }

  /** Kế toán xác nhận cặp ghép thủ công (ví dụ gỡ ambiguous) */
  public confirmManualMatch(
    reportId: string,
    pairId: string,
    selectedLedgerEntryId: string,
    actor: User,
    reason: string
  ): ReconciliationReport {
    const report = this.getReportOrThrow(reportId);
    this.assertNotLocked(report);

    const pair = report.matchedPairs.find((p) => p.id === pairId);
    if (!pair) {
      throw new ReconciliationError("NOT_FOUND", `Không tìm thấy cặp khớp ${pairId}`);
    }

    if (!pair.ledgerEntryIds.includes(selectedLedgerEntryId)) {
      throw new ReconciliationError(
        "INVALID_SELECTION",
        `Bút toán ${selectedLedgerEntryId} không nằm trong danh sách ứng viên của cặp ${pairId}`
      );
    }

    // Thu hẹp về đúng 1 bút toán đã chọn
    pair.ledgerEntryIds = [selectedLedgerEntryId];
    pair.status = "RULE_MATCH";
    pair.requiresReview = false;
    pair.confidence = 1.0;
    pair.explanation += ` | Đã xác nhận thủ công bút toán ${selectedLedgerEntryId} bởi ${actor.name} (${actor.role}): ${reason}`;

    // Tự động tính toán lại chênh lệch và số dư điều chỉnh sau khi gỡ ambiguous
    this.refreshReportCalculations(report);

    report.auditHistory.push({
      id: `AUDIT-${Date.now()}-MANUAL`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "CONFIRM_MANUAL_MATCH",
      targetId: pairId,
      details: `Xác nhận ghép thủ công cặp ${pairId} với bút toán ${selectedLedgerEntryId}. Lý do: ${reason}`,
    });

    return report;
  }

  /** Tính toán lại các giao dịch chưa khớp, chênh lệch và số dư điều chỉnh */
  private refreshReportCalculations(report: ReconciliationReport): void {
    const bankTxs = this.bankTxsStore.get(report.id) ?? [];
    const ledgerEntries = this.ledgerEntriesStore.get(report.id) ?? [];

    const officiallyMatchedBankIds = new Set<string>();
    const officiallyMatchedLedgerIds = new Set<string>();

    for (const p of report.matchedPairs) {
      if (p.status !== "AMBIGUOUS") {
        for (const bId of p.bankTxIds) officiallyMatchedBankIds.add(bId);
        for (const lId of p.ledgerEntryIds) officiallyMatchedLedgerIds.add(lId);
      }
    }

    const unmatchedBank = bankTxs.filter((b) => !officiallyMatchedBankIds.has(b.id));
    const unmatchedLedger = ledgerEntries.filter((l) => !officiallyMatchedLedgerIds.has(l.id));

    const analysis = analyzeDiscrepancies({
      closingBalanceBank: report.closingBalanceBank,
      closingBalanceLedger: report.closingBalanceLedger,
      unmatchedBankTxs: unmatchedBank,
      unmatchedLedgerEntries: unmatchedLedger,
    });

    report.discrepancies = analysis.discrepancies;
    report.summary = {
      adjustedBankBalance: analysis.summary.adjustedBankBalance,
      adjustedLedgerBalance: analysis.summary.adjustedLedgerBalance,
      isBalanced: analysis.summary.isBalanced,
      variance: analysis.summary.variance,
    };
  }

  /** Trình báo cáo đối soát lên cấp phê duyệt */
  public submitForApproval(reportId: string, actor: User): ReconciliationReport {
    const report = this.getReportOrThrow(reportId);
    this.assertNotLocked(report);

    if (report.status !== "DRAFT" && report.status !== "REJECTED") {
      throw new ReconciliationError(
        "INVALID_STATE",
        `Chỉ có thể trình duyệt từ trạng thái DRAFT hoặc REJECTED (hiện tại: ${report.status})`
      );
    }

    // Kiểm tra còn mục mơ hồ chưa giải quyết không
    const unresolvedAmbiguous = report.matchedPairs.filter(
      (p) => p.status === "AMBIGUOUS" && p.requiresReview
    );
    if (unresolvedAmbiguous.length > 0) {
      throw new ReconciliationError(
        "UNRESOLVED_AMBIGUITY",
        `Không thể trình duyệt khi còn ${unresolvedAmbiguous.length} giao dịch mơ hồ chưa được xác nhận.`
      );
    }

    report.status = "SUBMITTED";
    report.auditHistory.push({
      id: `AUDIT-${Date.now()}-SUBMIT`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "SUBMIT_RECONCILIATION",
      targetId: reportId,
      details: `Trình báo cáo đối soát kỳ ${report.period} lên Kế toán trưởng duyệt. Chênh lệch còn lại: ${report.summary.variance} VND.`,
    });

    return report;
  }

  /**
   * Phê duyệt Báo cáo Đối soát (Dual-control / Four-eyes principle)
   * BẮT BUỘC:
   * 1. Phải có role CHECKER.
   * 2. Người duyệt (actor.id) KHÔNG ĐƯỢC trùng với người lập (report.createdBy).
   */
  public approveReconciliation(reportId: string, actor: User): ReconciliationReport {
    const report = this.getReportOrThrow(reportId);
    this.assertNotLocked(report);

    if (actor.role !== "CHECKER") {
      throw new ReconciliationError(
        "PERMISSION_DENIED",
        `Chỉ Kế toán trưởng / Người phê duyệt (CHECKER) mới có quyền duyệt báo cáo đối soát. Role hiện tại: ${actor.role}.`
      );
    }

    // Bất biến: Người lập tự duyệt khi chính sách cấm -> Server từ chối
    if (actor.id === report.createdBy) {
      throw new ReconciliationError(
        "SELF_APPROVAL_FORBIDDEN",
        `Vi phạm nguyên tắc Bốn mắt (Four-Eyes Principle): Người lập báo cáo (${actor.name}) không được tự phê duyệt báo cáo của chính mình.`
      );
    }

    if (report.status !== "SUBMITTED") {
      throw new ReconciliationError(
        "INVALID_STATE",
        `Báo cáo phải ở trạng thái SUBMITTED mới được duyệt (hiện tại: ${report.status}).`
      );
    }

    if (!report.summary.isBalanced) {
      throw new ReconciliationError(
        "NOT_BALANCED",
        `Báo cáo đối soát chưa cân đối số học (Chênh lệch: ${report.summary.variance} VND). Không thể phê duyệt.`
      );
    }

    report.status = "APPROVED";
    report.approvedBy = actor.id;
    report.approvedAt = new Date().toISOString();
    report.rejectionReason = undefined;

    report.auditHistory.push({
      id: `AUDIT-${Date.now()}-APPROVE`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "APPROVE_RECONCILIATION",
      targetId: reportId,
      details: `Kế toán trưởng (${actor.name}) đã phê duyệt báo cáo đối soát kỳ ${report.period}.`,
    });

    return report;
  }

  /** Từ chối báo cáo đối soát */
  public rejectReconciliation(
    reportId: string,
    actor: User,
    reason: string
  ): ReconciliationReport {
    const report = this.getReportOrThrow(reportId);
    this.assertNotLocked(report);

    if (actor.role !== "CHECKER") {
      throw new ReconciliationError(
        "PERMISSION_DENIED",
        "Chỉ CHECKER mới có quyền từ chối báo cáo đối soát."
      );
    }

    report.status = "REJECTED";
    report.rejectionReason = reason;

    report.auditHistory.push({
      id: `AUDIT-${Date.now()}-REJECT`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "REJECT_RECONCILIATION",
      targetId: reportId,
      details: `Kế toán trưởng từ chối báo cáo. Lý do: ${reason}`,
    });

    return report;
  }

  /**
   * Khóa kỳ kế toán (Lock Period)
   * Sau khi khóa, cấm hoàn toàn mọi thay đổi dữ liệu hoặc trạng thái.
   */
  public lockPeriod(reportId: string, actor: User): ReconciliationReport {
    const report = this.getReportOrThrow(reportId);

    if (actor.role !== "CHECKER") {
      throw new ReconciliationError(
        "PERMISSION_DENIED",
        "Chỉ Kế toán trưởng (CHECKER) mới có quyền khóa kỳ đối soát."
      );
    }

    if (report.status !== "APPROVED") {
      throw new ReconciliationError(
        "INVALID_STATE",
        `Chỉ có thể khóa kỳ khi báo cáo đối soát đã được APPROVED (hiện tại: ${report.status}).`
      );
    }

    report.status = "LOCKED";
    report.auditHistory.push({
      id: `AUDIT-${Date.now()}-LOCK`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "LOCK_PERIOD",
      targetId: reportId,
      details: `Kỳ kế toán ${report.period} cho TK ${report.bankAccount} đã được KHÓA SỔ chính thức. Không thể sửa đổi.`,
    });

    return report;
  }

  public getReport(reportId: string): ReconciliationReport | undefined {
    return this.reports.get(reportId);
  }

  private getReportOrThrow(reportId: string): ReconciliationReport {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new ReconciliationError("NOT_FOUND", `Không tìm thấy báo cáo ${reportId}`);
    }
    return report;
  }

  private assertNotLocked(report: ReconciliationReport): void {
    if (report.status === "LOCKED") {
      throw new ReconciliationError(
        "PERIOD_LOCKED",
        `Kỳ đối soát ${report.period} đã bị KHÓA SỔ. Mọi hành vi sửa đổi dữ liệu hoặc thay đổi trạng thái đều bị máy chủ từ chối.`
      );
    }
  }
}
