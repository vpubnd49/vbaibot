# Cài bộ skill vào Antigravity

Bộ phiên bản 2.0.0, soạn ngày 12/10/2026. Đối tượng chính: người phân tích nghiệp vụ và người viết ứng dụng cho ngân hàng, kế toán, thuế, tài chính doanh nghiệp tại Việt Nam. Đây là hướng dẫn tác nghiệp cho AI, không phải ứng dụng đã có chức năng, cơ sở dữ liệu pháp luật đầy đủ hoặc dịch vụ cập nhật tự động.

## Sáu skill
| Tên thư mục | Công việc |
|---|---|
| vn-finance-core | Chọn nghiệp vụ, kiểm chứng nguồn và kỳ áp dụng |
| vn-banking | Tín dụng, lãi vay, lịch nợ, đối soát, KYC/AML |
| vn-accounting | Chứng từ, định khoản dự thảo, công nợ, khóa sổ |
| vn-tax | GTGT, TNDN, TNCN, hóa đơn, đối chiếu và chuẩn bị kê khai |
| vn-corporate-finance | Ngân sách, dòng tiền 13 tuần, kịch bản, NPV và định giá |
| vn-finance-app-builder | Đặc tả, dữ liệu, API, quyền, code và test phần mềm |

## Cài theo dự án, cách khuyến nghị
1. Giải nén gói vào một thư mục tạm.
2. Mở thư mục gốc dự án đang dùng trong Antigravity.
3. Sao chép sáu thư mục bên trong `.agents/skills/` của gói vào `.agents/skills/` của dự án. Giữ cả sáu vì có tham chiếu tương đối tới skill dùng chung. Không tạo nhầm `.agents/skills/.agents/skills/`.
4. Nếu tên skill đã tồn tại, so sánh và sao lưu bản cũ trước khi thay; không ghi đè các skill khác.
5. Mở cuộc trò chuyện mới trong dự án. Với IDE, kiểm tra danh sách ở Customizations của agent side panel. Nếu chưa thấy, kiểm tra đúng workspace và đường dẫn, rồi tải lại cửa sổ.
6. Gõ: “Dùng skill vn-finance-core. Liệt kê các skill nghiệp vụ trong bộ và xác nhận đọc được tài liệu tham chiếu.”

Đường dẫn ví dụ Windows sau cài: `D:\DuAnTaiChinh\.agents\skills\vn-tax\SKILL.md`. Trong File Explorer, bật hiển thị tệp/thư mục ẩn nếu không thấy `.agents` sau giải nén.

