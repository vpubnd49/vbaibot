/**
 * discrepancy-service.ts
 *
 * Xử lý và phân loại chênh lệch đối soát ngân hàng theo chuẩn Kế toán Việt Nam (TT 200/2014/TT-BTC).
 *
 * Nguyên tắc kế toán:
 * 1. Số dư Ngân hàng điều chỉnh:
 *    = Số dư cuối kỳ theo Sao kê
 *    + Tiền đang chuyển / Nộp tiền chờ nổi (Deposits in transit)
 *    - Séc / Ủy nhiệm chi chưa thanh toán (Outstanding checks / disbursements)
 *
 * 2. Số dư Sổ kế toán điều chỉnh:
 *    = Số dư cuối kỳ theo Sổ cái TK 1121
 *    + Lãi tiền gửi chưa vào sổ (Nợ 1121 / Có 515)
 *    - Phí dịch vụ ngân hàng chưa vào sổ (Nợ 642 / Có 1121)
 *    ± Các bút toán điều chỉnh nhầm lẫn/treo làm rõ
 *
 * 3. Khi Số dư NH điều chỉnh === Số dư Sổ điều chỉnh -> Bảng đối soát cân đối hoàn toàn (Variance = 0).
 */

import type {
  BankTransaction,
  DiscrepancyItem,
  LedgerEntry,
} from "./types.js";

const BANK_FEE_KEYWORDS = [
  "phi dich vu",
  "phi duy tri",
  "phi chuyen tien",
  "phi quan ly",
  "phi sms",
  "phi thuong nien",
  "phi ngan hang",
  "fee",
];

const INTEREST_KEYWORDS = [
  "lai tien gui",
  "tra lai",
  "lai nhap goc",
  "interest",
  "tien lai",
];

function containsAnyKeyword(text: string, keywords: string[]): boolean {
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return keywords.some((k) => norm.includes(k));
}

export interface DiscrepancyAnalysisResult {
  discrepancies: DiscrepancyItem[];
  summary: {
    adjustedBankBalance: bigint;
    adjustedLedgerBalance: bigint;
    isBalanced: boolean;
    variance: bigint;
    depositsInTransitTotal: bigint;
    outstandingDisbursementsTotal: bigint;
    unrecordedInterestTotal: bigint;
    unrecordedFeesTotal: bigint;
  };
}

