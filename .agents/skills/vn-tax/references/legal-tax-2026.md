# Căn cứ thuế và chuyển tiếp đã nghiên cứu — 12/10/2026

## Cách đọc
Các thẻ dưới đây tóm tắt điều khoản đã đọc, chưa phải quy tắc đã duyệt cho hồ sơ cụ thể. URL và hash bản tải ở `../../vn-finance-core/references/legal-register.json`. Trang là trang PDF gốc, đếm từ 1. Phải kiểm tra tiếp các sửa đổi/hướng dẫn mới và dữ liệu của người nộp trước khi kết luận. Ký hiệu **Kiểm soát đề xuất** là cách thiết kế ứng dụng, không phải trích luật.

## T01 — Luật Quản lý thuế 108/2025/QH15
Đã đọc Điều 51–53, trang 64–65. Điều 52 đặt hiệu lực chung 01/07/2026, nhưng Điều 13 và việc sử dụng hóa đơn điện tử của hộ/cá nhân kinh doanh tại Điều 26 có mốc 01/01/2026. Luật 38/2019 hết hiệu lực theo Điều 52, có ngoại lệ chuyển tiếp.
Điều 53: khoản miễn/giảm/không thu phát sinh trước 01/07/2026 tiếp tục xử lý theo luật cũ; nợ thuế đến 30/06/2026 xử lý theo luật mới; cuộc kiểm tra có quyết định trước hiệu lực nhưng chưa kết luận/quyết định xử lý tiếp tục theo luật cũ. Không gom các tình huống này vào một cờ `new_law=true`.
**Kiểm soát đề xuất:** thu ngày phát sinh khoản thuế, loại xử lý và ngày quyết định kiểm tra. Chưa đọc toàn bộ thủ tục, hạn kê khai hay xử phạt của luật; không dùng thẻ này để suy ra các hạn đó.

## T02 — TNCN lương: Luật 109/2025/QH15
Đã đọc Điều 8–10 (trang 8–9) và Điều 29 (trang 14–15). Hiệu lực chung 01/07/2026; quy định về kinh doanh, tiền lương/tiền công **của cá nhân cư trú** áp dụng từ kỳ tính thuế năm 2026. Không tự chuyển mốc này cho mọi loại thu nhập hoặc người không cư trú.
Biểu Điều 9 cho thu nhập tính thuế lương cư trú: tháng đến 10 triệu: 5%; trên 10–30: 10%; trên 30–60: 20%; trên 60–100: 30%; trên 100: 35%. Ngưỡng năm tương ứng 120/360/720/1.200 triệu. Tính theo từng phần, không nhân toàn bộ thu nhập với thuế suất bậc cao nhất.
Điều 10 nêu giảm trừ người nộp 15,5 triệu/tháng (186 triệu/năm), người phụ thuộc 6,2 triệu/tháng. Xác định đủ điều kiện, số tháng được giảm và nguồn chứng minh; không mặc định người được khai là người phụ thuộc hợp lệ. Kiểm tra văn bản điều chỉnh mức giảm trừ nếu có tại ngày sử dụng. Điều 11 còn có các khoản giảm trừ với điều kiện/hướng dẫn riêng; thẻ chưa bao phủ để tính từ gross. Không tự điền mức y tế/giáo dục khi chưa đọc quy định chi tiết.
**Kiểm soát đề xuất:** tách thu nhập chịu thuế, khoản được trừ, thu nhập tính thuế, biểu, kỳ và cư trú. Thu nhập tính thuế 40 triệu/tháng theo biểu này cho số học 4,5 triệu, trước xử lý làm tròn/chính sách khấu trừ/quyết toán. Đây là ví dụ số học trên đầu vào đã xác định, không tính thuế từ lương gross.

## T03 — Luật 09/2026/QH16: hiệu lực và ngưỡng do Chính phủ quy định
Đã đọc cả 2 trang, Điều 1–5. Luật sửa TNCN, GTGT, TNDN và TTĐB. Điều 5: hiệu lực từ ngày thông qua 24/04/2026, riêng Điều 1–3 từ 01/01/2026. Các điều này giao Chính phủ quy định ngưỡng doanh thu liên quan, không phải một con số cố định lấy từ bản Luật109 chưa sửa.
**Kiểm soát đề xuất:** hồ sơ hộ/cá nhân kinh doanh năm 2026 phải đọc cùng NĐ68/2026 và NĐ141/2026 cùng sửa đổi tiếp theo. Không tiếp tục hardcode 500 triệu từ văn bản gốc chưa đối chiếu sửa đổi.

