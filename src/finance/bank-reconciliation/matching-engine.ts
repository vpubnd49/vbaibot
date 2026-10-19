/**
 * matching-engine.ts
 *
 * Engine đối soát và so khớp tự động giữa Sao kê Ngân hàng và Sổ cái Kế toán.
 *
 * Quy tắc đối ứng chiều tiền:
 * - Thu tiền: Bank CREDIT (tiền vào NH) <--> Ledger DEBIT (Nợ TK 112)
 * - Chi tiền: Bank DEBIT (tiền ra khỏi NH) <--> Ledger CREDIT (Có TK 112)
 *
 * Tuân thủ bất biến từ skill vn-banking & vn-finance-app-builder:
 * - So khớp mã duy nhất trước, sau đó mới đến số tiền/ngày/nội dung.
 * - Phát hiện tình huống mơ hồ (Ambiguous): >= 2 giao dịch cùng tiền, cùng ngày mà thiếu căn cứ -> Yêu cầu con người duyệt, cấm ghép bừa.
 * - Hỗ trợ ghép 1-1, 1-Nhiều (Batch payment/collection).
 */

import type { BankTransaction, LedgerEntry, MatchedPair } from "./types.js";

function parseDateMs(dateStr: string): number {
  return new Date(dateStr).getTime();
}

