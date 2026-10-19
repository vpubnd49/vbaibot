/**
 * finance-knowledge.ts
 *
 * Tri thức chuyên sâu Bộ Kỹ năng Tài chính - Kế toán - Ngân hàng - Thuế Việt Nam (Cập nhật Khung 2026).
 *
 * Nguồn: Tổng hợp từ Bộ 6 Kỹ năng Tài chính Việt Nam (.agents/skills/vn-finance-*), bao gồm:
 * 1. Điều phối Tài chính & Thẩm định căn cứ (vn-finance-core)
 * 2. Nghiệp vụ Ngân hàng & Tín dụng (vn-banking) - TT 29/2026/TT-NHNN, TT 27/2025/TT-NHNN AML
 * 3. Kế toán Doanh nghiệp & Chuyển đổi chế độ (vn-accounting) - TT 99/2025/TT-BTC, TT 200, TT 133
 * 4. Chính sách Thuế & Hóa đơn Điện tử (vn-tax) - Luật 109/2025 TNCN, NĐ 141/2026, NQ 43/2026, NĐ 144/2026 VAT, NĐ 254/2026 HĐĐT
 * 5. Tài chính Doanh nghiệp & FP&A (vn-corporate-finance) - Dòng tiền 13 tuần, CCC, DCF/WACC/NPV/IRR
 * 6. Xây dựng Ứng dụng Tài chính - Kế toán (vn-finance-app-builder) - Rule engine, Decimal, Audit trail
 */

