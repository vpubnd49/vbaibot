/**
 * types.ts
 *
 * Định nghĩa hệ thống kiểu dữ liệu cho Ứng dụng Đối soát Sao kê Ngân hàng & Sổ Kế toán.
 * Thiết kế tuân thủ:
 * - vn-finance-app-builder: Dùng string/BigInt cho số tiền (tránh floating-point), RBAC, Audit Trail, Idempotency.
 * - vn-accounting (TT 200/TT 133): Tài khoản 112, đối chiếu số dư, xử lý chênh lệch (phí, lãi, tiền đang chuyển).
 */

export type Currency = "VND" | "USD";

export type Role = "MAKER" | "CHECKER" | "AUDITOR";

export interface User {
  id: string;
  name: string;
  role: Role;
  department: string;
}

/**
 * Giao dịch từ Sao kê Ngân hàng (Bank Statement)
 * Lưu ý theo thông lệ ngân hàng:
 * - CREDIT (Có): Tiền vào tài khoản ngân hàng (tiền tăng).
 * - DEBIT (Nợ): Tiền ra khỏi tài khoản ngân hàng (tiền giảm: thanh toán, phí).
 */
export type BankTxType = "CREDIT" | "DEBIT";

export interface BankTransaction {
  id: string;
  bankAccount: string;
  bankName: string;
  transactionDate: string; // YYYY-MM-DD
  valueDate: string;       // Ngày giá trị
  txType: BankTxType;
  amount: bigint;          // Đơn vị VND (số nguyên tuyệt đối)
  currency: Currency;
  referenceNumber: string; // Mã giao dịch ngân hàng (FT, Ref ID)
  description: string;     // Diễn giải / Nội dung chuyển khoản
  counterpartyAccount?: string; // Tài khoản đối ứng
  counterpartyName?: string;    // Tên người gửi/nhận
}

/**
 * Bút toán từ Sổ Kế toán Tiền gửi Ngân hàng (General Ledger - TK 112)
 * Theo chuẩn kế toán Việt Nam:
 * - DEBIT (Nợ TK 112): Tăng tiền gửi ngân hàng (thu tiền bán hàng, thu nợ...).
 * - CREDIT (Có TK 112): Giảm tiền gửi ngân hàng (chi trả NCC, nộp thuế...).
 */
export type LedgerTxType = "DEBIT" | "CREDIT";

export interface LedgerEntry {
  id: string;
  voucherNumber: string;   // Số chứng từ (BC, BN, UNC, PKT)
  voucherDate: string;     // Ngày chứng từ
  postingDate: string;     // Ngày ghi sổ
  accountNumber: "1121" | "1122" | string; // TK hạch toán
  correspondingAccount: string; // TK đối ứng (131, 331, 642, 515, 333...)
  txType: LedgerTxType;
  amount: bigint;          // Số tiền VND (tuyệt đối)
  currency: Currency;
  description: string;     // Diễn giải trên sổ cái
  partnerName?: string;    // Tên đối tượng (KH, NCC, NV)
  partnerCode?: string;    // Mã đối tượng
}

export type MatchStatus =
  | "EXACT_MATCH"        // Khớp 1:1 chính xác (Số tiền + Mã tham chiếu + Ngày)
  | "RULE_MATCH"         // Khớp 1:1 theo quy tắc (Số tiền + Ngày gần + Nội dung đối tác)
  | "BATCH_MATCH"        // Khớp 1-Nhiều hoặc Nhiều-1 (Gộp lệnh, tổng tiền bằng nhau)
  | "AMBIGUOUS"          // Trùng số tiền nhưng thiếu căn cứ xác định (cần con người xử lý)
  | "UNMATCHED_BANK"     // Có trong sao kê nhưng chưa có trên sổ cái
  | "UNMATCHED_LEDGER";   // Đã vào sổ cái nhưng chưa có trên sao kê

export interface MatchedPair {
  id: string;
  status: MatchStatus;
  bankTxIds: string[];
  ledgerEntryIds: string[];
  matchedAmount: bigint;
  confidence: number;      // 0.0 - 1.0 (1.0 = exact match)
  ruleUsed: string;
  explanation: string;
  requiresReview: boolean;
}

export type DiscrepancyType =
  | "BANK_FEE_NOT_RECORDED"        // Phí ngân hàng chưa hạch toán (Ngân hàng trừ, sổ chưa có)
  | "INTEREST_NOT_RECORDED"        // Lãi tiền gửi chưa hạch toán (Ngân hàng cộng, sổ chưa có)
  | "DEPOSIT_IN_TRANSIT"           // Tiền đang chuyển / nộp tiền chờ nổi (Sổ đã ghi Nợ 112, NH chưa Có)
  | "OUTSTANDING_CHECK_OR_UNC"     // UNC/Séc chưa thực hiện (Sổ đã ghi Có 112, NH chưa Nợ)
  | "AMOUNT_MISMATCH"              // Chênh lệch số tiền giữa sổ và sao kê
  | "UNKNOWN_DIFFERENCE";          // Khoản thu/chi lạ chưa rõ nguyên nhân

export interface DiscrepancyItem {
  id: string;
  type: DiscrepancyType;
  source: "BANK_ONLY" | "LEDGER_ONLY" | "AMOUNT_DIFF";
  bankTxId?: string;
  ledgerEntryId?: string;
  amount: bigint;
  currency: Currency;
  description: string;
  suggestedAccountingEntry?: {
    debitAccount: string;
    creditAccount: string;
    suggestedAmount: bigint;
    note: string;
  };
}

export type ReconciliationStatus =
  | "DRAFT"               // Kế toán viên (Maker) đang chuẩn bị/đối soát
  | "SUBMITTED"           // Đã gửi Kế toán trưởng (Checker) soát xét
  | "APPROVED"            // Kế toán trưởng đã duyệt
  | "REJECTED"            // Kế toán trưởng từ chối, yêu cầu chỉnh sửa
  | "LOCKED";             // Đã khóa sổ kỳ đối soát, cấm sửa đổi

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action:
    | "IMPORT_DATA"
    | "RUN_MATCHING"
    | "CONFIRM_MANUAL_MATCH"
    | "SUBMIT_RECONCILIATION"
    | "APPROVE_RECONCILIATION"
    | "REJECT_RECONCILIATION"
    | "LOCK_PERIOD";
  targetId: string;
  details: string;
  payloadHash?: string;
}

export interface ReconciliationReport {
  id: string;
  period: string; // VD: "2026-10"
  bankAccount: string;
  currency: Currency;
  status: ReconciliationStatus;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  
  // Tổng hợp số dư theo thông lệ kế toán
  openingBalanceBank: bigint;
  closingBalanceBank: bigint;
  openingBalanceLedger: bigint;
  closingBalanceLedger: bigint;
  
  // Kết quả đối soát
  totalBankTransactions: number;
  totalLedgerEntries: number;
  matchedPairs: MatchedPair[];
  discrepancies: DiscrepancyItem[];
  
  // Bảng cân đối giải trình (Bank Reconciliation Statement)
  summary: {
    adjustedBankBalance: bigint;   // Số dư NH điều chỉnh = Dư NH + Tiền đang chuyển - UNC chưa rút
    adjustedLedgerBalance: bigint; // Số dư Sổ điều chỉnh = Dư Sổ + Lãi chưa hạch toán - Phí chưa hạch toán
    isBalanced: boolean;           // adjustedBankBalance === adjustedLedgerBalance
    variance: bigint;              // Chênh lệch còn lại
  };
  
  auditHistory: AuditEvent[];
}