export function analyzeDiscrepancies(params: {
  closingBalanceBank: bigint;
  closingBalanceLedger: bigint;
  unmatchedBankTxs: BankTransaction[];
  unmatchedLedgerEntries: LedgerEntry[];
}): DiscrepancyAnalysisResult {
  const { closingBalanceBank, closingBalanceLedger, unmatchedBankTxs, unmatchedLedgerEntries } = params;
  const discrepancies: DiscrepancyItem[] = [];

  let depositsInTransitTotal = 0n;
  let outstandingDisbursementsTotal = 0n;
  let unrecordedInterestTotal = 0n;
  let unrecordedFeesTotal = 0n;

  let counter = 1;
  const nextDiscId = () => `DISC-${String(counter++).padStart(4, "0")}`;

  // 1. Phân tích các giao dịch trên SAO KÊ mà SỔ CÁI CHƯA CÓ
  for (const bTx of unmatchedBankTxs) {
    if (bTx.txType === "DEBIT" && containsAnyKeyword(bTx.description, BANK_FEE_KEYWORDS)) {
      // Phí ngân hàng trừ tự động nhưng kế toán chưa lấy sổ phụ hạch toán
      unrecordedFeesTotal += bTx.amount;
      discrepancies.push({
        id: nextDiscId(),
        type: "BANK_FEE_NOT_RECORDED",
        source: "BANK_ONLY",
        bankTxId: bTx.id,
        amount: bTx.amount,
        currency: bTx.currency,
        description: `Phí ngân hàng trừ tự động chưa hạch toán vào sổ cái: ${bTx.description}`,
        suggestedAccountingEntry: {
          debitAccount: "6427", // Chi phí dịch vụ mua ngoài (TT 200) hoặc 6422 (TT 133)
          creditAccount: "1121", // Giảm tiền gửi ngân hàng
          suggestedAmount: bTx.amount,
          note: `Hạch toán bổ sung theo sao kê GD #${bTx.referenceNumber}`,
        },
      });
    } else if (bTx.txType === "CREDIT" && containsAnyKeyword(bTx.description, INTEREST_KEYWORDS)) {
      // Lãi tiền gửi ngân hàng kết chuyển cuối tháng
      unrecordedInterestTotal += bTx.amount;
      discrepancies.push({
        id: nextDiscId(),
        type: "INTEREST_NOT_RECORDED",
        source: "BANK_ONLY",
        bankTxId: bTx.id,
        amount: bTx.amount,
        currency: bTx.currency,
        description: `Lãi tiền gửi ngân hàng cộng vào tài khoản chưa hạch toán: ${bTx.description}`,
        suggestedAccountingEntry: {
          debitAccount: "1121", // Tăng tiền gửi ngân hàng
          creditAccount: "515",  // Doanh thu hoạt động tài chính
          suggestedAmount: bTx.amount,
          note: `Hạch toán lãi tiền gửi định kỳ theo sao kê GD #${bTx.referenceNumber}`,
        },
      });
    } else {
      // Khoản thu/chi lạ trên ngân hàng
      discrepancies.push({
        id: nextDiscId(),
        type: "UNKNOWN_DIFFERENCE",
        source: "BANK_ONLY",
        bankTxId: bTx.id,
        amount: bTx.amount,
        currency: bTx.currency,
        description: `Giao dịch trên sao kê chưa rõ nguyên nhân, chưa có chứng từ kế toán: ${bTx.description}`,
        suggestedAccountingEntry: {
          debitAccount: bTx.txType === "CREDIT" ? "1121" : "1388",
          creditAccount: bTx.txType === "CREDIT" ? "3388" : "1121",
          suggestedAmount: bTx.amount,
          note: "Tạm treo khoản chờ xác minh với đối tác/ngân hàng, không tự ý cấn trừ",
        },
      });
    }
  }

  // 2. Phân tích các bút toán trên SỔ CÁI mà SAO KÊ CHƯA CÓ
  for (const lEntry of unmatchedLedgerEntries) {
    if (lEntry.txType === "DEBIT") {
      // Sổ ghi Nợ 1121 (Tăng tiền) nhưng NH chưa Có -> Tiền đang chuyển (Deposits in transit)
      depositsInTransitTotal += lEntry.amount;
      discrepancies.push({
        id: nextDiscId(),
        type: "DEPOSIT_IN_TRANSIT",
        source: "LEDGER_ONLY",
        ledgerEntryId: lEntry.id,
        amount: lEntry.amount,
        currency: lEntry.currency,
        description: `Tiền đang gửi/chuyển cuối kỳ: CT #${lEntry.voucherNumber} (${lEntry.description})`,
        suggestedAccountingEntry: undefined, // Không cần điều chỉnh sổ, chờ ngân hàng hạch toán vào kỳ tới
      });
    } else {
      // Sổ ghi Có 1121 (Giảm tiền) nhưng NH chưa Nợ -> Ủy nhiệm chi/Séc chưa thanh toán (Outstanding checks)
      outstandingDisbursementsTotal += lEntry.amount;
      discrepancies.push({
        id: nextDiscId(),
        type: "OUTSTANDING_CHECK_OR_UNC",
        source: "LEDGER_ONLY",
        ledgerEntryId: lEntry.id,
        amount: lEntry.amount,
        currency: lEntry.currency,
        description: `Ủy nhiệm chi đã lập sổ nhưng ngân hàng chưa trích nợ: CT #${lEntry.voucherNumber} (${lEntry.description})`,
        suggestedAccountingEntry: undefined, // Không cần điều chỉnh sổ, theo dõi ngày trừ tiền của ngân hàng
      });
    }
  }

  // 3. TÍNH TOÁN BẢNG CÂN ĐỐI ĐIỀU CHỈNH (Reconciliation Statement)
  // Số dư Ngân hàng điều chỉnh = Dư NH + Tiền đang chuyển - UNC chưa rút
  const adjustedBankBalance =
    closingBalanceBank + depositsInTransitTotal - outstandingDisbursementsTotal;

  // Số dư Sổ cái điều chỉnh = Dư Sổ + Lãi chưa hạch toán - Phí chưa hạch toán
  const adjustedLedgerBalance =
    closingBalanceLedger + unrecordedInterestTotal - unrecordedFeesTotal;

  const variance = adjustedBankBalance - adjustedLedgerBalance;
  const isBalanced = variance === 0n;

  return {
    discrepancies,
    summary: {
      adjustedBankBalance,
      adjustedLedgerBalance,
      isBalanced,
      variance,
      depositsInTransitTotal,
      outstandingDisbursementsTotal,
      unrecordedInterestTotal,
      unrecordedFeesTotal,
    },
  };
}
