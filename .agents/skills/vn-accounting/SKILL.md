---
name: Kế toán Doanh nghiệp Việt Nam (vn-accounting)
description: "Hỗ trợ kế toán doanh nghiệp Việt Nam: kiểm tra chứng từ, định khoản dự thảo Nợ/Có, đối chiếu sổ cái, lập BCTC, khóa sổ, chuyển đổi chế độ kế toán theo Thông tư 99/2025/TT-BTC thay thế Thông tư 200/2014 và Thông tư 133/2016. Triggers: 'kế toán', 'định khoản', 'chứng từ', 'bảng cân đối', 'báo cáo tài chính', 'bctc', 'sổ cái', 'khóa sổ', 'thông tư 99', 'thông tư 200', 'thông tư 133', 'hạch toán', 'nợ có', 'bút toán', 'bảng cân đối kế toán', 'kết quả kinh doanh'."
triggers: ['kế toán', 'định khoản', 'chứng từ', 'bảng cân đối', 'báo cáo tài chính', 'bctc', 'sổ cái', 'khóa sổ', 'thông tư 99', 'thông tư 200', 'thông tư 133', 'hạch toán', 'nợ có', 'bút toán', 'bảng cân đối kế toán', 'kết quả kinh doanh']
---

# Kế toán Doanh nghiệp Việt Nam — v2.0 (Cập nhật Khung 2026)

## 1. Khung Pháp lý Chế độ Kế toán Trọng yếu
1. **Thông tư số 99/2025/TT-BTC** (Hiệu lực 01/01/2026, áp dụng cho năm tài chính bắt đầu từ hoặc sau 01/01/2026):
   - **Phạm vi áp dụng**: Hướng dẫn chứng từ, hệ thống tài khoản, sổ kế toán và lập/trình bày Báo cáo tài chính (BCTC) cho doanh nghiệp thuộc mọi lĩnh vực, mọi thành phần kinh tế tại Việt Nam (riêng TCTD/chi nhánh ngân hàng nước ngoài áp dụng theo quy định của NHNN).
   - **Thay thế Thông tư 200/2014/TT-BTC**: Thay thế TT 200/2014, TT 75/2015, TT 53/2016, TT 195/2012 (có ngoại lệ khoản 2 Điều 31 về cổ phần hóa).
   - **Đối với Doanh nghiệp Vừa và Nhỏ (SME)**: Doanh nghiệp nhỏ và vừa được lựa chọn áp dụng TT 99/2025/TT-BTC hoặc TT 133/2016/TT-BTC; khi lựa chọn phải áp dụng nhất quán tối thiểu trong 01 năm tài chính và có thuyết minh số liệu so sánh.
   - **Nguyên tắc chuyển tiếp (Điều 29–30)**: Chuyển đổi số dư tài khoản theo bảng ánh xạ cụ thể; tách bạch ảnh hưởng do thay đổi chính sách kế toán, ước tính kế toán và sửa chữa sai sót; không áp dụng hồi tố cơ học khi chưa đối chiếu quy định.
   - **Tiêu chuẩn Phần mềm Kế toán (Điều 28)**: Bắt buộc đảm bảo tính toàn vẹn dữ liệu, lưu vết chỉnh sửa (audit trail) theo thời gian, ngăn chặn hành vi can thiệp sửa đổi số liệu phi pháp, có khả năng khóa sổ kỳ kế toán và xuất dữ liệu kiểm tra.
2. **Thông tư số 43/2026/TT-BTC**: Quy định phương pháp lập và trình bày Báo cáo tài chính hợp nhất (sửa đổi TT 202/2014/TT-BTC, áp dụng từ năm tài chính bắt đầu từ hoặc sau 01/01/2026).

## 2. Nguyên tắc Định khoản & Đối chiếu Bút toán (Nợ / Có)
1. **Cân đối số học bắt buộc**:
   - $\sum \text{Phát sinh Nợ} = \sum \text{Phát sinh Có}$ trong từng giao dịch và trên toàn bảng cân đối phát sinh.
   - $\text{Số dư cuối kỳ} = \text{Số dư đầu kỳ} + \text{Phát sinh tăng} - \text{Phát sinh giảm}$.
   - Cân đối số học là điều kiện cần nhưng **CHƯA ĐỦ** để kết luận định khoản đúng; bắt buộc kiểm tra bản chất kinh tế và chứng từ hợp lệ.
2. **Hệ thống Tài khoản Tiêu biểu**:
   - **Loại 1 & 2 (Tài sản)**: Tăng Nợ, Giảm Có (ngoại trừ TK điều chỉnh giảm như 214 - Hao mòn TSCĐ: Tăng Có, Giảm Nợ).
   - **Loại 3 & 4 (Nợ phải trả & Vốn chủ sở hữu)**: Tăng Có, Giảm Nợ (TK 131, 331 là tài khoản lưỡng tính).
   - **Loại 5 & 7 (Doanh thu & Thu nhập)**: Tăng Có, Kết chuyển sang 911 bên Nợ (không có số dư cuối kỳ).
   - **Loại 6 & 8 (Chi phí)**: Tăng Nợ, Kết chuyển sang 911 bên Có (không có số dư cuối kỳ).
   - **Tài khoản 911 (Xác định kết quả kinh doanh)**: Tập hợp Doanh thu (bên Có) và Chi phí (bên Nợ), kết chuyển lãi sang Có TK 421 hoặc lỗ sang Nợ TK 421.

## 3. Quy trình Kiểm soát Chứng từ & Khóa sổ Kế toán
1. **Kiểm tra 5 yếu tố chứng từ**:
   - (1) Tính có thực của nghiệp vụ kinh tế phát sinh.
   - (2) Đầy đủ chữ ký, con dấu của các bên có thẩm quyền.
   - (3) Hóa đơn điện tử hợp pháp theo đúng quy định mới (NĐ 254/2026, TT 91/2026).
   - (4) Chứng từ thanh toán không dùng tiền mặt (bắt buộc với hóa đơn từ 05 triệu đồng trở lên theo NĐ 144/2026 và thuế TNDN).
   - (5) Ngày tháng, số tiền bằng số và bằng chữ khớp đúng.
2. **Tách biệt Kế toán và Thuế**:
   - Lợi nhuận kế toán trước thuế $\neq$ Thu nhập tính thuế TNDN.
   - Khoản chi phí không được trừ theo luật thuế TNDN (tiền phạt, chi phí không có hóa đơn hợp lệ, chi phí vượt định mức...) vẫn phải hạch toán đầy đủ vào chi phí kế toán thực tế (loại 6, loại 8), sau đó thực hiện **điều chỉnh tăng thu nhập chịu thuế trên tờ khai quyết toán thuế TNDN (chỉ tiêu B4)**.
   - Tuyệt đối không xóa bỏ chứng từ kế toán thật để "khớp" với số thuế.

## 4. Các Sai lầm Thường gặp Cần Tránh
- Tự tiện tạo mã tài khoản mới không theo danh mục quy định.
- Trộn lẫn tài khoản của doanh nghiệp với tài khoản ngân hàng hoặc hành chính sự nghiệp.
- Mặc định áp dụng TT 200 cũ cho năm tài chính 2026 mà không kiểm tra quy định chuyển tiếp sang TT 99/2025.
- Sửa đổi số liệu thực tế để gượng ép bảng cân đối; các khoản sai lệch phải hạch toán vào tài khoản chờ xử lý (TK 1381, 3381) kèm giải trình rõ nguyên nhân.
