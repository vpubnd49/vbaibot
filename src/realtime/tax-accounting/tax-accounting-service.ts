import {
  ACCOUNTING_ACCOUNTS,
  PIT_BRACKETS,
  PIT_DEDUCTIONS,
  VAT_RATES,
  CIT_AND_FEES,
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
};

/**
 * Tính thuế TNCN từ tiền lương, tiền công
 */
export function calculatePit(grossSalary: number, dependentsCount = 0): PitCalculationResult {
  const insuranceAmount = grossSalary * PIT_DEDUCTIONS.insuranceRates.totalWorker;
  const personalDeduction = PIT_DEDUCTIONS.personal;
  const dependentDeduction = dependentsCount * PIT_DEDUCTIONS.dependent;
  const totalDeduction = personalDeduction + dependentDeduction + insuranceAmount;

  // Thu nhập chịu thuế = Gross - Các khoản miễn thuế (nếu có)
  const taxableIncome = grossSalary;
  // Thu nhập tính thuế = Thu nhập chịu thuế - Tổng giảm trừ
  const assessableIncome = Math.max(0, taxableIncome - totalDeduction);

  let pitAmount = 0;
  let breakdown = "";

  if (assessableIncome > 0) {
    for (const b of PIT_BRACKETS) {
      if (assessableIncome > (b.level === 1 ? 0 : PIT_BRACKETS[b.level - 2]!.maxIncome)) {
        // Dùng công thức tính nhanh: (Thu nhập tính thuế * Thuế suất) - Số trừ nhanh
        if (b.level === PIT_BRACKETS.length || assessableIncome <= b.maxIncome) {
          pitAmount = assessableIncome * b.rate - b.subtractQuick;
          breakdown = `Áp dụng Bậc ${b.level} (${b.desc}): (${assessableIncome.toLocaleString("vi-VN")} đ × ${(b.rate * 100)}%) - ${b.subtractQuick.toLocaleString("vi-VN")} đ = ${Math.round(pitAmount).toLocaleString("vi-VN")} đ`;
          break;
        }
      }
    }
  } else {
    breakdown = "Thu nhập tính thuế <= 0 đ (Thu nhập dưới mức chịu thuế sau giảm trừ), Số thuế TNCN phải nộp = 0 đ.";
  }

  pitAmount = Math.max(0, Math.round(pitAmount));
  const netSalary = Math.round(grossSalary - insuranceAmount - pitAmount);

  return {
    grossSalary,
    dependentsCount,
    insuranceAmount: Math.round(insuranceAmount),
    personalDeduction,
    dependentDeduction,
    totalDeduction: Math.round(totalDeduction),
    taxableIncome,
    assessableIncome: Math.round(assessableIncome),
    pitAmount,
    netSalary,
    bracketBreakdown: breakdown,
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
    const pitRes = calculatePit(grossForPit, dependentsCount);
    summary += `🧮 **BẢNG TÍNH THUẾ THU NHẬP CÁ NHÂN (TNCN):**\n`;
    summary += `- **Lương Gross**: ${pitRes.grossSalary.toLocaleString("vi-VN")} VNĐ\n`;
    summary += `- **Người phụ thuộc**: ${pitRes.dependentsCount} người\n`;
    summary += `- **Bảo hiểm bắt buộc (10.5%)**: ${pitRes.insuranceAmount.toLocaleString("vi-VN")} VNĐ (BHXH 8%, BHYT 1.5%, BHTN 1%)\n`;
    summary += `- **Giảm trừ bản thân**: ${pitRes.personalDeduction.toLocaleString("vi-VN")} VNĐ\n`;
    summary += `- **Giảm trừ người phụ thuộc**: ${pitRes.dependentDeduction.toLocaleString("vi-VN")} VNĐ (${pitRes.dependentsCount} × 4.4 tr)\n`;
    summary += `- **Tổng các khoản giảm trừ**: ${pitRes.totalDeduction.toLocaleString("vi-VN")} VNĐ\n`;
    summary += `- **Thu nhập tính thuế (TNTT)**: ${pitRes.assessableIncome.toLocaleString("vi-VN")} VNĐ\n`;
    summary += `- **Cách tính**: ${pitRes.bracketBreakdown}\n`;
    summary += `👉 **Thuế TNCN phải nộp**: **${pitRes.pitAmount.toLocaleString("vi-VN")} VNĐ**\n`;
    summary += `👉 **Lương thực nhận (Net)**: **${pitRes.netSalary.toLocaleString("vi-VN")} VNĐ**\n\n`;
  }

  // 2. Tra cứu Tài khoản kế toán
  const matchedAccounts = searchAccountingAccount(query);
  if (matchedAccounts.length > 0) {
    summary += `📚 **HỆ THỐNG TÀI KHOẢN KẾ TOÁN (TT 200/2014 & TT 133/2016):**\n`;
    matchedAccounts.slice(0, 4).forEach((acc) => {
      summary += `- **TK ${acc.code} - ${acc.name}** [Hệ thống: ${acc.system}]\n`;
      summary += `  + *Nội dung*: ${acc.description}\n`;
      summary += `  + *Bên Nợ (+)*: ${acc.debit}\n`;
      summary += `  + *Bên Có (-)*: ${acc.credit}\n`;
    });
    summary += `\n`;
  }

  // 3. Tra cứu quy định Thuế (GTGT, TNDN, Môn bài, Hóa đơn điện tử)
  const isTax = /(?:thuế|thue|vat|gtgt|tndn|tncn|môn bài|mon bai|khấu trừ|hóa đơn|hoa don|nghị định 123|thông tư 78)/i.test(query);
  if (isTax) {
    summary += `📜 **QUY ĐỊNH CHÍNH SÁCH THUẾ & HÓA ĐƠN ĐIỆN TỬ:**\n`;
    if (/tncn|thu nhập cá nhân/i.test(query)) {
      summary += `- **Giảm trừ gia cảnh**: Bản thân 11.000.000 đ/tháng; Người phụ thuộc 4.400.000 đ/tháng.\n`;
      summary += `- **Biểu thuế**: Lũy tiến 7 bậc từ 5% đến 35% đối với thu nhập từ tiền lương, tiền công.\n`;
    }
    if (/gtgt|vat|giá trị gia tăng/i.test(query)) {
      summary += `- **Thuế suất GTGT**:\n`;
      summary += `  + ${VAT_RATES.rate0}\n`;
      summary += `  + ${VAT_RATES.rate5}\n`;
      summary += `  + ${VAT_RATES.rate10}\n`;
      summary += `  + ${VAT_RATES.rateReduced8}\n`;
    }
    if (/tndn|thu nhập doanh nghiệp/i.test(query)) {
      summary += `- **Thuế suất TNDN**: ${CIT_AND_FEES.citStandardRate}\n`;
      summary += `- **Ưu đãi thuế**: ${CIT_AND_FEES.citPreferentialRates}\n`;
      summary += `- **Chi phí được trừ**: Khoản chi thực tế phát sinh liên quan đến hoạt động SXKD, có đủ hóa đơn chứng từ hợp pháp, thanh toán không dùng tiền mặt đối với hóa đơn từ 20 triệu đồng trở lên.\n`;
    }
    if (/môn bài|mon bai|lệ phí/i.test(query)) {
      summary += `- **Lệ phí môn bài doanh nghiệp**:\n`;
      CIT_AND_FEES.licenseFees.forEach((f) => {
        summary += `  + ${f.capital}: **${f.fee}**\n`;
      });
    }
    if (/hóa đơn|hoa don|nghị định 123|thông tư 78/i.test(query)) {
      summary += `- **Hóa đơn điện tử (Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC)**:\n`;
      summary += `  + Bắt buộc 100% doanh nghiệp, tổ chức, hộ cá nhân kinh doanh sử dụng HĐĐT có mã hoặc không có mã của cơ quan thuế.\n`;
      summary += `  + Xử lý sai sót: Xuất hóa đơn điều chỉnh hoặc hóa đơn thay thế cho hóa đơn có sai sót; nộp Mẫu 04/SS-HĐĐT thông báo giải trình với cơ quan thuế khi có thay đổi.\n`;
    }
    summary += `\n`;
  }

  // 4. Tra cứu Lãi suất & Nghiệp vụ Ngân hàng
  const isBank = /(?:ngân hàng|ngan hang|lãi suất|lai suat|tiết kiệm|tiet kiem|cho vay|nhnn|vietcombank|bidv|vietinbank|agribank)/i.test(query);
  if (isBank) {
    summary += `🏦 **LÃI SUẤT & CHÍNH SÁCH TIỀN TỆ NGÂN HÀNG:**\n`;
    summary += `- **Khung Lãi suất Tiết kiệm Tham khảo (Nhóm Big4 & NHTMCP lớn)**:\n`;
    summary += `  + *Kỳ hạn 1 - 3 tháng*: 2.0% - 3.5%/năm.\n`;
    summary += `  + *Kỳ hạn 6 - 9 tháng*: 3.8% - 5.2%/năm.\n`;
    summary += `  + *Kỳ hạn 12 - 24 tháng*: 4.7% - 6.0%/năm (tùy hình thức gửi online hoặc tại quầy).\n`;
    summary += `- **Lãi suất Cho vay Ưu đãi**: Gói vay mua nhà, sản xuất kinh doanh dao động từ 5.5% - 8.5%/năm trong thời gian ưu đãi ban đầu, sau đó thả nổi theo biên độ cơ sở.\n`;
    summary += `- **Lãi suất điều hành NHNN**: Lãi suất tái cấp vốn 4.5%/năm, Lãi suất tái chiết khấu 3.0%/năm, Trần lãi suất tiền gửi không kỳ hạn và dưới 1 tháng 0.5%/năm.\n\n`;
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
