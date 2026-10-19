---
name: Tài chính Doanh nghiệp & FP&A (vn-corporate-finance)
description: "Phân tích tài chính doanh nghiệp và FP&A: lập kế hoạch ngân sách, mô hình dự báo dòng tiền 13 tuần, quản trị vốn lưu động (DSO, DPO, DIO), thẩm định dự án đầu tư (NPV, IRR), định giá chiết khấu dòng tiền (DCF, FCFF, FCFE, WACC) và phân tích độ nhạy theo kịch bản. Triggers: 'tài chính doanh nghiệp', 'dòng tiền', 'dự báo dòng tiền', 'dòng tiền 13 tuần', 'ngân sách', 'kế hoạch tài chính', 'npv', 'irr', 'wacc', 'dcf', 'định giá doanh nghiệp', 'vốn lưu động', 'dso', 'dpo', 'dio', 'fpa', 'ebitda'."
triggers: ['tài chính doanh nghiệp', 'dòng tiền', 'dự báo dòng tiền', 'dòng tiền 13 tuần', 'ngân sách', 'kế hoạch tài chính', 'npv', 'irr', 'wacc', 'dcf', 'định giá doanh nghiệp', 'vốn lưu động', 'dso', 'dpo', 'dio', 'fpa', 'ebitda']
---

# Phân tích Tài chính Doanh nghiệp & FP&A — v2.0

## 1. Mô hình Dự báo Dòng tiền 13 Tuần (13-Week Cash Flow)
Mô hình tiêu chuẩn vàng quản trị thanh khoản ngắn hạn trong tài chính doanh nghiệp:
- **Công thức cốt lõi**:
  $$\text{Tiền cuối tuần } (t) = \text{Tiền đầu tuần } (t) + \text{Dòng tiền thu vào} - \text{Dòng tiền chi ra} + \text{Tài trợ ròng}$$
  $$\text{Tiền đầu tuần } (t+1) = \text{Tiền cuối tuần } (t)$$
- **Quy tắc phân loại dòng tiền**:
  1. **Dòng tiền thu (Inflows)**: Thu tiền từ khách hàng theo lịch thanh toán thực tế (KHÔNG lấy doanh thu bán hàng kế toán), thu nợ khó đòi, hoàn thuế, thu tài chính.
  2. **Dòng tiền chi (Outflows)**: Chi trả nhà cung cấp (theo hạn nợ), chi lương & bảo hiểm người lao động, chi nộp thuế (GTGT, TNDN tạm nộp, TNCN), chi thuê mặt bằng, chi phí vận hành (OPEX), chi đầu tư tài sản (CAPEX).
  3. **Dòng tiền tài trợ (Financing)**: Giải ngân khoản vay mới đã được phê duyệt, trả nợ gốc vay, trả lãi vay ngân hàng.
- **Quy tắc nghiêm ngặt**:
  - Không ghi nhận khoản chuyển tiền nội bộ giữa các tài khoản của cùng doanh nghiệp là doanh thu hoặc chi phí.
  - Tách bạch rõ số tiền bị phong tỏa / hạn chế sử dụng (tiền ký quỹ, tiền bảo lãnh).
  - Xác định chính xác "Đỉnh thiếu hụt tiền mặt" (Cash deficit peak) để lên phương án huy động vốn lưu động hoặc đàm phán giãn nợ.

## 2. Quản trị Vốn Lưu động & Chu kỳ Chuyển đổi Tiền mặt (CCC)
- **Kỳ thu tiền bình quân (DSO - Days Sales Outstanding)**:
  $$\text{DSO} = \frac{\text{Phải thu khách hàng bình quân}}{\text{Tổng doanh thu bán chịu}} \times 365$$
- **Kỳ luân chuyển hàng tồn kho (DIO - Days Inventory Outstanding)**:
  $$\text{DIO} = \frac{\text{Hàng tồn kho bình quân}}{\text{Giá vốn hàng bán (COGS)}} \times 365$$
- **Kỳ trả nợ người bán (DPO - Days Payable Outstanding)**:
  $$\text{DPO} = \frac{\text{Phải trả người bán bình quân}}{\text{Tổng tiền mua hàng (hoặc COGS)}} \times 365$$
- **Chu kỳ chuyển đổi tiền mặt (Cash Conversion Cycle - CCC)**:
  $$\text{CCC} = \text{DIO} + \text{DSO} - \text{DPO}$$
  *(CCC càng ngắn chứng tỏ doanh nghiệp thu hồi vốn nhanh, tối ưu hóa dòng tiền và giảm áp lực vay vốn lưu động).*

## 3. Thẩm định Dự án Đầu tư & Định giá Doanh nghiệp
1. **Giá trị hiện tại thuần (NPV - Net Present Value)**:
   $$\text{NPV} = \sum_{t=0}^{n} \frac{\text{CF}_t}{(1 + r)^t}$$
   - $\text{NPV} > 0$: Dự án sinh lời, gia tăng giá trị cho doanh nghiệp.
   - $\text{NPV} < 0$: Dự án không đạt tỷ suất sinh lời kỳ vọng, loại bỏ.
2. **Tỷ suất hoàn vốn nội bộ (IRR - Internal Rate of Return)**:
   - Là mức lãi suất chiết khấu $r$ làm cho $\text{NPV} = 0$.
   - Nếu $\text{IRR} > \text{Chi phí sử dụng vốn (WACC)}$: Dự án khả thi.
3. **Chi phí sử dụng vốn bình quân (WACC)**:
   $$\text{WACC} = \frac{E}{V} \times R_e + \frac{D}{V} \times R_d \times (1 - T_c)$$
   *(Trong đó: $E$ là vốn chủ sở hữu, $D$ là nợ vay, $V = E + D$, $R_e$ là chi phí vốn CSH, $R_d$ là lãi suất nợ vay, $T_c$ là thuế suất thuế TNDN hiện hành 20%).*
4. **Định giá DCF (Chiết khấu dòng tiền)**:
   - **FCFF (Free Cash Flow to Firm)**: Dòng tiền tự do cho toàn doanh nghiệp $\rightarrow$ Chiết khấu theo **WACC** $\rightarrow$ Giá trị doanh nghiệp (EV) $\rightarrow$ Trừ nợ ròng để ra Giá trị vốn chủ sở hữu (Equity Value).
   - **FCFE (Free Cash Flow to Equity)**: Dòng tiền tự do cho chủ sở hữu $\rightarrow$ Chiết khấu theo **Chi phí vốn CSH ($R_e$)** $\rightarrow$ Giá trị vốn chủ sở hữu trực tiếp.

## 4. Phân tích Độ nhạy & Lập Kịch bản (Scenario Analysis)
Luôn xây dựng 3 kịch bản tài chính:
1. **Kịch bản cơ sở (Base Case)**: Dựa trên kế hoạch kinh doanh và tỷ lệ tăng trưởng dự kiến.
2. **Kịch bản xấu / Tiêu cực (Downside / Stress Case)**: Doanh thu giảm 15-30%, thời gian thu tiền khách hàng kéo dài thêm 30 ngày, lãi suất vay tăng 1-2%, chi phí đầu vào tăng.
3. **Kịch bản thuận lợi (Upside Case)**: Tăng trưởng vượt kỳ vọng, tối ưu chi phí.
Mục tiêu là xác định mức độ chịu đựng tối đa của doanh nghiệp và kế hoạch dự phòng vốn an toàn.