function daysDiff(date1: string, date2: string): number {
  const ms = Math.abs(parseDateMs(date1) - parseDateMs(date2));
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function isDirectionCompatible(bank: BankTransaction, ledger: LedgerEntry): boolean {
  if (bank.txType === "CREDIT" && ledger.txType === "DEBIT") return true;
  if (bank.txType === "DEBIT" && ledger.txType === "CREDIT") return true;
  return false;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MatchingResult {
  matchedPairs: MatchedPair[];
  unmatchedBankTxIds: string[];
  unmatchedLedgerEntryIds: string[];
  ambiguousPairs: MatchedPair[];
}

export function runReconciliationMatching(
  bankTransactions: BankTransaction[],
  ledgerEntries: LedgerEntry[],
  options?: {
    toleranceDays?: number;
    enableBatchMatch?: boolean;
  }
): MatchingResult {
  const toleranceDays = options?.toleranceDays ?? 3;
  const enableBatchMatch = options?.enableBatchMatch ?? true;

  const matchedBankIds = new Set<string>();
  const matchedLedgerIds = new Set<string>();
  const matchedPairs: MatchedPair[] = [];
  const ambiguousPairs: MatchedPair[] = [];

  let pairCounter = 1;
  const nextPairId = () => `MATCH-${String(pairCounter++).padStart(4, "0")}`;

  // ──────────────────────────────────────────────────────────────────────────
  // TẦNG 1: EXACT MATCH (Số tiền khớp 100% + Mã tham chiếu trùng + Chiều khớp)
  // ──────────────────────────────────────────────────────────────────────────
  for (const bTx of bankTransactions) {
    if (matchedBankIds.has(bTx.id)) continue;

    for (const lEntry of ledgerEntries) {
      if (matchedLedgerIds.has(lEntry.id)) continue;
      if (!isDirectionCompatible(bTx, lEntry)) continue;
      if (bTx.amount !== lEntry.amount) continue;

      // Kiểm tra mã tham chiếu: nếu bTx.referenceNumber xuất hiện trong voucherNumber hoặc description của sổ
      const refBank = bTx.referenceNumber.trim();
      const hasRefMatch =
        refBank.length >= 4 &&
        (lEntry.voucherNumber.includes(refBank) ||
          lEntry.description.toUpperCase().includes(refBank.toUpperCase()));

      if (hasRefMatch && daysDiff(bTx.transactionDate, lEntry.postingDate) <= toleranceDays + 2) {
        matchedBankIds.add(bTx.id);
        matchedLedgerIds.add(lEntry.id);
        matchedPairs.push({
          id: nextPairId(),
          status: "EXACT_MATCH",
          bankTxIds: [bTx.id],
          ledgerEntryIds: [lEntry.id],
          matchedAmount: bTx.amount,
          confidence: 1.0,
          ruleUsed: "TIER1_EXACT_REFERENCE_AND_AMOUNT",
          explanation: `Khớp chính xác số tiền (${bTx.amount} VND) và mã tham chiếu '${refBank}' (chênh lệch ${daysDiff(bTx.transactionDate, lEntry.postingDate)} ngày).`,
          requiresReview: false,
        });
        break;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TẦNG 2: RULE-BASED MATCH & AMBIGUITY CHECK (Số tiền + Ngày + Từ khóa)
  // ──────────────────────────────────────────────────────────────────────────
  for (const bTx of bankTransactions) {
    if (matchedBankIds.has(bTx.id)) continue;

    // Tìm tất cả ứng viên thỏa mãn: chiều tiền + số tiền + ngày trong khoảng cho phép
    const candidates = ledgerEntries.filter((lEntry) => {
      if (matchedLedgerIds.has(lEntry.id)) return false;
      if (!isDirectionCompatible(bTx, lEntry)) return false;
      if (bTx.amount !== lEntry.amount) return false;
      return daysDiff(bTx.transactionDate, lEntry.postingDate) <= toleranceDays;
    });

    if (candidates.length === 1) {
      const lEntry = candidates[0]!;
      matchedBankIds.add(bTx.id);
      matchedLedgerIds.add(lEntry.id);
      matchedPairs.push({
        id: nextPairId(),
        status: "RULE_MATCH",
        bankTxIds: [bTx.id],
        ledgerEntryIds: [lEntry.id],
        matchedAmount: bTx.amount,
        confidence: 0.85,
        ruleUsed: "TIER2_AMOUNT_AND_DATE_WINDOW",
        explanation: `Khớp theo số tiền (${bTx.amount} VND) và ngày phát sinh cách nhau ${daysDiff(bTx.transactionDate, lEntry.postingDate)} ngày.`,
        requiresReview: false,
      });
    } else if (candidates.length > 1) {
      // Bất biến: Có >= 2 giao dịch cùng tiền, cùng ngày -> AMBIGUOUS!
      // Thử lọc sâu hơn bằng tên đối tác/mã số thuế nếu có
      const normBankDesc = normalizeText(bTx.description);
      const textMatches = candidates.filter((c) => {
        const normPartner = c.partnerName ? normalizeText(c.partnerName) : "";
        const normLedgerDesc = normalizeText(c.description);
        return (
          (normPartner && normBankDesc.includes(normPartner)) ||
          (c.partnerCode && bTx.description.toUpperCase().includes(c.partnerCode.toUpperCase())) ||
          normBankDesc.includes(normLedgerDesc)
        );
      });

      if (textMatches.length === 1) {
        const lEntry = textMatches[0]!;
        matchedBankIds.add(bTx.id);
        matchedLedgerIds.add(lEntry.id);
        matchedPairs.push({
          id: nextPairId(),
          status: "RULE_MATCH",
          bankTxIds: [bTx.id],
          ledgerEntryIds: [lEntry.id],
          matchedAmount: bTx.amount,
          confidence: 0.80,
          ruleUsed: "TIER2_AMOUNT_DATE_AND_PARTNER_TEXT",
          explanation: `Khớp theo số tiền và nhận diện đối tác '${lEntry.partnerName}' trong nội dung chuyển khoản.`,
          requiresReview: false,
        });
      } else {
        // Vẫn bị trùng/mơ hồ: Ghi nhận AMBIGUOUS, KHÔNG tự ý ghép bừa!
        ambiguousPairs.push({
          id: nextPairId(),
          status: "AMBIGUOUS",
          bankTxIds: [bTx.id],
          ledgerEntryIds: candidates.map((c) => c.id),
          matchedAmount: bTx.amount,
          confidence: 0.50,
          ruleUsed: "TIER2_AMBIGUOUS_MULTI_CANDIDATES",
          explanation: `CẢNH BÁO: Phát hiện ${candidates.length} bút toán trên sổ cái có cùng số tiền (${bTx.amount} VND) và cùng khoảng ngày nhưng thiếu mã phân biệt duy nhất. Cần kế toán viên chỉ định thủ công.`,
          requiresReview: true,
        });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TẦNG 3: BATCH MATCH (1 giao dịch Ngân hàng <--> Nhiều bút toán Sổ cái)
  // Ví dụ: Doanh nghiệp chi 1 lệnh tổng trả cho 2 hóa đơn cùng NCC
  // ──────────────────────────────────────────────────────────────────────────
  if (enableBatchMatch) {
    for (const bTx of bankTransactions) {
      if (matchedBankIds.has(bTx.id)) continue;

      const compatibleEntries = ledgerEntries.filter(
        (l) => !matchedLedgerIds.has(l.id) && isDirectionCompatible(bTx, l)
      );

      // Thử tìm tổ hợp 2 bút toán sổ cái có tổng số tiền chính xác bằng bTx.amount
      let foundPair = false;
      for (let i = 0; i < compatibleEntries.length; i++) {
        for (let j = i + 1; j < compatibleEntries.length; j++) {
          const l1 = compatibleEntries[i]!;
          const l2 = compatibleEntries[j]!;
          if (l1.amount + l2.amount === bTx.amount) {
            // Kiểm tra ngày tương thích
            if (
              daysDiff(bTx.transactionDate, l1.postingDate) <= toleranceDays + 3 &&
              daysDiff(bTx.transactionDate, l2.postingDate) <= toleranceDays + 3
            ) {
              matchedBankIds.add(bTx.id);
              matchedLedgerIds.add(l1.id);
              matchedLedgerIds.add(l2.id);

              matchedPairs.push({
                id: nextPairId(),
                status: "BATCH_MATCH",
                bankTxIds: [bTx.id],
                ledgerEntryIds: [l1.id, l2.id],
                matchedAmount: bTx.amount,
                confidence: 0.90,
                ruleUsed: "TIER3_BATCH_1_BANK_TO_2_LEDGER",
                explanation: `Khớp gộp: 1 lệnh ngân hàng (${bTx.amount} VND) khớp tổng 2 bút toán sổ cái (${l1.voucherNumber}: ${l1.amount} + ${l2.voucherNumber}: ${l2.amount}).`,
                requiresReview: true, // Batch match luôn nên được duyệt lại
              });
              foundPair = true;
              break;
            }
          }
        }
        if (foundPair) break;
      }
    }
  }

  const unmatchedBankTxIds = bankTransactions
    .filter((b) => !matchedBankIds.has(b.id))
    .map((b) => b.id);

  const unmatchedLedgerEntryIds = ledgerEntries
    .filter((l) => !matchedLedgerIds.has(l.id))
    .map((l) => l.id);

  return {
    matchedPairs,
    unmatchedBankTxIds,
    unmatchedLedgerEntryIds,
    ambiguousPairs,
  };
}
