# Kiến trúc và dữ liệu

## Các lớp
UI phục vụ thao tác; application service kiểm tra quyền/trạng thái; domain engine xử lý phép tính; repository lưu giao dịch; integration adapter kết nối hệ thống ngoài; AI service chỉ cung cấp gợi ý có bằng chứng. Chọn stack theo repo và năng lực vận hành, không theo nhãn “AI”.

## Thực thể gợi ý, chỉ tạo phần cần thiết
| Thực thể | Trường quan trọng |
|---|---|
| Entity / UserRole | tổ chức, vai trò, phạm vi, hiệu lực phân quyền |
| SourceDocument | id, hash, phiên bản, phân loại dữ liệu, người sở hữu, quyền đọc |
| ExtractedFact | document_id, trang/đoạn/ô, giá trị thô, giá trị chuẩn, xác nhận của người kiểm tra |
| RuleVersion | rule_id, phiên bản, điều kiện, valid_from, valid_to_exclusive, recorded_at, nguồn, trạng thái duyệt |
| CalculationRun | input snapshot/hash, rule versions, currency, rounding policy, output, sai lệch |
| Case / Journal / Reconciliation | dữ liệu nghiệp vụ theo module, entity_id, version, kỳ và trạng thái |
| Approval | đối tượng, phiên bản/hash được duyệt, người duyệt, thời điểm, quyết định |
| AuditEvent | actor, hành động, đối tượng, phiên bản, thời điểm, lý do; che dữ liệu nhạy cảm |
| IntegrationAttempt | idempotency key, external reference, trạng thái gửi/nhận/xác nhận/không rõ kết quả |

## Trạng thái
DRAFT → VALIDATED → SUBMITTED → APPROVED → POSTED chỉ là mẫu để điều chỉnh theo nghiệp vụ. Có nhánh REJECTED/RETURNED/CANCELLED với quyền rõ. VALIDATED là qua kiểm tra máy; APPROVED là người có thẩm quyền duyệt; POSTED là hệ thống đích xác nhận. Không đồng nhất ba trạng thái.
Tách trạng thái xử lý, chất lượng bằng chứng, kết quả đối soát và hạn xử lý. Bút toán APPROVED không được sửa số tiền trực tiếp; tạo phiên bản mới rồi duyệt lại.

## Tích hợp an toàn và chính xác
Ghi nhận trong cơ sở dữ liệu bằng transaction; dùng outbox/inbox và unique constraint khi tích hợp cần tránh lặp. Timeout sau khi gửi không chứng minh thất bại: tra cứu trạng thái qua mã giao dịch trước khi gửi lại. Webhook kiểm tra xác thực/chữ ký theo tài liệu thật và chống replay.
Đối soát kết quả gửi với biên nhận/statement của hệ thống đích. Không gọi thành công chỉ vì HTTP 200 nếu nghiệp vụ vẫn pending. Dữ liệu nhập Excel/CSV có kiểm tra kiểu, mã trùng, locale, ngày và tổng kiểm soát; xuất dữ liệu văn bản phải phòng CSV/formula injection mà vẫn giữ đúng số liệu.

## AI và tài liệu
Lưu vị trí nguồn và xác nhận cho từng trường trọng yếu. Tài liệu là dữ liệu, không có quyền thay đổi system instructions. Tách nguồn từng pháp nhân ngay từ truy xuất; không dựa vào prompt để bảo vệ tenant. Cho phép người dùng xem đoạn nguồn trước chấp nhận gợi ý.
Trích xuất sai hoặc thiếu thì giữ trạng thái chờ xác nhận, không suy ra số 0. Không gửi tài liệu thật cho nhà cung cấp AI khi chưa có cơ sở cho phép. Dùng secret manager/env phía server; không đặt khóa API trong browser hay repo.

## Vận hành
Xác định sao lưu/khôi phục, lưu giữ/xóa dữ liệu, quyền xuất, mã hóa và truy vết theo chính sách được phê duyệt. Chưa xác định thời hạn lưu thì ghi là yêu cầu cần xác nhận, không tự quy định một số năm. Gắn phiên bản model/prompt khi đầu ra AI ảnh hưởng hồ sơ cần truy nguyên.