## T04 — NĐ141/2026/NĐ-CP: ngưỡng và miễn TNDN có điều kiện
Đã đọc Điều 1–4, trang 1–3. Điều 1 sửa các vị trí ngưỡng 500 triệu thành 01 tỷ trong NĐ68; quy định HĐĐT cũng được sửa. Điều 2 bổ sung khoản 15 Điều 4 NĐ320 về thu nhập doanh nghiệp/tổ chức thành lập theo pháp luật Việt Nam với tổng doanh thu năm từ 01 tỷ trở xuống.
Căn cứ doanh thu không đơn giản là doanh thu bán hàng hiện tại: gồm doanh thu bán hàng/cung cấp dịch vụ (không gồm giảm trừ), doanh thu tài chính và thu nhập khác trên phụ lục quyết toán kỳ trước liền kề. Kỳ trước dưới 12 tháng có quy tắc quy đổi; doanh nghiệp mới thành lập có quy tắc riêng. Ngoại lệ liên quan công ty con/quan hệ liên kết ở điểm d phải được kiểm tra.
Điều 3 ghi hiệu lực 01/01/2026; Điều 4 có xử lý thuế hộ đã nộp, doanh nghiệp đã tạm nộp quý I và kỳ thuế năm 2025 kết thúc sau 01/01/2026.
**Kiểm soát đề xuất:** nhập đủ kỳ doanh thu căn cứ, tháng hoạt động, quan hệ liên kết, ngày bắt đầu/kết thúc kỳ và số đã nộp. Doanh thu 900 triệu không tự đủ kết luận được miễn; còn các điều kiện và ngoại lệ. Đọc NĐ68/NĐ320 và chuỗi sửa đổi để hoàn tất hồ sơ.

## T05 — NQ43/2026/QH16: giảm thuế cho kỳ 2026–2027
Đã đọc Điều 1–2, cả 2 trang. Giảm 30% số TNCN phải nộp kỳ năm 2026/2027 đối với thu nhập kinh doanh của cá nhân cư trú có doanh thu năm tương ứng không quá 10 tỷ. Đối với TNDN: doanh nghiệp/tổ chức thành lập theo pháp luật Việt Nam có doanh thu năm tương ứng không quá 10 tỷ, với ngoại lệ doanh nghiệp hình thành từ chia/tách sau hiệu lực mà tổng doanh thu các doanh nghiệp sau chia/tách trên 10 tỷ. Nếu đang hưởng ưu đãi, số được giảm tính trên số phải nộp sau khi trừ ưu đãi theo Điều 1.
Hiệu lực 24/08/2026, áp dụng kỳ 2026/2027; Chính phủ quy định chi tiết. Trong lần nghiên cứu này đã tìm thấy thông tin dự thảo hướng dẫn, **chưa xác nhận đầy đủ văn bản hướng dẫn đã ban hành đến ngày đánh giá**. Không kết luận chưa có nghị định chỉ vì tìm kiếm không ra.
**Kiểm soát đề xuất:** ghi giảm là quy tắc có điều kiện; nghiên cứu hướng dẫn và quan hệ với miễn thuế trước khi phát hành tính chính thức. Không áp dụng giảm này cho mọi thuế lương hoặc mọi doanh nghiệp; không coi 30% là giảm thuế suất 30 điểm phần trăm.

## T06 — NĐ144/2026/NĐ-CP: VAT trả chậm/trả góp
Đã đọc Điều 4 và Điều 6, trang 3–4, sửa điểm g khoản 2 Điều 26 NĐ181/2025 (chuỗi có NĐ359/2025). Với hàng hóa/dịch vụ trả chậm/trả góp giá trị từ 05 triệu, thẻ này yêu cầu đọc đủ hợp đồng văn bản, hóa đơn VAT và chứng từ thanh toán không dùng tiền mặt. Khi chưa đến hạn thanh toán theo hợp đồng/phụ lục, vẫn có thể khấu trừ. Đến hạn mà thiếu chứng từ thanh toán không tiền mặt: điều chỉnh giảm cho phần thiếu chứng từ vào kỳ phát sinh nghĩa vụ thanh toán; sau đó có chứng từ thì kê khai khấu trừ vào kỳ có chứng từ. Hiệu lực 20/06/2026.
**Kiểm soát đề xuất:** lưu lịch đến hạn và phụ lục hợp đồng; phân biệt `NOT_DUE`, `DUE_MISSING_PROOF`, `PROOF_RECEIVED`. Không đồng nhất trạng thái chưa trả với mất khấu trừ ngay; không áp dụng thẻ trả chậm cho tất cả loại mua hàng. Cần kiểm tra điều kiện khấu trừ còn lại và sửa đổi mới của NĐ181.

