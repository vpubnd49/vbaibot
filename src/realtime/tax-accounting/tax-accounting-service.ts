import {
  ACCOUNTING_ACCOUNTS,
  PIT_BRACKETS,
  PIT_BRACKETS_2026,
  PIT_DEDUCTIONS,
  PIT_DEDUCTIONS_2026,
  VAT_RATES,
  CIT_AND_FEES,
  TAX_POLICIES_2026,
  type AccountRecord,
} from "./tax-accounting-data.js";
import { normalizeVietnamese } from "../../legal/domain/normalize-vietnamese.js";
import { searchWeb } from "../../shared/web-search-providers.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("tax-accounting-service");

export type PitCalculationResult = {
  grossSalary: number;
  dependentsCount: number;
  insuranceAmount: number;
  personalDeduction: number;
  dependentDeduction: number;
  totalDeduction: number;
  taxableIncome: number;
  assessableIncome: number; // Thu nhập tính thuế
  pitAmount: number;
  netSalary: number;
  bracketBreakdown: string;
  regimeLabel: string;
};

/**
 * Tính thuế TNCN từ tiền lương, tiền công.
 * Mặc định áp dụng Luật Thuế TNCN sửa đổi số 109/2025/QH15 (kỳ tính thuế từ 2026:
 * giảm trừ bản thân 15,5 triệu/tháng, người phụ thuộc 6,2 triệu/tháng, biểu 5 bậc).
 * Có thể truyền `useLegacyPre2026 = true` khi cần đối chiếu kỳ tính thuế trước 2026.
 */
export function calculatePit(
  grossSalary: number,
  dependentsCount = 0,
  useLegacyPre2026 = false,
): PitCalculationResult {
  const grossRounded = Math.round(grossSalary);
  const deductionsCfg = useLegacyPre2026 ? PIT_DEDUCTIONS : PIT_DEDUCTIONS_2026;
  const bracketsCfg = useLegacyPre2026 ? PIT_BRACKETS : PIT_BRACKETS_2026;
  const regimeLabel = useLegacyPre2026
    ? "Kỳ trước 2026 (Biểu 7 bậc - NQ 954/2020/UBTVQH14)"
    : "Kỳ từ 2026 (Biểu 5 bậc - Luật 109/2025/QH15)";

  const insuranceAmount = Math.round(grossRounded * deductionsCfg.insuranceRates.totalWorker);
  const personalDeduction = deductionsCfg.personal;
  const dependentDeduction = dependentsCount * deductionsCfg.dependent;
  const totalDeduction = personalDeduction + dependentDeduction + insuranceAmount;

  // Thu nhập chịu thuế = Gross - Các khoản miễn thuế (nếu có)
  const taxableIncome = grossRounded;
  // Thu nhập tính thuế = Thu nhập chịu thuế - Tổng giảm trừ
  const assessableIncome = Math.max(0, taxableIncome - totalDeduction);

  let pitAmount = 0;
  let breakdown = "";

  if (assessableIncome > 0) {
    for (const b of bracketsCfg) {
      const prevMax = b.level === 1 ? 0 : bracketsCfg[b.level - 2]!.maxIncome;
      if (assessableIncome > prevMax) {
        if (b.level === bracketsCfg.length || assessableIncome <= b.maxIncome) {
          pitAmount = Math.round(assessableIncome * b.rate - b.subtractQuick);
          breakdown = `Áp dụng Bậc ${b.level} (${b.desc}): (${assessableIncome.toLocaleString("vi-VN")} đ × ${Math.round(b.rate * 100)}%) - ${b.subtractQuick.toLocaleString("vi-VN")} đ = ${pitAmount.toLocaleString("vi-VN")} đ`;
          break;
        }
      }
    }
  } else {
    breakdown = "Thu nhập tính thuế <= 0 đ (Thu nhập dưới mức chịu thuế sau giảm trừ), Số thuế TNCN phải nộp = 0 đ.";
  }

  pitAmount = Math.max(0, Math.round(pitAmount));
  const netSalary = Math.round(grossRounded - insuranceAmount - pitAmount);

  return {
    grossSalary: grossRounded,
    dependentsCount,
    insuranceAmount,
    personalDeduction,
    dependentDeduction,
    totalDeduction,
    taxableIncome,
    assessableIncome,
    pitAmount,
    netSalary,
    bracketBreakdown: breakdown,
    regimeLabel,
  };
}

/**
 * Tra cứu tài khoản kế toán
 */
