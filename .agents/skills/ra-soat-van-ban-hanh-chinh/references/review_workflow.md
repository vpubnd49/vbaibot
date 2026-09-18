# Quy trình rà soát 7 lớp

## 1. Nguồn và nhận dạng

Xác định:
- loại văn bản;
- cơ quan ban hành;
- chức danh ký;
- đối tượng nhận;
- mục tiêu;
- căn cứ trực tiếp;
- mốc thời gian.

Kiểm tra từng số hiệu, ngày, trích yếu và cơ quan ban hành.

## 2. Logic giao nhiệm vụ

Tạo ma trận:

`chủ trì | phối hợp | hành động | sản phẩm | thời hạn | nơi nhận | nguồn dữ liệu | trách nhiệm`

Kiểm tra:
- có hơn một đầu mối chủ trì không;
- phối hợp có rõ không;
- sản phẩm có xác định không;
- luồng báo cáo có đúng nguồn không;
- có dữ liệu để tổng hợp không.

### Bẫy báo cáo

Nếu có:
> “theo dõi, đôn đốc, tổng hợp; định kỳ/đột xuất tham mưu báo cáo”

thì phải tìm được nguồn thông tin.

Nếu đồng thời có:
> “không yêu cầu báo cáo riêng”

mà không có cơ chế lấy dữ liệu, đánh dấu `should_fix` hoặc `must_fix` tùy mức ảnh hưởng.

Câu an toàn:
> “Việc tổng hợp sử dụng thông tin, số liệu từ các chế độ báo cáo hiện hành và dữ liệu do cơ quan, đơn vị cung cấp; trường hợp chưa đáp ứng yêu cầu tổng hợp, cơ quan đầu mối đề nghị cung cấp, cập nhật bổ sung; hạn chế tối đa phát sinh chế độ báo cáo riêng.”

Không dùng `định kỳ` nếu không có kỳ báo cáo/căn cứ.

## 3. Đối chiếu chuỗi hồ sơ

Nếu có góp ý:
`ý kiến gốc ↔ bảng tiếp thu ↔ dự thảo cuối`

Kiểm tra:
- ghi “Tiếp thu” nhưng bản cuối không sửa;
- chỉ tiếp thu một phần nhưng ghi “Tiếp thu”;
- thêm nội dung vượt góp ý;
- bỏ cụm từ cốt lõi.

Nếu văn bản đã ký trước giao một sở làm đầu mối, kiểm tra dự thảo mới có làm mất vai trò đó hay không.

## 4. Câu cú, chính tả

Kiểm tra:
- chính tả;
- dấu câu;
- câu quá dài;
- chủ thể không rõ;
- liệt kê không song song;
- thuật ngữ/viết tắt;
- lặp ý;
- lỗi ký tự.

## 5. Thể thức

Dùng `nd30_checklist.md`.
Nếu có DOCX/PDF, kiểm tra trực quan.

## 6. Thẩm quyền và tính phù hợp

Kiểm tra động từ có phù hợp thẩm quyền:
`nghiên cứu → xây dựng → trình → ban hành → tổ chức thực hiện`

Phân biệt:
- `chủ trì thực hiện` và `tham mưu thực hiện`;
- `báo cáo trực tiếp` và `tham mưu báo cáo`;
- `xây dựng` và `ban hành`;
- `rà soát, đề xuất` và `quyết định`.

## 7. QA trước trình ký

Tự hỏi:

1. Số hiệu/ngày đã đối chiếu nguồn chưa?
2. Có sửa câu làm đổi bản chất nhiệm vụ không?
3. Có đầu mối chủ trì rõ không?
4. Báo cáo có nguồn dữ liệu không?
5. Luồng báo cáo có mâu thuẫn không?
6. Thời hạn có hợp lý không?
7. Tiếp thu có đi vào bản cuối không?
8. Có nội dung vượt nguồn không?
9. Còn lỗi chính tả/dấu câu không?
10. Khối ký/nơi nhận/thể thức có đúng không?
11. Vai trò cơ quan có bị thay đổi so với văn bản trước không?
12. Có điểm nào dễ khiến văn bản bị trả lại không?

## 8. Quy trình đối chiếu văn bản triển khai cấp dưới so với cấp trên (Cross-Level Implementation Review)

