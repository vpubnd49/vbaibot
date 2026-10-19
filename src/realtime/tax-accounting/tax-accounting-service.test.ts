import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculatePit,
  searchAccountingAccount,
  lookupTaxAccounting,
} from "./tax-accounting-service.js";

describe("Tax & Accounting Service Suite", () => {
  it("calculatePit tính chính xác thuế TNCN theo biểu thuế lũy tiến 2026 và đối chiếu trước 2026", () => {
    // Trường hợp 1 (Mặc định 2026 - Luật 109/2025/QH15, NQ 110/2025/UBTVQH15):
    // Lương 20 triệu, 0 NPT. BH 10.5% = 2.1tr. Giảm trừ bản thân = 15.5tr. Tổng giảm trừ = 17.6tr.
    // TNTT = 20 - 17.6 = 2.4tr. Bậc 1 (đến 10tr, thuế 5%): 2.4tr * 5% = 120,000 đ.
    const res20m = calculatePit(20_000_000, 0);
    assert.equal(res20m.insuranceAmount, 2_100_000);
    assert.equal(res20m.assessableIncome, 2_400_000);
    assert.equal(res20m.pitAmount, 120_000);
    assert.equal(res20m.netSalary, 17_780_000);

    // Trường hợp 1b (Chế độ cũ trước 2026 - NQ 954/2020/UBTVQH14):
    const res20mLegacy = calculatePit(20_000_000, 0, true);
    assert.equal(res20mLegacy.assessableIncome, 6_900_000);
    assert.equal(res20mLegacy.pitAmount, 440_000);
    assert.equal(res20mLegacy.netSalary, 17_460_000);

    // Trường hợp 2: Lương 10 triệu (Dưới mức chịu thuế sau giảm trừ) -> Thuế = 0 đ
    const res10m = calculatePit(10_000_000, 0);
    assert.equal(res10m.pitAmount, 0);
    assert.equal(res10m.netSalary, 8_950_000);

    // Trường hợp 3 (2026): Lương 50 triệu, 2 người phụ thuộc
    // BH: 5.25tr. Giảm trừ: 15.5tr + 2 * 6.2tr = 27.9tr. Tổng giảm trừ = 33.15tr.
    // TNTT = 50 - 33.15 = 16.85tr.
    // Bậc 2 (10 - 30tr, thuế 10%, trừ nhanh 500k): 16.85tr * 10% - 500k = 1,185,000 đ.
    const res50m = calculatePit(50_000_000, 2);
    assert.equal(res50m.pitAmount, 1_185_000);
  });

  it("searchAccountingAccount tra cứu đúng tài khoản 112 và 3331", () => {
    const acc112 = searchAccountingAccount("112");
    assert.ok(acc112.some((a) => a.code === "112" && a.name.includes("Tiền gửi ngân hàng")));

    const accVat = searchAccountingAccount("thuế GTGT phải nộp");
    assert.ok(accVat.some((a) => a.code === "3331"));
  });

  it("lookupTaxAccounting trả về báo cáo tổng hợp đầy đủ", async () => {
    const report = await lookupTaxAccounting("thuế GTGT và tài khoản 112", 25_000_000, 1);
    assert.ok(report.formattedText.includes("BẢNG TÍNH THUẾ THU NHẬP CÁ NHÂN"));
    assert.ok(report.formattedText.includes("TK 112"));
    assert.ok(report.formattedText.includes("Thuế suất GTGT"));
  });
});