export function searchAccountingAccount(query: string): AccountRecord[] {
  const normQuery = normalizeVietnamese(query.trim());
  const extractedNumbers: string[] = query.match(/\b\d{3,4}\b/g) || [];

  return ACCOUNTING_ACCOUNTS.filter((acc) => {
    const normCode = normalizeVietnamese(acc.code);
    const normName = normalizeVietnamese(acc.name);
    const normDesc = normalizeVietnamese(acc.description);

    // 1. Khớp số hiệu tài khoản
    if (extractedNumbers.includes(acc.code)) return true;
    if (normCode === normQuery || normQuery.includes(normCode)) return true;

    // 2. Khớp từ khóa tên hoặc mô tả
    if (normName.includes(normQuery) || normDesc.includes(normQuery)) return true;

    return false;
  });
}

export type TaxAccountingReport = {
  category: "tax" | "accounting" | "banking" | "pit_calculator" | "all";
  formattedText: string;
};

/**
 * Tra cứu toàn diện Thuế, Kế toán, Ngân hàng, Hóa đơn điện tử
 */
export async function lookupTaxAccounting(
  query: string,
  grossForPit?: number,
  dependentsCount = 0,
  fetchFn: typeof fetch = fetch,
): Promise<TaxAccountingReport> {
  let summary = `📊 **TRA CỨU TÀI CHÍNH, NGÂN HÀNG, THUẾ & KẾ TOÁN DOANH NGHIỆP**\n\n`;

  // 1. Trường hợp người dùng muốn tính thuế TNCN cụ thể
  if (grossForPit && grossForPit > 0) {
    const useLegacy = /(?:trước\s*2026|luật\s*cũ|kỳ\s*202[0-5]|11\s*triệu|4[.,]4\s*triệu)/i.test(query);
    const pitRes = calculatePit(grossForPit, dependentsCount, useLegacy);
    const depUnitStr = useLegacy ? "4,4 tr" : "6,2 tr";
    summary += `🧮 **BẢNG TÍNH THUẾ THU NHẬP CÁ NHÂN (TNCN) — ${pitRes.regimeLabel}:**\n`;
    summary += `- **Lương Gross**: ${pitRes.grossSalary.toLocaleString("vi-VN")} VNĐ\n`;
    summary += `- **Người phụ thuộc**: ${pitRes.dependentsCount} người\n`;
    summary += `- **Bảo hiểm bắt buộc (10,5%)**: ${pitRes.insuranceAmount.toLocaleString("vi-VN")} VNĐ (BHXH 8%, BHYT 1,5%, BHTN 1%)\n`;
    summary += `- **Giảm trừ bản thân**: ${pitRes.personalDeduction.toLocaleString("vi-VN")} VNĐ\n`;
    summary += `- **Giảm trừ người phụ thuộc**: ${pitRes.dependentDeduction.toLocaleString("vi-VN")} VNĐ (${pitRes.dependentsCount} × ${depUnitStr})\n`;
    summary += `- **Tổng các khoản giảm trừ**: ${pitRes.totalDeduction.toLocaleString("vi-VN")} VNĐ\n`;
    summary += `- **Thu nhập tính thuế (TNTT)**: ${pitRes.assessableIncome.toLocaleString("vi-VN")} VNĐ\n`;
    summary += `- **Cách tính**: ${pitRes.bracketBreakdown}\n`;
    summary += `👉 **Thuế TNCN phải nộp**: **${pitRes.pitAmount.toLocaleString("vi-VN")} VNĐ**\n`;
    summary += `👉 **Lương thực nhận (Net)**: **${pitRes.netSalary.toLocaleString("vi-VN")} VNĐ**\n`;
    if (!useLegacy) {
      const legacyRes = calculatePit(grossForPit, dependentsCount, true);
      const diff = legacyRes.pitAmount - pitRes.pitAmount;
      if (diff > 0) {
        summary += `💡 *Đối chiếu quy định cũ trước 2026 (11tr/4,4tr, 7 bậc): Thuế TNCN cũ là ${legacyRes.pitAmount.toLocaleString("vi-VN")} VNĐ → Luật mới 109/2025/QH15 giúp giảm **${diff.toLocaleString("vi-VN")} VNĐ/tháng**.*\n`;
      }
    }
    summary += `\n`;
  }

  // 2. Tra cứu Tài khoản kế toán
  const matchedAccounts = searchAccountingAccount(query);
  if (matchedAccounts.length > 0) {
    summary += `📚 **HỆ THỐNG TÀI KHOẢN KẾ TOÁN (TT 99/2025/TT-BTC thay thế TT 200 từ 01/01/2026 & TT 133/2016):**\n`;
    matchedAccounts.slice(0, 4).forEach((acc) => {
      const sysLabel = acc.system === "CaHai" ? "TT99/TT200 & TT133" : acc.system === "TT200" ? "TT99/TT200" : acc.system;
      summary += `- **TK ${acc.code} - ${acc.name}** [Hệ thống: ${sysLabel}]\n`;
      summary += `  + *Nội dung*: ${acc.description}\n`;
      summary += `  + *Bên Nợ (+)*: ${acc.debit}\n`;
      summary += `  + *Bên Có (-)*: ${acc.credit}\n`;
    });
    summary += `- *Ghi chú chế độ kế toán*: ${TAX_POLICIES_2026.accountingStandard99}\n\n`;
  }

  // 3. Tra cứu quy định Thuế (GTGT, TNDN, Môn bài, Hóa đơn điện tử, Kế toán TT99)
  const isTax = /(?:thuế|thue|vat|gtgt|tndn|tncn|môn bài|mon bai|khấu trừ|hóa đơn|hoa don|nghị định 123|thông tư 78|thông tư 99|nghị định 141|nghị định 144|nghị định 254|nghị quyết 43)/i.test(query);
  if (isTax) {
    summary += `📜 **QUY ĐỊNH CHÍNH SÁCH THUẾ & HÓA ĐƠN ĐIỆN TỬ (CẬP NHẬT 2026):**\n`;
    if (/tncn|thu nhập cá nhân|giảm trừ/i.test(query)) {
      summary += `- **Áp dụng từ kỳ tính thuế 2026 (Luật Thuế TNCN sửa đổi số 109/2025/QH15)**:\n`;
      summary += `  + Giảm trừ bản thân: **15.500.000 đ/tháng** (186 tr/năm); Người phụ thuộc: **6.200.000 đ/tháng/người** (74,4 tr/năm).\n`;
      summary += `  + Biểu thuế lũy tiến 5 bậc mới: Bậc 1 (đến 10 tr): 5%; Bậc 2 (>10 - 30 tr): 10%; Bậc 3 (>30 - 60 tr): 20%; Bậc 4 (>60 - 100 tr): 30%; Bậc 5 (>100 tr): 35%.\n`;
      summary += `- **Mức cũ (trước kỳ 2026 - NQ 954/2020/UBTVQH14)**: Bản thân 11.000.000 đ/tháng; Người phụ thuộc 4.400.000 đ/tháng (Biểu 7 bậc: 5% - 35%).\n`;
    }
    if (/gtgt|vat|giá trị gia tăng/i.test(query)) {
      summary += `- **Thuế suất GTGT**:\n`;
      summary += `  + ${VAT_RATES.rate0}\n`;
      summary += `  + ${VAT_RATES.rate5}\n`;
      summary += `  + ${VAT_RATES.rate10}\n`;
      summary += `  + ${VAT_RATES.rateReduced8}\n`;
      summary += `- **Khấu trừ VAT mua hàng trả chậm (Nghị định 144/2026/NĐ-CP)**: Hàng hóa/dịch vụ trả chậm từ 05 triệu đồng vẫn được khấu trừ trước hạn thanh toán; chỉ điều chỉnh giảm khi đến hạn mà chưa có chứng từ không dùng tiền mặt.\n`;
    }
    if (/tndn|thu nhập doanh nghiệp/i.test(query)) {
      summary += `- **Thuế suất TNDN**: ${CIT_AND_FEES.citStandardRate}\n`;
      summary += `- **Ưu đãi thuế**: ${CIT_AND_FEES.citPreferentialRates}\n`;
      summary += `- **Miễn thuế TNDN (Nghị định 141/2026/NĐ-CP)**: Miễn thuế TNDN cho doanh nghiệp thành lập theo PL VN có tổng doanh thu năm từ 01 tỷ đồng trở xuống.\n`;
      summary += `- **Giảm 30% thuế TNDN (Nghị quyết 43/2026/QH16)**: Giảm 30% số thuế TNDN phải nộp trong kỳ 2026–2027 cho doanh nghiệp có doanh thu không quá 10 tỷ đồng.\n`;
      summary += `- **Chi phí được trừ**: Khoản chi thực tế liên quan đến SXKD, đủ hóa đơn chứng từ hợp pháp, thanh toán không dùng tiền mặt theo quy định.\n`;
    }
    if (/môn bài|mon bai|lệ phí/i.test(query)) {
      summary += `- **Lệ phí môn bài doanh nghiệp**:\n`;
      CIT_AND_FEES.licenseFees.forEach((f) => {
        summary += `  + ${f.capital}: **${f.fee}**\n`;
      });
    }
    if (/hóa đơn|hoa don|nghị định 123|thông tư 78|nghị định 254|thông tư 91/i.test(query)) {
      summary += `- **Hóa đơn điện tử mới (Nghị định 254/2026/NĐ-CP & Thông tư 91/2026/TT-BTC áp dụng từ 01/07/2026)**:\n`;
      summary += `  + Thay thế Nghị định 123/2020/NĐ-CP và Thông tư 78/2021/TT-BTC.\n`;
      summary += `  + Xử lý sai sót: Sai tên/địa chỉ đúng MST nộp thông báo Mẫu 04/SS; sai MST/tiền/thuế suất xuất hóa đơn điều chỉnh hoặc thay thế có thỏa thuận văn bản (không xóa hóa đơn gốc).\n`;
    }
    summary += `\n`;
  }

  // 4. Tra cứu Lãi suất & Nghiệp vụ Ngân hàng
  const isBank = /(?:ngân hàng|ngan hang|lãi suất|lai suat|tiết kiệm|tiet kiem|cho vay|nhnn|vietcombank|bidv|vietinbank|agribank|thông tư 29|thông tư 27|aml|rửa tiền)/i.test(query);
  if (isBank) {
    summary += `🏦 **LÃI SUẤT & CHÍNH SÁCH TIỀN TỆ, TÍN DỤNG NGÂN HÀNG (CẬP NHẬT 2026):**\n`;
    summary += `- **Quy định Cho vay mới (Thông tư 29/2026/TT-NHNN sửa TT 39/2016)**:\n`;
    summary += `  + Vay giá trị nhỏ: Tối đa 200 triệu đồng tại Quỹ TDND, 400 triệu đồng tại các TCTD khác.\n`;
    summary += `  + Thứ tự thu nợ: Nợ quá hạn bắt buộc **thu nợ gốc trước, thu nợ lãi sau**.\n`;
    summary += `  + Lãi chậm trả: Lãi quá hạn gốc tối đa 150% lãi trong hạn; Lãi chậm trả tiền lãi tối đa 10%/năm.\n`;
    summary += `- **Quy định AML/KYC (Thông tư 27/2025/TT-NHNN)**: Giao dịch chuyển tiền điện tử trong nước từ 500 triệu đồng hoặc quốc tế từ 1.000 USD phải báo cáo Cục Phòng chống rửa tiền.\n`;
    summary += `- **Khung Lãi suất Tiết kiệm Tham khảo (Nhóm Big4 & NHTMCP lớn)**:\n`;
    summary += `  + *Kỳ hạn 1 - 3 tháng*: 2.0% - 3.5%/năm.\n`;
    summary += `  + *Kỳ hạn 6 - 9 tháng*: 3.8% - 5.2%/năm.\n`;
    summary += `  + *Kỳ hạn 12 - 24 tháng*: 4.7% - 6.0%/năm.\n`;
    summary += `- **Lãi suất Cho vay Ưu đãi**: Gói vay mua nhà, sản xuất kinh doanh dao động từ 5.5% - 8.5%/năm trong thời gian ưu đãi ban đầu.\n`;
    summary += `- **Lãi suất điều hành NHNN**: Lãi suất tái cấp vốn 4.5%/năm, Lãi suất tái chiết khấu 3.0%/năm.\n\n`;
  }

  // 5. Nếu câu hỏi chi tiết/nghiệp vụ phức tạp, cào thêm từ Web Search
  if (!matchedAccounts.length && !isTax && !isBank && (!grossForPit || grossForPit <= 0)) {
    try {
      const results = await searchWeb(`nghiệp vụ thuế kế toán tài chính ngân hàng ${query}`, {
        maxResults: 3,
        fetchFn,
      });
      if (results.length > 0) {
        summary += `🌐 **Thông tin hướng dẫn nghiệp vụ chuyên môn:**\n`;
        for (const r of results) {
          summary += `- **${r.title}**\n`;
          if (r.snippet) summary += `  ${r.snippet}\n`;
          summary += `  Link: ${r.url}\n`;
        }
      }
    } catch (err) {
      log.warn({ err }, "Lỗi khi tìm kiếm tài chính thuế kế toán");
    }
  }

  summary += `📌 *Lưu ý: Mọi số liệu và quy định thuế, kế toán, lãi suất cần được đối chiếu cụ thể theo hồ sơ thực tế và văn bản quy phạm pháp luật hiện hành tại thời điểm phát sinh nghiệp vụ.*`;

  return {
    category: "all",
    formattedText: summary.trim(),
  };
}
