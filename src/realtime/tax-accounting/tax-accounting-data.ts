/**
 * Cơ sở dữ liệu nghiệp vụ Thuế, Kế toán, Ngân hàng & Tài chính doanh nghiệp Việt Nam
 */

export type AccountRecord = {
  code: string;
  name: string;
  category: "TaiSanNganHan" | "TaiSanDaiHan" | "NoPhaiTra" | "VonChuSoHuu" | "DoanhThu" | "ChiPhiSXKD" | "ChiPhiKhac" | "XacDinhKQKD";
  system: "TT200" | "TT133" | "CaHai";
  description: string;
  debit: string;
  credit: string;
};

export const ACCOUNTING_ACCOUNTS: AccountRecord[] = [
  // Loại 1: Tài sản ngắn hạn
  { code: "111", name: "Tiền mặt", category: "TaiSanNganHan", system: "CaHai", description: "Phản ánh tình hình thu, chi, tồn quỹ tiền mặt tại quỹ của doanh nghiệp (VND, ngoại tệ, vàng tiền tệ).", debit: "Thu tiền mặt vào quỹ", credit: "Xuất tiền mặt khỏi quỹ" },
  { code: "112", name: "Tiền gửi ngân hàng", category: "TaiSanNganHan", system: "CaHai", description: "Phản ánh số tiền hiện có và tình hình biến động tiền gửi tại Ngân hàng.", debit: "Gửi tiền vào tài khoản ngân hàng", credit: "Rút tiền từ tài khoản ngân hàng chuyển trả hoặc thanh toán" },
  { code: "115", name: "Tiền đang chuyển", category: "TaiSanNganHan", system: "TT200", description: "Phản ánh các khoản tiền đã nộp vào Ngân hàng, Kho bạc hoặc gửi qua bưu điện nhưng chưa nhận được giấy báo có.", debit: "Số tiền đang chuyển tăng", credit: "Đã vào tài khoản hoặc đến nơi nhận" },
  { code: "121", name: "Chứng khoán kinh doanh", category: "TaiSanNganHan", system: "CaHai", description: "Phản ánh tình hình mua, bán và nắm giữ chứng khoán kinh doanh (cổ phiếu, trái phiếu).", debit: "Giá trị chứng khoán kinh doanh mua vào", credit: "Giá trị chứng khoán kinh doanh bán ra" },
  { code: "131", name: "Phải thu của khách hàng", category: "TaiSanNganHan", system: "CaHai", description: "Tài khoản lưỡng tính: Phản ánh các khoản nợ phải thu và tình hình thanh toán của khách hàng.", debit: "Số tiền phải thu khách hàng tăng (bán chịu, cung cấp dịch vụ chưa thu tiền)", credit: "Khách hàng trả nợ, nhận tiền ứng trước của khách" },
  { code: "133", name: "Thuế GTGT được khấu trừ", category: "TaiSanNganHan", system: "CaHai", description: "Phản ánh số thuế GTGT đầu vào được khấu trừ, đã khấu trừ và còn được khấu trừ của DN.", debit: "Số thuế GTGT đầu vào phát sinh khi mua hàng hóa, dịch vụ", credit: "Số thuế GTGT đầu vào đã khấu trừ với thuế GTGT đầu ra hoặc được hoàn" },
  { code: "1331", name: "Thuế GTGT được khấu trừ của hàng hóa, dịch vụ", category: "TaiSanNganHan", system: "CaHai", description: "Thuế GTGT đầu vào mua hàng hóa, dịch vụ dùng cho SXKD chịu thuế GTGT theo phương pháp khấu trừ.", debit: "Thuế GTGT đầu vào phát sinh", credit: "Khấu trừ hoặc hoàn thuế" },
  { code: "1332", name: "Thuế GTGT được khấu trừ của TSCĐ", category: "TaiSanNganHan", system: "CaHai", description: "Thuế GTGT đầu vào khi mua sắm, xây dựng TSCĐ.", debit: "Thuế GTGT đầu vào của TSCĐ phát sinh", credit: "Khấu trừ hoặc hoàn thuế" },
  { code: "141", name: "Tạm ứng", category: "TaiSanNganHan", system: "CaHai", description: "Phản ánh các khoản tạm ứng cho người lao động trong DN để thực hiện nhiệm vụ công tác, mua hàng.", debit: "Số tiền tạm ứng cho nhân viên", credit: "Thanh toán tạm ứng hoặc thu hồi số tạm ứng thừa" },
  { code: "152", name: "Nguyên liệu, vật liệu", category: "TaiSanNganHan", system: "CaHai", description: "Phản ánh trị giá hiện có và tình hình tăng, giảm các loại nguyên liệu, vật liệu.", debit: "Trị giá nguyên vật liệu nhập kho tăng", credit: "Trị giá nguyên vật liệu xuất kho dùng cho sản xuất" },
  { code: "153", name: "Công cụ, dụng cụ", category: "TaiSanNganHan", system: "CaHai", description: "Phản ánh trị giá hiện có và tình hình tăng, giảm các loại công cụ, dụng cụ trong kho.", debit: "Trị giá CCDC nhập kho tăng", credit: "Xuất dùng CCDC hoặc phân bổ" },
  { code: "154", name: "Chi phí sản xuất, kinh doanh dở dang", category: "TaiSanNganHan", system: "CaHai", description: "Tổng hợp chi phí SXKD phục vụ tính giá thành sản phẩm, dịch vụ (TT133 tập hợp trực tiếp tại đây; TT200 kết chuyển từ 621, 622, 627).", debit: "Chi phí sản xuất phát sinh trong kỳ", credit: "Giá thành sản phẩm hoàn thành nhập kho (sang 155) hoặc bàn giao" },
  { code: "155", name: "Thành phẩm", category: "TaiSanNganHan", system: "CaHai", description: "Phản ánh trị giá hiện có và tình hình tăng, giảm các loại thành phẩm của doanh nghiệp.", debit: "Trị giá thành phẩm sản xuất hoàn thành nhập kho", credit: "Trị giá thành phẩm xuất kho bán hoặc chuyển giao" },
  { code: "156", name: "Hàng hóa", category: "TaiSanNganHan", system: "CaHai", description: "Phản ánh trị giá hiện có và tình hình tăng, giảm các loại hàng hóa mua về để bán.", debit: "Trị giá hàng hóa mua nhập kho", credit: "Trị giá hàng hóa xuất bán (giá vốn hàng bán - sang 632)" },

  // Loại 2: Tài sản dài hạn
  { code: "211", name: "Tài sản cố định hữu hình", category: "TaiSanDaiHan", system: "CaHai", description: "Phản ánh nguyên giá của TSCĐ hữu hình hiện có tại doanh nghiệp (nhà xưởng, máy móc, phương tiện).", debit: "Nguyên giá TSCĐ hữu hình tăng do mua sắm, xây dựng hoàn thành", credit: "Nguyên giá TSCĐ hữu hình giảm do thanh lý, nhượng bán" },
  { code: "214", name: "Hao mòn tài sản cố định", category: "TaiSanDaiHan", system: "CaHai", description: "Tài khoản điều chỉnh giảm tài sản (kết cấu ngược: tăng Có, giảm Nợ). Phản ánh giá trị hao mòn lũy kế của TSCĐ.", debit: "Giảm hao mòn TSCĐ khi thanh lý, nhượng bán", credit: "Trích khấu hao TSCĐ tính vào chi phí trong kỳ" },
  { code: "242", name: "Chi phí trả trước", category: "TaiSanDaiHan", system: "CaHai", description: "Phản ánh các chi phí thực tế đã phát sinh nhưng có liên quan đến kết quả hoạt động SXKD của nhiều kỳ kế toán (tiền thuê nhà xưởng nhiều kỳ, CCDC xuất dùng phân bổ dần...).", debit: "Chi phí trả trước phát sinh tăng", credit: "Phân bổ chi phí trả trước vào chi phí SXKD từng kỳ" },

  // Loại 3: Nợ phải trả
  { code: "331", name: "Phải trả cho người bán", category: "NoPhaiTra", system: "CaHai", description: "Tài khoản lưỡng tính: Phản ánh tình hình thanh toán về các khoản nợ phải trả cho người bán hàng hóa, dịch vụ.", debit: "Thanh toán tiền cho người bán, hoặc ứng trước tiền cho người bán", credit: "Số tiền phải trả người bán tăng khi mua hàng hóa, nhận dịch vụ chưa trả tiền" },
  { code: "333", name: "Thuế và các khoản phải nộp Nhà nước", category: "NoPhaiTra", system: "CaHai", description: "Phản ánh tình hình nghĩa vụ thuế và nộp các khoản thuế, phí, lệ phí với Ngân sách Nhà nước.", debit: "Số thuế, phí đã nộp vào NSNN", credit: "Số thuế, phí phải nộp phát sinh trong kỳ" },
  { code: "3331", name: "Thuế GTGT phải nộp", category: "NoPhaiTra", system: "CaHai", description: "Phản ánh số thuế GTGT đầu ra, số thuế GTGT phải nộp của hàng hóa, dịch vụ bán ra.", debit: "Khấu trừ thuế GTGT đầu vào hoặc nộp thuế GTGT vào NSNN", credit: "Thuế GTGT đầu ra phải nộp phát sinh khi bán hàng" },
  { code: "3334", name: "Thuế thu nhập doanh nghiệp", category: "NoPhaiTra", system: "CaHai", description: "Phản ánh số thuế TNDN phải nộp, đã nộp và còn phải nộp vào NSNN.", debit: "Số thuế TNDN đã tạm nộp hoặc nộp quyết toán vào NSNN", credit: "Số thuế TNDN phải nộp tính trên lợi nhuận chịu thuế" },
  { code: "3335", name: "Thuế thu nhập cá nhân", category: "NoPhaiTra", system: "CaHai", description: "Phản ánh số thuế TNCN khấu trừ từ thu nhập của người lao động phải nộp vào NSNN.", debit: "Số thuế TNCN đã nộp vào NSNN", credit: "Số thuế TNCN khấu trừ từ lương hoặc thu nhập phát sinh" },
  { code: "334", name: "Phải trả người lao động", category: "NoPhaiTra", system: "CaHai", description: "Phản ánh các khoản phải trả và tình hình thanh toán tiền lương, tiền công, phụ cấp cho người lao động.", debit: "Đã chi trả lương, tạm ứng lương, hoặc khấu trừ bảo hiểm, thuế TNCN", credit: "Tiền lương, tiền công, phụ cấp phải trả tính vào chi phí" },
  { code: "338", name: "Phải trả, phải nộp khác (BHXH, BHYT, BHTN, KPCĐ)", category: "NoPhaiTra", system: "CaHai", description: "Phản ánh các khoản phải trả về bảo hiểm xã hội (3383), BHYT (3384), BHTN (3386), kinh phí công đoàn (3382).", debit: "Nộp tiền bảo hiểm, KPCĐ cho cơ quan bảo hiểm", credit: "Trích bảo hiểm tính vào chi phí DN và trừ lương nhân viên" },
  { code: "341", name: "Vay và nợ thuê tài chính", category: "NoPhaiTra", system: "CaHai", description: "Phản ánh các khoản tiền vay ngân hàng, tổ chức, cá nhân và nợ thuê tài chính.", debit: "Trả nợ gốc tiền vay ngân hàng", credit: "Nhận tiền giải ngân vốn vay ngân hàng" },

  // Loại 4: Vốn chủ sở hữu
  { code: "411", name: "Vốn đầu tư của chủ sở hữu", category: "VonChuSoHuu", system: "CaHai", description: "Phản ánh vốn điều lệ đã thực góp của các thành viên, cổ đông.", debit: "Giảm vốn điều lệ (trả lại vốn, hủy cổ phiếu)", credit: "Góp vốn điều lệ tăng thêm" },
  { code: "421", name: "Lợi nhuận sau thuế chưa phân phối", category: "VonChuSoHuu", system: "CaHai", description: "Phản ánh kết quả kinh doanh (lãi, lỗ) sau thuế TNDN và tình hình phân chia lợi nhuận.", debit: "Số lỗ phát sinh trong kỳ hoặc phân phối lợi nhuận, chia cổ tức", credit: "Số lãi (lợi nhuận sau thuế) phát sinh trong kỳ" },

  // Loại 5: Doanh thu
  { code: "511", name: "Doanh thu bán hàng và cung cấp dịch vụ", category: "DoanhThu", system: "CaHai", description: "Phản ánh doanh thu bán hàng hóa, thành phẩm, bất động sản đầu tư và cung cấp dịch vụ (không có số dư cuối kỳ).", debit: "Các khoản giảm trừ doanh thu (521) và kết chuyển sang 911 để xác định kết quả", credit: "Doanh thu bán hàng và dịch vụ phát sinh trong kỳ" },
  { code: "515", name: "Doanh thu hoạt động tài chính", category: "DoanhThu", system: "CaHai", description: "Phản ánh tiền lãi gửi ngân hàng, cổ tức được chia, lãi chênh lệch tỷ giá.", debit: "Kết chuyển sang 911 để xác định kết quả kinh doanh", credit: "Doanh thu tài chính phát sinh trong kỳ" },

  // Loại 6: Chi phí sản xuất, kinh doanh
  { code: "632", name: "Giá vốn hàng bán", category: "ChiPhiSXKD", system: "CaHai", description: "Phản ánh trị giá vốn của sản phẩm, hàng hóa, dịch vụ đã bán trong kỳ.", debit: "Giá vốn hàng hóa, thành phẩm đã tiêu thụ trong kỳ", credit: "Kết chuyển giá vốn sang 911 để xác định kết quả kinh doanh" },
  { code: "635", name: "Chi phí tài chính", category: "ChiPhiSXKD", system: "CaHai", description: "Phản ánh chi phí lãi vay ngân hàng, lỗ chênh lệch tỷ giá.", debit: "Chi phí lãi vay, lỗ tỷ giá phát sinh trong kỳ", credit: "Kết chuyển chi phí tài chính sang 911" },
  { code: "641", name: "Chi phí bán hàng", category: "ChiPhiSXKD", system: "TT200", description: "Phản ánh các chi phí thực tế phát sinh trong quá trình bán sản phẩm, hàng hóa, cung cấp dịch vụ (vận chuyển, bao bì, lương nhân viên bán hàng...).", debit: "Chi phí bán hàng phát sinh trong kỳ", credit: "Kết chuyển chi phí bán hàng sang 911" },
  { code: "642", name: "Chi phí quản lý doanh nghiệp", category: "ChiPhiSXKD", system: "CaHai", description: "Phản ánh chi phí quản lý chung của doanh nghiệp (lương khối văn phòng, khấu hao TSCĐ văn phòng, văn phòng phẩm, tiếp khách...).", debit: "Chi phí quản lý DN phát sinh trong kỳ", credit: "Kết chuyển chi phí quản lý sang 911" },

  // Loại 8 & 9: Thu nhập/Chi phí khác & Xác định kết quả
  { code: "711", name: "Thu nhập khác", category: "DoanhThu", system: "CaHai", description: "Phản ánh các khoản thu nhập ngoài hoạt động SXKD thông thường (thanh lý TSCĐ, phạt vi phạm hợp đồng thu được...).", debit: "Kết chuyển sang 911", credit: "Thu nhập khác phát sinh" },
  { code: "811", name: "Chi phí khác", category: "ChiPhiKhac", system: "CaHai", description: "Phản ánh chi phí thanh lý TSCĐ, tiền phạt vi phạm hành chính, phạt hợp đồng kinh tế.", debit: "Chi phí khác phát sinh trong kỳ", credit: "Kết chuyển sang 911" },
  { code: "821", name: "Chi phí thuế thu nhập doanh nghiệp", category: "ChiPhiSXKD", system: "CaHai", description: "Phản ánh chi phí thuế TNDN hiện hành phát sinh trong năm.", debit: "Chi phí thuế TNDN phải nộp", credit: "Kết chuyển sang 911" },
  { code: "911", name: "Xác định kết quả kinh doanh", category: "XacDinhKQKD", system: "CaHai", description: "Tài khoản trung gian kết chuyển toàn bộ doanh thu (511, 515, 711) và chi phí (632, 635, 641, 642, 811, 821) để xác định lãi/lỗ đưa về 421 (không có số dư).", debit: "Kết chuyển chi phí và kết chuyển lãi sang 421", credit: "Kết chuyển doanh thu và kết chuyển lỗ sang 421" },
];

