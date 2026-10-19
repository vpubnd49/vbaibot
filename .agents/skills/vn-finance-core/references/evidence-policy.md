# Chính sách bằng chứng và kỳ áp dụng — v2

## Phân loại
- `DISCOVERY_ONLY`: mới tìm thấy tên/URL; không đủ kết luận.
- `METADATA_READ`: đọc số, ngày, loại, trích yếu; chưa xác nhận điều khoản.
- `PROVISION_READ`: đã đọc vị trí được ghi trong chỉ mục; chỉ xác nhận nội dung đã đọc, không cả văn bản hoặc chuỗi sửa đổi.
- `VERIFIED_FOR_CASE`: mở nguồn và chuỗi sửa đổi liên quan, đối chiếu đối tượng, sự kiện, thời gian và chứng từ của một hồ sơ cụ thể.
Trạng thái bằng chứng độc lập với trạng thái văn bản (ban hành/dự thảo/tương lai/hết hiệu lực) và trạng thái workflow (DRAFT/APPROVED). Không tự nâng trạng thái vì có chữ “chính thức” trong tên file.

## Quy trình kiểm tra căn cứ
1. Xác định loại tổ chức, vấn đề và sự kiện làm phát sinh nghĩa vụ; thu đủ các mốc ngày/kỳ liên quan.
2. Mở bản ký hoặc Công báo/CSDL quốc gia/nguồn cơ quan ban hành. Đọc điều kiện, ngoại lệ, phụ lục và thi hành/chuyển tiếp. Snippet và metadata chỉ để tìm nguồn.
3. Tìm sửa đổi/thay thế/bãi bỏ, đính chính và văn bản hướng dẫn cho chính vấn đề đó đến ngày đánh giá. Ghi phạm vi truy vấn; không tuyên bố chưa có sửa đổi chỉ vì tìm kiếm không ra.
4. Khi hai nguồn khác nhau, đọc bản gốc, kiểm tra loại văn bản và thời điểm; ghi xung đột cần xử lý. Không đơn thuần chọn file mới nhất hoặc văn bản có số lớn nhất.
5. Ghi URL, số văn bản, điều/khoản, trang PDF gốc (đánh số từ 1), ngày tải/kiểm tra, hash nếu có và kết luận theo hồ sơ.
6. OCR là bản hỗ trợ tra cứu; số tiền, ngày, ký hiệu, bảng và ngoại lệ phải đối chiếu ảnh/PDF gốc trước khi đưa vào quy tắc. Không coi OCR là bản pháp luật có thẩm quyền.

## Thời gian
Tách `issued_at`, `document_effective_from`, `rule_effective_from`, `application_basis`, `observed_at`, `checked_at`. Ngày hiệu lực metadata không thay Điều thi hành. Luật có thể áp dụng cho kỳ trước ngày ban hành; cần ghi rõ căn cứ hồi tố và xử lý đã kê khai/nộp. Phân biệt phân tích hiện nay cho giao dịch quá khứ với tái dựng thông tin đã biết ở một ngày quá khứ.
Văn bản tương lai: được dùng cho kế hoạch chuẩn bị, không dùng làm nghĩa vụ hiện hành trước mốc. Dự thảo: chỉ dùng so sánh chính sách, không dùng tính chính thức.

## Từ nghiên cứu đến vận hành
Các thẻ trong gói là nghiên cứu có phạm vi. Trước kết luận cuối hoặc phát hành quy tắc sản xuất, kiểm tra lại hồ sơ và nguồn cho đúng vấn đề. Với phần thiếu căn cứ, xuất kịch bản có giả định và tiếp tục phần số học/đối chiếu được phép.
Chu kỳ 30 ngày trong helper là chính sách mẫu cho độ mới của kiểm tra, không phải thời hạn do luật quy định và không chứng minh nguồn vẫn đúng trong 30 ngày. Thay theo chính sách dự án; luôn kiểm tra lại khi có thay đổi được biết.
Không nói “đã cập nhật toàn bộ luật mới nhất”, “được chứng nhận tuân thủ” hoặc “đã nộp hồ sơ” khi chưa có bằng chứng tương ứng.
