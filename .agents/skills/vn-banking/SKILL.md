---
name: Nghiệp vụ Ngân hàng & Tín dụng (vn-banking)
description: "Hỗ trợ nghiệp vụ ngân hàng Việt Nam: hồ sơ tín dụng, lãi vay, lịch trả nợ, đối soát sao kê tài khoản, KYC/AML phòng chống rửa tiền, chuyển tiếp hợp đồng theo TT 29/2026 và TT 27/2025. Triggers: 'ngân hàng', 'lãi vay', 'tín dụng', 'lịch trả nợ', 'sao kê', 'đối soát', 'kyc', 'aml', 'chuyển tiền điện tử', 'rửa tiền', 'vay vốn', 'hợp đồng tín dụng', 'lãi suất quá hạn', 'dscr'."
triggers: ['ngân hàng', 'lãi vay', 'tín dụng', 'lịch trả nợ', 'sao kê', 'đối soát', 'kyc', 'aml', 'chuyển tiền điện tử', 'rửa tiền', 'vay vốn', 'hợp đồng tín dụng', 'lãi suất quá hạn', 'dscr']
---

# Nghiệp vụ Ngân hàng & Tín dụng Việt Nam — v2.0 (Cập nhật 2026)

## 1. Khung Pháp lý Trọng yếu 2026
1. **Thông tư số 29/2026/TT-NHNN** (Hiệu lực 15/08/2026, sửa đổi Thông tư 39/2016/TT-NHNN về cho vay):
   - **Khoản vay giá trị nhỏ**: Không vượt quá **200 triệu đồng** tại Quỹ tín dụng nhân dân; không vượt quá **400 triệu đồng** tại các TCTD khác.
   - **Thứ tự thu nợ (Điều 4)**: TCTD và khách hàng thỏa thuận thứ tự thu nợ gốc, nợ lãi. Riêng đối với **khoản nợ vay quá hạn: BẮT BUỘC thu nợ gốc trước, thu nợ lãi sau**.
   - **Chuyển tiếp hợp đồng (Điều 10)**: Thỏa thuận/Hợp đồng tín dụng ký trước ngày 15/08/2026 tiếp tục thực hiện theo nội dung đã ký phù hợp với quy định tại thời điểm ký kết. Mọi nội dung sửa đổi, bổ sung ký từ ngày 15/08/2026 bắt buộc phải tuân theo quy định tại Thông tư 29/2026/TT-NHNN.
2. **Thông tư số 27/2025/TT-NHNN** (Hiệu lực 01/11/2025, thay thế TT 09/2023/TT-NHNN về Phòng, chống rửa tiền - AML/KYC):
   - **Báo cáo chuyển tiền điện tử (Điều 9)**: Giao dịch chuyển tiền điện tử trong nước có giá trị từ **500.000.000 VNĐ** (hoặc ngoại tệ tương đương) trở lên; giao dịch chuyển tiền điện tử quốc tế từ **1.000 USD** (hoặc ngoại tệ tương đương) trở lên phải báo cáo Cục Phòng, chống rửa tiền NHNN.
   - **Phân loại rủi ro khách hàng (Điều 4)**: Khách hàng được phân loại theo 3 mức độ rủi ro: Thấp, Trung bình, Cao.
   - **Kỳ đánh giá rủi ro tổ chức (Điều 3)**: Thu thập số liệu 01/01–31/12 hằng năm; hoàn thành báo cáo cập nhật chậm nhất 31/03 năm kế tiếp.
3. **Bộ luật Dân sự 2015 & Quy tắc tính lãi**:
   - **Lãi suất cho vay trong hạn**: Theo thỏa thuận giữa TCTD và khách hàng theo cơ chế thị trường.
   - **Lãi quá hạn nợ gốc**: Thỏa thuận nhưng không vượt quá **150%** lãi suất cho vay trong hạn tại thời điểm chuyển nợ quá hạn.
   - **Lãi chậm trả tiền lãi**: Tối đa **10%/năm** tính trên số dư lãi chậm trả tương ứng với thời gian chậm trả.
   - **Quy ước đếm ngày (Day-count convention)**: Tính theo số ngày thực tế duy trì số dư nợ / 365 ngày (Actual/365) trừ khi hợp đồng quy định cụ thể khác.

## 2. Thẩm định Tín dụng & Chỉ số Khả năng Trả nợ (DSCR)
Khi phân tích hồ sơ vay vốn doanh nghiệp/cá nhân:
- **Tách biệt nguồn trả nợ**: Tài sản bảo đảm (BĐS, sổ tiết kiệm, máy móc) chỉ là biện pháp dự phòng thứ cấp; nguồn trả nợ tiên quyết và cốt lõi là **dòng tiền thực tế từ hoạt động kinh doanh hoặc thu nhập thường xuyên**.
- **Chỉ số DSCR (Debt Service Coverage Ratio)**:
  $$\text{DSCR} = \frac{\text{Dòng tiền thuần từ HĐKD (hoặc EBITDA - Thuế)}}{\text{Nợ gốc phải trả trong kỳ} + \text{Lãi vay phải trả trong kỳ}}$$
  - $\text{DSCR} \ge 1.25 - 1.30$: Ngưỡng an toàn, đảm bảo khả năng trả nợ tốt khi có biến động.
  - $1.0 \le \text{DSCR} < 1.25$: Vùng rủi ro vừa, cần giám sát chặt chẽ.
  - $\text{DSCR} < 1.0$: Dòng tiền thâm hụt, không đủ trả gốc lãi, rủi ro nợ xấu cao.

## 3. Quy trình Đối soát Sao kê & Giao dịch Thanh toán
Quy trình đối soát tự động giữa sổ phụ ngân hàng và sổ cái doanh nghiệp:
1. **Khớp chính xác (Exact match)**: Ghép theo Mã giao dịch duy nhất (FT / Transaction ID / FT code).
2. **Khớp xác suất (Candidate match)**: Ghép theo bộ 3: [Số tiền chính xác + Ngày giao dịch trong khoảng $\pm 1$ ngày + Số tài khoản đối ứng].
3. **Phân loại ngoại lệ**:
   - Giao dịch đang chờ xử lý (Pending / In-transit: TK 115).
   - Giao dịch đảo / hoàn tiền (Reversal / Refund).
   - Phí dịch vụ ngân hàng tự động trừ (hạch toán TK 642/635).
   - Lệch số dư do chênh lệch múi giờ giao dịch cuối tháng.

## 4. Các Lưu ý Quan trọng
- Không tự suy diễn phân loại nhóm nợ (1 đến 5) theo chuẩn quốc tế IFRS 9 thay thế cho phân loại nợ pháp định của NHNN (Thông tư 11/2021/TT-NHNN).
- Hợp đồng tín dụng ký trước 15/08/2026 nếu không phát sinh phụ lục sửa đổi thì giữ nguyên cơ chế cũ; nếu sửa đổi điều khoản thì điều khoản sửa đổi phải theo TT 29/2026.