export const FINANCE_KNOWLEDGE_PROMPT = `
## HỆ THỐNG TRI THỨC NGHIỆP VỤ TÀI CHÍNH - KẾ TOÁN - NGÂN HÀNG - THUẾ VIỆT NAM (KHUNG 2026)

Áp dụng quy chuẩn tra cứu, tư vấn và tính toán tài chính - kế toán - thuế theo các trụ cột sau:

---

### I. CHÍNH SÁCH THUẾ & HÓA ĐƠN ĐIỆN TỬ (VN-TAX)

1. **Thuế Thu nhập Cá nhân (TNCN) — Luật số 109/2025/QH15 (Áp dụng từ kỳ tính thuế 2026 đối với cá nhân cư trú):**
   - **Mức giảm trừ gia cảnh (Điều 10):**
     * Bản thân người nộp thuế: **15.500.000 VNĐ/tháng** (186.000.000 VNĐ/năm).
     * Mỗi người phụ thuộc: **6.200.000 VNĐ/tháng/người** (74.400.000 VNĐ/năm).
     *(Lưu ý: Quyết toán các năm trước 2026 áp dụng mức cũ: Bản thân 11 triệu, Người phụ thuộc 4.4 triệu).*
   - **Biểu thuế lũy tiến từng phần 5 bậc mới (Điều 9):**
     * Bậc 1: Đến 10 triệu đồng/tháng (đến 120 tr/năm): **5%** (Trừ nhanh: 0).
     * Bậc 2: Trên 10 đến 30 triệu đồng/tháng (120–360 tr/năm): **10%** (Trừ nhanh: 0,5 tr).
     * Bậc 3: Trên 30 đến 60 triệu đồng/tháng (360–720 tr/năm): **20%** (Trừ nhanh: 3,5 tr).
     * Bậc 4: Trên 60 đến 100 triệu đồng/tháng (720–1.200 tr/năm): **30%** (Trừ nhanh: 9,5 tr).
     * Bậc 5: Trên 100 triệu đồng/tháng (trên 1.200 tr/năm): **35%** (Trừ nhanh: 14,5 tr).
   - **Bảo hiểm bắt buộc trừ vào lương:** BHXH 8%, BHYT 1.5%, BHTN 1% (Tổng NLĐ đóng: 10.5%).

2. **Chính sách Miễn / Giảm Thuế năm 2026:**
   - **Nghị quyết số 43/2026/QH16:** Giảm **30%** số thuế TNCN phải nộp của cá nhân kinh doanh cư trú và **30%** số thuế TNDN phải nộp của doanh nghiệp thành lập theo PL Việt Nam có doanh thu năm không quá 10 tỷ đồng trong kỳ 2026–2027 (giảm trên số thuế phải nộp sau ưu đãi).
   - **Nghị định số 141/2026/NĐ-CP:** Nâng ngưỡng doanh thu miễn thuế của hộ/cá nhân kinh doanh lên **01 tỷ đồng/năm**. Miễn thuế TNDN cho doanh nghiệp có tổng doanh thu năm từ **01 tỷ đồng trở xuống** (Điều 2 sửa NĐ 320/NĐ-CP).

3. **Thuế Giá trị gia tăng (GTGT) & Mua hàng Trả chậm — Nghị định 144/2026/NĐ-CP:**
   - Mua hàng hóa, dịch vụ trả chậm/trả góp từ **05 triệu đồng** trở lên: Khi chưa đến hạn thanh toán theo hợp đồng, doanh nghiệp vẫn được kê khai khấu trừ thuế GTGT bình thường.
   - Đến hạn thanh toán mà chưa có chứng từ thanh toán không dùng tiền mặt: Phải kê khai điều chỉnh giảm số thuế GTGT đã khấu trừ; khi có chứng từ thực tế thì kê khai khấu trừ lại vào kỳ thanh toán.

4. **Hóa đơn Điện tử — Nghị định số 254/2026/NĐ-CP & Thông tư 91/2026/TT-BTC (từ 01/07/2026):**
   - Thay thế toàn diện NĐ 123/2020/NĐ-CP và TT 78/2021/TT-BTC.
   - Sai tên, địa chỉ người mua nhưng đúng MST: Người bán gửi thông báo Mẫu 04/SS đến CQT, không cần lập lại hóa đơn.
   - Sai MST, số tiền, thuế suất, quy cách: Lập hóa đơn điều chỉnh hoặc thay thế có thỏa thuận văn bản. Tuyệt đối không xóa bỏ hóa đơn gốc.

---

### II. CHẾ ĐỘ KẾ TOÁN DOANH NGHIỆP (VN-ACCOUNTING)

1. **Thông tư số 99/2025/TT-BTC (Áp dụng cho năm tài chính bắt đầu từ hoặc sau 01/01/2026):**
   - Thay thế Thông tư 200/2014/TT-BTC, TT 75/2015, TT 53/2016, TT 195/2012 cho toàn bộ doanh nghiệp tại Việt Nam.
   - Doanh nghiệp nhỏ và vừa (SME) được lựa chọn áp dụng TT 99/2025 hoặc TT 133/2016 (nhất quán tối thiểu 01 năm tài chính).
   - **Điều 28 TT 99/2025:** Phần mềm kế toán bắt buộc phải lưu vết sửa đổi (audit trail), bảo mật, khóa sổ theo kỳ và chống can thiệp số liệu phi pháp.

2. **Nguyên tắc Bút toán Kép (Nợ / Có):**
   - Tổng Phát sinh Nợ = Tổng Phát sinh Có. Số dư cuối kỳ = Số dư đầu kỳ + Phát sinh tăng - Phát sinh giảm.
   - Tài sản (Loại 1, 2) & Chi phí (Loại 6, 8): Tăng Nợ, Giảm Có.
   - Nợ phải trả (Loại 3), Vốn CSH (Loại 4), Doanh thu (Loại 5, 7): Tăng Có, Giảm Nợ.
   - Tài khoản 911 (Xác định KQKD): Tập hợp Doanh thu (Có) và Chi phí (Nợ) để kết chuyển lãi (Có 421) hoặc lỗ (Nợ 421).
   - Tách biệt rõ: Lợi nhuận kế toán khác với Thu nhập tính thuế TNDN (các khoản chi phí không được trừ theo luật thuế TNDN vẫn hạch toán vào chi phí kế toán, sau đó điều chỉnh tăng thu nhập chịu thuế trên chỉ tiêu B4 tờ khai quyết toán TNDN).

---

### III. NGHIỆP VỤ NGÂN HÀNG & TÍN DỤNG (VN-BANKING)

1. **Cho vay & Xử lý Nợ — Thông tư số 29/2026/TT-NHNN (Hiệu lực 15/08/2026, sửa TT 39/2016/TT-NHNN):**
   - Khoản vay giá trị nhỏ: Tối đa **200 triệu đồng** tại Quỹ tín dụng nhân dân; tối đa **400 triệu đồng** tại các TCTD khác.
   - Thứ tự thu nợ (Điều 4): TCTD và khách hàng thỏa thuận; riêng đối với **khoản nợ quá hạn: BẮT BUỘC thu nợ gốc trước, thu nợ lãi sau**.
   - Hợp đồng ký trước 15/08/2026 tiếp tục theo nội dung đã ký; phụ lục sửa đổi ký từ 15/08/2026 phải tuân theo TT 29/2026.

2. **Lãi suất & Lãi phạt (BLDS 2015 & TT 39/2016):**
   - Lãi quá hạn trên nợ gốc: Tối đa **150%** lãi suất cho vay trong hạn.
   - Lãi chậm trả nợ lãi: Tối đa **10%/năm** tính trên số dư lãi chậm trả.
   - Quy ước ngày: Thực tế / 365 ngày (Actual/365).

3. **Phòng, chống Rửa tiền (AML) — Thông tư số 27/2025/TT-NHNN:**
   - Ngưỡng báo cáo chuyển tiền điện tử (Điều 9): Trong nước từ **500 triệu đồng** trở lên; quốc tế từ **1.000 USD** (hoặc ngoại tệ tương đương) trở lên.
   - Phân loại rủi ro khách hàng thành 3 mức: Thấp, Trung bình, Cao.

4. **Hệ số Khả năng Trả nợ (DSCR):**
   - Công thức: DSCR = Dòng tiền thuần HĐKD (hoặc EBITDA - Thuế) / (Gốc phải trả + Lãi vay phải trả).
   - DSCR từ 1,25 trở lên: Ngưỡng an toàn tín dụng.

---

### IV. TÀI CHÍNH DOANH NGHIỆP & FP&A (VN-CORPORATE-FINANCE)

1. **Dự báo Dòng tiền 13 Tuần (13-Week Cash Flow):**
   - Tiền cuối tuần (t) = Tiền đầu tuần (t) + Tiền thu vào - Tiền chi ra + Tài trợ ròng.
   - Lập theo ngày tiền về/ra thực tế, KHÔNG lấy doanh thu bán hàng dồn tích thay thế cho tiền thu.
   - Tách biệt dòng tiền bị hạn chế/phong tỏa và giao dịch chuyển tiền nội bộ.

2. **Quản trị Vốn Lưu động & Chu kỳ Chuyển đổi Tiền mặt (CCC):**
   - DSO (Kỳ thu tiền bình quân), DIO (Kỳ tồn kho), DPO (Kỳ trả tiền người bán).
   - Công thức: CCC = DIO + DSO - DPO (Tối ưu hóa nhằm giảm phụ thuộc vốn vay lưu động).

3. **Thẩm định Dự án & Định giá (DCF / NPV / IRR / WACC):**
   - NPV = Tổng các dòng tiền CF(t) / (1 + r)^t từ t = 0 đến n; NPV > 0 là dự án khả thi.
   - WACC: Chi phí sử dụng vốn bình quân giữa Vốn CSH (Re) và Nợ vay sau thuế (Rd × (1 - Tc)).
   - FCFF (chiết khấu theo WACC ra Enterprise Value) vs FCFE (chiết khấu theo Re ra Equity Value).

---

### V. NGUYÊN TẮC XÂY DỰNG ỨNG DỤNG & TÍNH TOÁN (VN-FINANCE-APP-BUILDER)

1. **Số học Chính xác (Decimal):**
   - Mọi số tiền, thuế suất, lãi suất phải dùng thư viện Decimal (hoặc kiểu DECIMAL trong SQL). CẤM dùng float/number để tính tiền tệ.
2. **Quy tắc có Phiên bản theo Thời gian (Temporal Rules):**
   - Tuyệt đối không hardcode thuế suất hoặc ngưỡng chính sách cố định. Quản lý theo 'valid_from', 'valid_to', 'legal_reference'.
3. **Bảo toàn Dấu vết & Bất biến (Audit Trail):**
   - Dữ liệu kế toán, giao dịch ngân hàng, hóa đơn một khi đã khóa sổ thì không hard delete, chỉ sửa đổi qua bút toán điều chỉnh.
`;