/**
 * Biểu thuế Thu nhập cá nhân (TNCN) lũy tiến từng phần đối với tiền lương, tiền công
 */
export const PIT_BRACKETS = [
  { level: 1, maxIncome: 5_000_000, rate: 0.05, subtractQuick: 0, desc: "Đến 5 triệu đồng: 5%" },
  { level: 2, maxIncome: 10_000_000, rate: 0.10, subtractQuick: 250_000, desc: "Trên 5 đến 10 triệu đồng: 10% (Trừ nhanh: 0.25 tr)" },
  { level: 3, maxIncome: 18_000_000, rate: 0.15, subtractQuick: 750_000, desc: "Trên 10 đến 18 triệu đồng: 15% (Trừ nhanh: 0.75 tr)" },
  { level: 4, maxIncome: 32_000_000, rate: 0.20, subtractQuick: 1_650_000, desc: "Trên 18 đến 32 triệu đồng: 20% (Trừ nhanh: 1.65 tr)" },
  { level: 5, maxIncome: 52_000_000, rate: 0.25, subtractQuick: 3_250_000, desc: "Trên 32 đến 52 triệu đồng: 25% (Trừ nhanh: 3.25 tr)" },
  { level: 6, maxIncome: 80_000_000, rate: 0.30, subtractQuick: 5_850_000, desc: "Trên 52 đến 80 triệu đồng: 30% (Trừ nhanh: 5.85 tr)" },
  { level: 7, maxIncome: Infinity, rate: 0.35, subtractQuick: 9_850_000, desc: "Trên 80 triệu đồng: 35% (Trừ nhanh: 9.85 tr)" },
];

