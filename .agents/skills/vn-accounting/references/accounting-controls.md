# Checklist theo phần hành

## Chứng từ và bút toán
Kiểm tra pháp nhân, mã chứng từ, ngày chứng từ/ngày ghi sổ, đối tác, nội dung, tiền tệ, cơ sở tính và chứng từ hỗ trợ. Khoản thuế và giá trước/sau thuế phải được phân biệt. Bút toán nhiều dòng phải cân ở cấp journal_id; tổng toàn file cân có thể che bút toán sai.
Chứng từ nhập nhiều lần: lập nhóm nghi trùng theo nhiều khóa và trình kiểm tra; giữ cả dữ liệu nguồn. Hóa đơn điều chỉnh/thay thế cần liên kết bản gốc để không đếm hai lần.

## Công nợ và đối soát ngân hàng
Lập tuổi nợ theo ngày chốt và ngày đến hạn, không dùng ngày phát hành thay ngày đến hạn nếu chưa thống nhất. Tách chưa đến hạn, quá hạn, tranh chấp và khoản chưa phân bổ. Đối chiếu xác nhận đối tác nếu có.
Đối soát số dư ngân hàng với sổ; tách tiền đang chuyển, phí/lãi, giao dịch chưa hạch toán và sai lệch. Không đánh dấu khớp chỉ vì số dư tổng bằng nhau. Dùng ../vn-banking/references/workflows.md cho ghép giao dịch.

## Tồn kho và tài sản
Kiểm tra số lượng đầu+nhập-xuất=cuối theo mã/kho/đơn vị. Kiểm tra kỳ và phương pháp tính giá được đơn vị áp dụng; tách hạch toán số lượng với giá trị và dự phòng. Không tự đổi phương pháp giữa kỳ.
Với tài sản, xác định điều kiện ghi nhận, ngày sẵn sàng sử dụng, nguyên giá, giá trị còn lại, thời gian/phương pháp khấu hao; đối chiếu chính sách kế toán và quy định thuế riêng. Không tự mặc định một thời gian khấu hao cho mọi tài sản.

## Khóa sổ
Đối chiếu tiền, công nợ, tồn kho, tài sản, lương, thuế, giao dịch nội bộ và khoản dồn tích. Kiểm tra cắt kỳ, giao dịch sau kỳ, ngoại tệ, phân bổ và điều chỉnh. Từng công việc có nguồn, người lập, người soát xét, ngoại lệ và trạng thái.
Khóa kỳ phải kiểm tra lại phía máy chủ trong giao dịch ghi sổ. Mở lại kỳ có quyền riêng và nhật ký; không chỉ ẩn nút giao diện.

## Báo cáo
Xác nhận phạm vi riêng lẻ/hợp nhất, đơn vị trình bày và kỳ so sánh. Ánh xạ tài khoản sang chỉ tiêu có phiên bản. Đối chiếu bảng cân đối và biến động tiền; trình bày ngoại lệ thay vì ép cân bằng một số cắm thêm. Không dùng cờ kiểm tra để làm đầu vào số liệu báo cáo.
