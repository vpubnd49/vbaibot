# Chuẩn bị triển khai AI ngân hàng theo TT53/2026

Nguồn bản ký: https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/10/53-nhnn.signed.pdf
Phạm vi đã đọc: Điều 1, 3–5 (trang 1–2, 4–7), Điều 18–20 (trang 17–20), Điều 22–24 (trang 21–22). Đây là tài liệu chuẩn bị tại 12/10/2026; chưa xác nhận toàn bộ hệ thống đáp ứng luật nền về AI, dữ liệu, an ninh mạng và văn bản liên quan.

## Xác định phạm vi trước khi lập yêu cầu
Theo Điều 1, phân biệt AI ra/hỗ trợ quyết định trong nghiệp vụ cung cấp dịch vụ khách hàng với AI phục vụ quản trị/điều hành nội bộ (khuyến khích áp dụng). Dịch vụ AI bên thứ ba chỉ là công cụ hỗ trợ cá nhân, không tích hợp vào quy trình nghiệp vụ/hệ thống thông tin thuộc đối tượng áp dụng, không thuộc phạm vi điều chỉnh của Thông tư. Việc cài skill vào Antigravity không tự đủ kết luận ứng dụng thuộc phạm vi; thu chức năng, cách tích hợp và đối tượng dùng trước.

## Mốc cần lưu trong cấu hình
Điều 23: hiệu lực chung 15/11/2026; Điều 14 từ 01/01/2027; điểm b khoản 1 Điều 6 từ 01/09/2027; Điều 21 từ 01/09/2027, ngoại trừ đơn vị có hệ thống AI rủi ro cao. Điều 24: hệ thống đã đưa vào vận hành chính thức trước hiệu lực phải tuân thủ các chương II–IV từ 01/03/2027. Đọc phối hợp các khoản cho từng yêu cầu; không suy ra một hạn duy nhất cho cả hệ thống.
Lưu ngày go-live gốc, mức rủi ro, chức năng, version, lịch thay đổi và từng yêu cầu để chọn mốc đúng. Chưa tới hiệu lực có thể triển khai chuẩn bị kiểm soát, nhưng không mô tả mọi yêu cầu là nghĩa vụ hiện hành.

## Đặc tả từ các điều đã đọc
| Căn cứ | Nội dung cần đối chiếu | Kiểm soát kỹ thuật đề xuất |
|---|---|---|
| Điều 3 | Trách nhiệm đơn vị, khả năng giám sát/can thiệp | Chủ sở hữu nghiệp vụ, audit, nút dừng, rollback; không đổ trách nhiệm cho model |
| Điều 4 | Phân loại rủi ro trước triển khai, phê duyệt và cập nhật danh mục | AI inventory theo chức năng/version; tái phân loại khi thay chức năng/tích hợp |
| Điều 5 | Điều kiện tự động hóa, can thiệp và phân biệt giao dịch AI/con người | Luồng quyền và hạn mức ở server; kiểm thử tạm dừng/chấm dứt, actor_type |
| Điều 18 | Thuê ngoài không làm mất trách nhiệm; giám sát nhà cung cấp/hợp đồng | Quản lý nhà cung cấp, dữ liệu gửi model, bằng chứng đánh giá và exit plan |
| Điều 19 | Quản lý chuỗi cung ứng và nguồn gốc thành phần | Danh mục thư viện/model/dữ liệu, version/hash/license và cảnh báo lỗ hổng |
| Điều 20 | Thông báo tương tác AI; xử lý khiếu nại và giải thích | Nhãn tương tác, case khiếu nại, đánh giá lại của người và decision trace |
| Điều 22 | Hồ sơ/tiêu chí/kế hoạch trước vận hành | Bộ hồ sơ có version, test an ninh/model, kế hoạch sự cố/phục hồi và quyết định có thẩm quyền |

Theo Điều 4, ngưỡng nhận diện một số hệ thống rủi ro cao khác với hạn mức hoạt động tại Điều 5. Ví dụ ngưỡng khoản cấp tín dụng **từ 50 triệu** của hệ thống tự động quyết định là tiêu chí phân loại; không phải quyền tự cấp mọi khoản dưới 50 triệu. Không hardcode quyền sản xuất chỉ từ một ngưỡng.
Bộ skill không cấp quyền tự phê duyệt tín dụng hoặc chuyển tiền. Nếu dự án yêu cầu tự động hóa thực tế, làm rõ nghiệp vụ và xây kiểm soát phù hợp toàn bộ căn cứ/quy chế, hoàn thành đặc tả/code/test trước bước quyết định triển khai theo quyền người dùng và đơn vị.