## T07 — TT20/2026/TT-BTC: chuyển tiếp TNDN
Đã đọc Điều 10, trang 17–18. Hiệu lực 12/03/2026, áp dụng từ kỳ tính thuế năm 2025. Khoản 2 xử lý hồ sơ khoản chi phát sinh trước hiệu lực trong kỳ 2025; khoản 3 cho chứng từ thanh toán không dùng tiền mặt/chuyển nhượng vốn mốc từ ngày NĐ320 có hiệu lực; khoản 4 có chuyển tiếp hợp đồng nhà thầu/nhà thầu phụ phương pháp hỗn hợp ký trước hiệu lực. Khoản 6 thay TT78/2014, TT96/2015; khoản 7 bãi bỏ các phần nêu cụ thể của văn bản khác.
**Kiểm soát đề xuất:** không dùng một mốc 12/03/2026 cho mọi điều kiện chi phí; chọn khoản chi, ngày và loại hợp đồng. Thẻ chưa nghiên cứu toàn bộ điều kiện từng khoản chi; đọc điều tương ứng và NĐ320 khi sử dụng.

## T08 — Hóa đơn: NĐ254/2026 và TT91/2026
NĐ254: đã đọc Điều 43–44, trang 46–47. Hiệu lực 01/07/2026; NĐ123/2020, Điều 1 NĐ41/2022 và NĐ70/2025 hết hiệu lực theo Điều 43. Biên lai giấy thuộc quy định chuyển tiếp có mốc đến hết 31/12/2026; hóa đơn đặt in của cơ quan thuế có cách xử lý riêng. Không nhầm biên lai với mọi hóa đơn giấy.
TT91: đã đọc Điều 10, trang 16–19 về hóa đơn điện tử đã lập, trong đó sai tên/địa chỉ nhưng đúng MST và các nội dung khác có luồng khác với sai MST, tiền, thuế suất/tiền thuế, quy cách/chất lượng. Đọc đủ khoản và đối tượng để chọn điều chỉnh/thay thế/thông báo/thỏa thuận; không xóa hóa đơn gốc. Đã đọc Điều 24–25 TT91, trang 31–32: hiệu lực 01/07/2026, TT32/2025 hết hiệu lực; có chuyển tiếp hợp đồng dịch vụ và hóa đơn đã lập theo các chế độ cũ. Hóa đơn cũ sai không mặc nhiên dùng cùng một luồng cho mọi giai đoạn.
**Kiểm soát đề xuất:** graph hóa đơn gốc–điều chỉnh–thay thế; lưu lý do, thỏa thuận nếu thuộc diện, thông điệp gửi, phản hồi và kỳ kê khai. Chưa có phản hồi API thì trạng thái chỉ là dự thảo/đã chuẩn bị.

## T09 — NĐ255/2026/NĐ-CP: giao dịch liên kết
Đã đọc Điều 23, trang PDF 34 Công báo số 410. Hiệu lực 01/07/2026 và áp dụng từ kỳ TNDN năm 2026; NĐ132/2020 và NĐ20/2025 hết hiệu lực theo khoản 2. Trường hợp thuộc chuyển tiếp Điều 3 NĐ20/2025 tiếp tục thời gian còn lại theo khoản 3.
**Kiểm soát đề xuất:** giữ kỳ thuế và cờ hồ sơ chuyển tiếp; không tiếp tục dùng NĐ132 như văn bản hiện hành duy nhất. Chưa đọc toàn bộ tiêu chí bên liên kết, miễn kê khai/hồ sơ, điều kiện chi phí hay biểu mẫu; không tự tính engine chuyển giá từ thẻ thi hành này.

## Ngoài phạm vi đã kiểm chứng
Thuế nhà thầu đầy đủ, chuyển giá, ưu đãi chuyên ngành, giảm VAT theo loại hàng, xuất nhập khẩu, tài sản mã hóa, thuế tối thiểu toàn cầu, xử phạt và toàn bộ biểu mẫu/hạn kê khai chưa được bao phủ. NĐ255/2026 mới đọc Điều 23 về thi hành, chưa đủ tính chuyển giá hoặc chi phí lãi vay. Dự thảo sửa NĐ181 tháng 10/2026 phải để DRAFT; không đưa vào quy tắc đang áp dụng.
