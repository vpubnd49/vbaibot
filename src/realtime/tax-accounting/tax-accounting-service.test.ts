import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculatePit,
  searchAccountingAccount,
  lookupTaxAccounting,
} from "./tax-accounting-service.js";

describe("Tax & Accounting Service Suite", () => {
  it("calculatePit tính chính xác thuế TNCN theo biểu thuế lũy tiến", () => {
    // Trường hợp 1: Lương 20 triệu, không người phụ thuộc
    // BH 10.5% = 2.1tr. Giảm trừ bản thân = 11tr. Tổng giảm trừ = 13.1tr.
    // TNTT = 20 - 13.1 = 6.9tr.
    // Bậc 2 (5 - 10tr, thuế 10%, trừ nhanh 250k): 6.9tr * 10% - 250k = 440,000 đ.
    const res20m = calculatePit(20_000_000, 0);
    assert.equal(res20m.insuranceAmount, 2_100_000);
    assert.equal(res20m.assessableIncome, 6_900_000);
    assert.equal(res20m.pitAmount, 440_000);
    assert.equal(res20m.netSalary, 17_460_000);

    // Trường hợp 2: Lương 10 triệu (Dưới mức chịu thuế sau giảm trừ) -> Thuế = 0 đ
    const res10m = calculatePit(10_000_000, 0);
    assert.equal(res10m.pitAmount, 0);
    assert.equal(res10m.netSalary, 8_950_000);

    // Trường hợp 3: Lương 50 triệu, 2 người phụ thuộc
    // BH: 5.25tr. Giảm trừ: 11tr + 8.8tr = 19.8tr. Tổng giảm trừ = 25.05tr.
    // TNTT = 50 - 25.05 = 24.95tr.
    // Bậc 4 (18 - 32tr, thuế 20%, trừ nhanh 1.65tr): 24.95tr * 20% - 1.65tr = 3,340,000 đ.
    const res50m = calculatePit(50_000_000, 2);
    assert.equal(res50m.pitAmount, 3_340_000);
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