Áp dụng khi đối chiếu dự thảo văn bản của UBND tỉnh/huyện/xã với Quyết định, Kế hoạch, Chỉ thị của Thủ tướng Chính phủ, Chính phủ hoặc Bộ, ngành Trung ương.

### Chuỗi tư duy 5 bước (Cognitive Chain of Thought):
1. **Xác định bản chất & trích yếu:**
   - Dự thảo là văn bản "Giao một sở làm đầu mối tham mưu kế hoạch" hay "Trực tiếp phân công nhiệm vụ cho toàn hệ thống"?
   - Trích yếu có bao quát đúng nội dung không?
2. **Lọc độ phủ nhiệm vụ (Coverage Filter):**
   - Rà soát toàn bộ nhiệm vụ của cấp địa phương trong văn bản cấp trên:
     + Nhiệm vụ địa phương **chủ trì thực hiện** (quán triệt, rà soát văn bản, công bố TTHC, kiện toàn bộ máy...).
     + Nhiệm vụ địa phương **phối hợp tham gia với TW** (góp ý dự thảo Nghị định, Thông tư...).
   - Tuyệt đối không bê nhiệm vụ của Bộ ngành TW thành trách nhiệm của tỉnh.
3. **Thẩm quyền và quan hệ hành chính thể chế:**
   - Cơ quan thuộc hệ thống UBND (Sở, Ban, ngành, cấp xã): dùng từ chỉ đạo *"Giao", "Yêu cầu"*.
   - Cơ quan không thuộc hệ thống UBND (Tòa án nhân dân, Viện kiểm sát nhân dân, Ủy ban MTTQ, Đoàn thể): bắt buộc dùng từ quan hệ phối hợp *"Đề nghị", "Phối hợp"*.
   - Phạm vi rà soát văn bản: Phải theo ngành/lĩnh vực để kiến nghị cấp có thẩm quyền (kể cả cấp TW), không được co hẹp chỉ rà soát văn bản do tỉnh ban hành.
4. **Mốc thời gian 2 tầng & Tính chu kỳ:**
   - Tầng 1: Thời hạn TW ấn định (Deadline pháp lý).
   - Tầng 2: Mốc địa phương chủ động đặt ra sớm hơn để tạo khoảng đệm (buffer) cho Sở tổng hợp và UBND tỉnh xem xét trước khi báo cáo TW.
   - Không gộp nhiệm vụ ngắn hạn (hội nghị, quán triệt) với nhiệm vụ thường xuyên dài hạn (tuyên truyền, phổ biến).
5. **Chu trình quản trị & Kinh phí ngân sách:**
   - Nhiệm vụ không dừng ở "lập kế hoạch", phải có "tổ chức thực hiện".
   - Phải có cơ chế tổng hợp khó khăn, vướng mắc, sơ kết, tổng kết.
   - Kinh phí: Cơ quan chủ trì nhiệm vụ lập dự toán chi thường xuyên hằng năm; Sở Tài chính thẩm định tham mưu bố trí theo Luật Ngân sách nhà nước.

### Cấu trúc báo cáo kết quả chuẩn:
1. **Nhận định sơ bộ (Executive Summary):** Khẳng định đã đọc toàn bộ văn bản nguồn và đối chiếu dự thảo; chốt ngay kết luận tổng quan (độ bám sát, có cần viết lại hay chỉ chỉnh sửa cục bộ).
2. **Bảng ma trận đối chiếu 3 cột:** `[Nội dung trong dự thảo | Căn cứ trong văn bản cấp trên | Đánh giá / Nhận xét chuyên môn]`.
3. **Các điểm cần chỉnh sửa, bổ sung:** Từng tiểu mục chỉ rõ: Hiện trạng $\rightarrow$ Căn cứ cấp trên $\rightarrow$ Phân tích điểm vênh/rủi ro $\rightarrow$ Đề xuất câu chữ chỉnh sửa (actionable wording).
4. **Đánh giá kỹ thuật văn bản & Thể thức NĐ 30:** Trích yếu, quan hệ thể chế (đề nghị vs giao), ký hiệu kết thúc `./.`, khối ký, nơi nhận và khuyến nghị lựa chọn phương án trình ký.