## Cài toàn cục, chỉ nếu muốn dùng cho mọi dự án
Tài liệu Antigravity IDE/2.0 đang ghi đường dẫn `~/.gemini/config/skills/`; Windows thường tương ứng `%USERPROFILE%\.gemini\config\skills\`. Chép sáu thư mục skill vào đó. CLI có đường dẫn toàn cục riêng `~/.gemini/antigravity-cli/skills/`. Cài theo workspace ở trên giúp tránh khác biệt giữa các bề mặt.
Không cần cài plugin, không có API key mặc định. `agents/openai.yaml` là metadata cho môi trường tương thích khác, không phải điều kiện bắt buộc của Antigravity. `SKILL.md` là điểm vào.
Nguồn định dạng và vị trí: https://antigravity.google/docs/skills (đã đọc 12/10/2026). Nếu bản cài trên máy có khác biệt, đối chiếu tài liệu theo phiên bản.

## Cách sử dụng
Nêu tên skill trong yêu cầu thông thường. Tài liệu Antigravity 2.0/CLI cũng mô tả `/<skill-name>`; không cần phụ thuộc slash command để sử dụng các tệp này.

### Phân tích ngân hàng
“Dùng vn-banking. Kiểm tra lịch trả nợ trong tệp tôi cung cấp. Nêu quy ước ngày, lãi suất và dữ liệu thiếu trước khi tính. Chưa thực hiện thao tác nào trên ngân hàng.”

### Kế toán
“Dùng vn-accounting. Rà soát bảng cân đối phát sinh và sổ chi tiết tháng này. Hỏi tôi chế độ kế toán nếu chưa xác định. Xuất danh sách chênh lệch và bút toán đề xuất, chưa ghi sổ.”

### Thuế
“Dùng vn-tax. Rà soát GTGT kỳ [kỳ cụ thể] cho [loại người nộp]. Đọc chứng từ, tra cứu nguồn chính thức, tách phần đủ căn cứ và phần cần bổ sung; không tự mặc định thuế suất.”

### Tài chính
“Dùng vn-corporate-finance. Lập dự báo dòng tiền 13 tuần từ dữ liệu giả lập, ba kịch bản. Nêu rõ thu, chi, tài trợ và tuần thiếu tiền; công thức phải kiểm tra được.”

### Viết ứng dụng trên Antigravity
“Dùng vn-finance-app-builder và vn-accounting. Trong dự án hiện tại, xây module đối soát sao kê với sổ ngân hàng bằng dữ liệu giả lập. Trước tiên đọc stack và quy tắc dự án; đặc tả ghép giao dịch, trường hợp mơ hồ, quyền, lịch sử và tổng kiểm soát. Sau đó code một luồng hoàn chỉnh và chạy test. Chưa kết nối ngân hàng thật.”

### Phần mềm thuế
“Dùng vn-finance-app-builder và vn-tax. Xây chức năng quản lý quy tắc thuế theo ngày hiệu lực, nguồn và người duyệt. Chưa có nguồn hợp lệ thì để DRAFT và chặn phát hành kết quả thuế chính thức. Không hardcode thuế suất.”

## Tùy chỉnh cho đơn vị
Chuẩn bị bản mô tả pháp nhân/loại tổ chức, chế độ kế toán, kỳ, tiền tệ, quy chế duyệt, mẫu báo cáo và cấu trúc dữ liệu. Cho agent đọc bản ẩn danh trước; chỉ cấp dữ liệu thật, quyền và kết nối trong phạm vi được phép. Bổ sung chính sách riêng vào dự án, có phiên bản/người xác nhận; không biến chúng thành quy định chung cho mọi tổ chức.

## Giới hạn kiểm chứng
Bộ đã kiểm tra cấu trúc và helper số học; chưa chạy trong Antigravity trên máy của người dùng, chưa kết nối core banking/eTax, chưa chứng nhận đáp ứng pháp luật cho một tổ chức cụ thể. Có chỉ mục 24 nguồn và bản trích trang của 15 văn bản đã đọc điều khoản chọn lọc; xem references/research-coverage.md. Không tự cập nhật: mỗi lần dùng luật cần tra cứu lại nguồn và chuỗi sửa đổi cho kỳ liên quan. Hành chính sự nghiệp, tài chính công, bảo hiểm, chứng khoán, hợp nhất/IFRS chuyên sâu cần bộ mở rộng theo yêu cầu.

## Kiểm tra helper tùy chọn
Python 3, chỉ dùng thư viện chuẩn. Từ thư mục `vn-finance-core/scripts`, chạy `python -m unittest discover -p "test_*.py" -v`. Chạy `python finance_checks.py --help` để xem CLI. Dùng assets/preflight-input-template.json cho helper kiểm tra quy tắc; template cố ý chưa đủ căn cứ và sẽ bị chặn đến khi có hồ sơ thực. Helper không truy cập mạng, không chứng nhận đúng luật hoặc quyền người duyệt.
Các tham số tiền và tỷ lệ trong JSON nên là chuỗi thập phân; helper cố ý từ chối float, số không hữu hạn và dữ liệu thiếu. Script không làm tròn cuối cùng thay hợp đồng/chính sách của đơn vị.

## Nâng cấp từ v1
Sao lưu cả sáu thư mục cũ ra ngoài đường dẫn skill đang được IDE tìm thấy. Thay đúng sáu thư mục bằng bộ v2; giữ nguyên tên để tránh agent đọc trùng phiên bản. Lưu riêng tùy chỉnh của đơn vị rồi đối chiếu trước khi đưa lại; không chép nguyên SKILL.md v1 đè lên v2. Mở cuộc trò chuyện mới và yêu cầu agent đọc research-coverage.md, đếm nguồn và nêu phạm vi đã nghiên cứu.

Gói không biến Antigravity thành phần mềm kế toán/thuế đã triển khai. Dùng skill app-builder để viết module trong dự án hiện có, kiểm thử nghiệp vụ và tích hợp theo quyền đã được cấp.