/**
 * Mức giảm trừ gia cảnh thuế TNCN hiện hành
 */
export const PIT_DEDUCTIONS = {
  personal: 11_000_000, // Bản thân người nộp thuế: 11 triệu đồng/tháng (132 triệu/năm)
  dependent: 4_400_000, // Mỗi người phụ thuộc: 4.4 triệu đồng/tháng (52.8 triệu/năm)
  insuranceRates: {
    bhxh: 0.08, // BHXH: 8%
    bhyt: 0.015, // BHYT: 1.5%
    bhtn: 0.01, // BHTN: 1%
    totalWorker: 0.105, // Tổng người lao động đóng: 10.5%
    totalEmployer: 0.215, // Doanh nghiệp đóng: 21.5% (BHXH 17%, BHYT 3%, BHTN 1%, KPCĐ 2%)
  },
};

/**
 * Thuế suất Thuế Giá trị gia tăng (GTGT/VAT)
 */
export const VAT_RATES = {
  rate0: "0%: Áp dụng cho hàng hóa, dịch vụ xuất khẩu, vận tải quốc tế, hàng hóa thuộc diện không chịu thuế khi xuất khẩu.",
  rate5: "5%: Nước sạch phục vụ sinh hoạt, sản phẩm nông nghiệp sơ chế, thuốc chữa bệnh, thiết bị y tế, đồ dùng dạy học.",
  rate10: "10%: Thuế suất chuẩn áp dụng cho hầu hết hàng hóa, dịch vụ thông thường.",
  rateReduced8: "8%: Chính sách giảm 2% thuế GTGT (từ 10% xuống 8%) áp dụng cho nhiều nhóm hàng hóa, dịch vụ theo Nghị quyết của Quốc hội.",
};

/**
 * Thuế Thu nhập Doanh nghiệp (TNDN) & Lệ phí Môn bài
 */
export const CIT_AND_FEES = {
  citStandardRate: "20%: Thuế suất phổ thông cho toàn bộ doanh nghiệp.",
  citPreferentialRates: "10%, 15%, 17%: Áp dụng cho doanh nghiệp công nghệ cao, dự án đầu tư tại địa bàn kinh tế - xã hội đặc biệt khó khăn, lĩnh vực giáo dục, y tế, môi trường...",
  licenseFees: [
    { capital: "Vốn điều lệ trên 10 tỷ đồng", fee: "3.000.000 VNĐ/năm" },
    { capital: "Vốn điều lệ từ 10 tỷ đồng trở xuống", fee: "2.000.000 VNĐ/năm" },
    { capital: "Chi nhánh, VPĐD, địa điểm kinh doanh", fee: "1.000.000 VNĐ/năm" },
    { capital: "Doanh nghiệp mới thành lập năm đầu tiên", fee: "Miễn lệ phí môn bài năm đầu (Nghị định 22/2020/NĐ-CP)" },
  ],
};
