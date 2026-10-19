# Nhánh nghiệp vụ thuế

## GTGT và hóa đơn
Xác định phương pháp tính và bản chất giao dịch; nhận diện giá trước/sau thuế, kỳ, hàng hóa dịch vụ, điều chỉnh, thay thế, hàng trả lại. Kiểm tra điều kiện đầu vào, phân bổ sử dụng, chứng từ và quy định thanh toán liên quan. Chỉ dùng công thức thuế đầu ra trừ thuế đầu vào đủ điều kiện khi phương pháp và điều kiện phù hợp; không áp cho mọi người nộp.
Đối chiếu theo mã hóa đơn và liên kết điều chỉnh/thay thế; không đếm bản gốc và bản thay thế như hai doanh thu. Không coi tệp PDF là bằng chứng hệ thống thuế đã xác nhận trạng thái hóa đơn.

## TNDN
Lập cầu nối từ lợi nhuận kế toán đến cơ sở tính thuế. Phân loại điều chỉnh tăng/giảm, thu nhập miễn, chuyển lỗ, ưu đãi và khoản đã tạm nộp theo căn cứ phù hợp. Không cộng hai lần cùng khoản điều chỉnh. Phân biệt chi phí thuế hiện hành, hoãn lại và dòng tiền nộp thuế; chỉ xử lý hoãn lại khi có chuẩn mực và dữ liệu đủ.

## TNCN
Xác định cư trú, loại thu nhập, kỳ và cách khấu trừ/quyết toán. Kiểm tra tổng thu nhập, khoản không tính thuế/miễn, giảm trừ, người phụ thuộc, bảo hiểm và dữ liệu các nơi chi trả nếu cần. Không áp một biểu lũy tiến cho mọi loại thu nhập hoặc mọi tình trạng cư trú. Không hardcode mức giảm trừ chưa xác minh theo kỳ.

## Kê khai và thời hạn
Phân biệt hạn nộp hồ sơ, hạn nộp tiền, kỳ kê khai, gia hạn và quy tắc ngày nghỉ. Lưu cơ sở tính hạn cùng ngày sự kiện; không suy ra mọi sắc thuế có chung lịch. Nêu trạng thái “chuẩn bị” cho hồ sơ chưa có biên nhận nộp thành công.

## Thuế phức tạp
Thuế nhà thầu, giao dịch liên kết, thuế quốc tế, chuyển nhượng, thuế tối thiểu và các ưu đãi dự án cần nhánh nghiên cứu riêng: hợp đồng, dòng tiền, quốc gia, hiệp định, quan hệ liên kết và kỳ. Không áp máy móc công thức của GTGT/TNDN nội địa. Nếu thiếu thì lập danh sách vấn đề và căn cứ cần kiểm tra.

## Phiên bản quy tắc
Lưu valid_from/valid_to (khoảng áp dụng), recorded_at (ngày ghi nhận), loại đối tượng, điều kiện và source_id. Xác định rõ khoảng ngày có bao gồm hai đầu hay không. Thiếu hoặc trùng nhiều quy tắc phù hợp phải trả NEEDS_REVIEW, không chọn mức thấp nhất hay mới nhất. Mọi thay đổi có người kiểm tra và kiểm thử kỳ trước/trong/sau hiệu lực.
