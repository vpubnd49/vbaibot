---
name: Điều phối Tài chính Việt Nam (vn-finance-core)
description: "Điều phối nghiệp vụ liên ngành ngân hàng, kế toán, thuế, tài chính Việt Nam; xác định kỳ áp dụng, kiểm chứng căn cứ pháp lý và dữ liệu đầu vào. Triggers: 'tài chính', 'nghiệp vụ tài chính', 'hồ sơ tài chính', 'chế độ tài chính', 'phân tích tài chính', 'finance', 'tài chính kế toán ngân hàng thuế'."
triggers: ['tài chính', 'nghiệp vụ tài chính', 'hồ sơ tài chính', 'chế độ tài chính', 'phân tích tài chính', 'finance', 'tài chính kế toán ngân hàng thuế']
---

# Điều phối Phân tích & Tra cứu Tài chính Việt Nam — v2.0 (Cập nhật 2026)

## 1. Vai trò và Phạm vi điều phối
Skill trung tâm điều phối tổng thể nghiệp vụ Tài chính - Kế toán - Ngân hàng - Thuế tại Việt Nam:
- **Tín dụng, lãi vay, lịch trả nợ, KYC/AML, thanh toán, đối soát sao kê**: Phối hợp cùng `vn-banking`.
- **Chứng từ, định khoản dự thảo, hạch toán, khóa sổ, BCTC (TT 200, TT 133, TT 99/2025)**: Phối hợp cùng `vn-accounting`.
- **GTGT, TNDN, TNCN, hóa đơn điện tử, đối chiếu khấu trừ, hồ sơ kê khai thuế**: Phối hợp cùng `vn-tax`.
- **Ngân sách, dự báo dòng tiền 13 tuần, kịch bản, định giá DCF/NPV/IRR, vốn lưu động**: Phối hợp cùng `vn-corporate-finance`.
- **Đặc tả kỹ thuật, schema cơ sở dữ liệu, API, engine nghiệp vụ, rule engine**: Phối hợp cùng `vn-finance-app-builder`.

## 2. Nguyên tắc Khởi tạo Hồ sơ & Nhận diện Bối cảnh
Trước khi kết luận bất kỳ tình huống tài chính nào, bắt buộc xác định rõ:
1. **Loại hình chủ thể**: Doanh nghiệp lớn, SME, Doanh nghiệp siêu nhỏ, Hộ kinh doanh cá thể, Cá nhân cư trú / không cư trú, Tổ chức tín dụng, hay Đơn vị HCSN.
2. **Kỳ áp dụng & Mốc thời gian**:
   - Năm tài chính (bắt đầu 01/01 hay kỳ lệch).
   - Kỳ tính thuế (tháng/quý/năm).
   - Ngày phát sinh giao dịch, ngày ký hợp đồng gốc, ngày ký phụ lục sửa đổi (đặc biệt các mốc chuyển tiếp 2026).
3. **Chế độ kế toán & Tiền tệ**: TT 200/2014, TT 133/2016 hay Thông tư 99/2025/TT-BTC; đơn vị tiền tệ giao dịch và đồng tiền ghi sổ (VND).
4. **Quy tắc xử lý dữ liệu thiếu**:
   - TUYỆT ĐỐI KHÔNG tự tiện gán giá trị thiếu thành `0` hoặc tự bịa thông số.
   - Nêu rõ giả định và tách phần đã đủ căn cứ tính toán độc lập với phần cần người dùng bổ sung.

## 3. Quy chuẩn Thẩm định Căn cứ Pháp lý & Chống Ảo giác
1. **Trích dẫn có tọa độ**: Mọi kết luận pháp lý phải gắn liền với tọa độ: `[Tên văn bản] [Số hiệu] – Điều X, Khoản Y, Điểm Z`.
2. **Phân định rõ 4 mốc thời gian**:
   - Ngày ban hành văn bản.
   - Ngày có hiệu lực thi hành chung.
   - Kỳ áp dụng cụ thể của từng điều khoản (nhiều luật hiệu lực giữa năm nhưng điều khoản thuế áp dụng từ đầu năm tài chính).
   - Ngày văn bản được tra cứu/kiểm chứng.
3. **Phân tầng nội dung minh bạch**: Tách bạch rõ 3 tầng:
   - (A) Điều luật nguyên văn trích dẫn.
   - (B) Diễn giải logic của AI.
   - (C) Khuyến nghị quản trị / kiểm soát nội bộ cho người dùng.
4. **Quy tắc số học Decimal**: Mọi phép tính số tiền, lãi suất, tỷ lệ thuế phải dùng số học chính xác (tránh lỗi làm tròn dấu phẩy động float).

## 4. Cấu trúc Trả kết quả Tiêu chuẩn
Mọi câu trả lời tư vấn/tra cứu tài chính tổng hợp phải theo cấu trúc:
1. **Kết luận trọng tâm (có điều kiện áp dụng)**: Tóm tắt 2-3 câu ngắn gọn câu trả lời.
2. **Bảng số liệu & Đối chiếu chi tiết**: Phân rã từng dòng thu, chi, nợ, thuế, lãi suất.
3. **Căn cứ pháp lý & Mốc chuyển tiếp**: Trích dẫn cụ thể luật, nghị định, thông tư điều chỉnh.
4. **Các yếu tố rủi ro & Dữ liệu cần bổ sung**: Những điểm người dùng cần lưu ý xác minh.
5. **Hành động nghiệp vụ tiếp theo**: Các bước tiếp theo cần triển khai.
