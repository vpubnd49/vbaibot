# Quy tắc nghiệp vụ theo thời gian

## Dữ liệu tối thiểu
Quy tắc có `id`, `version`, phạm vi tổ chức/nghiệp vụ, điều kiện, tham số, công thức, đơn vị, rounding, căn cứ/điều/khoản, nguồn/hash, `issued_at`, `document_effective_from`, `rule_effective_from`, `application_basis`, ngày nguồn quan sát/kiểm chứng, phạm vi chuỗi sửa đổi và người duyệt. Không coi `valid_from` một mình là đủ.
Hồ sơ có ngày giao dịch/chi trả, tax_year, fiscal_year_start/end, ngày ký/sửa hợp đồng, pháp nhân, cư trú, phương pháp, dữ liệu điều kiện và chứng từ. Các trường này có ý nghĩa khác nhau; không thay trường thiếu bằng ngày hôm nay.

## Chọn và thực hiện
1. Lọc theo đúng loại văn bản, sản phẩm, đối tượng và căn cứ. DRAFT chỉ ở không gian thử nghiệm. Văn bản tương lai không được tự áp dụng trước mốc, trừ khi chính điều khoản được kiểm chứng quy định kỳ áp dụng khác.
2. Tách đánh giá hiện tại cho giao dịch quá khứ với tái dựng quyết định theo thông tin được biết trong quá khứ. Lưu observed_at/checked_at và snapshot; không backdate việc đã biết văn bản.
3. Chọn basis: TRANSACTION_DATE, TAX_YEAR, FISCAL_YEAR_START hoặc điều kiện chuyển tiếp tùy quy tắc. Biểu lương Luật109 dùng kỳ năm theo Điều29; TT99 cần đầu năm tài chính; TT29 cần chuyển tiếp hợp đồng. Không chọn văn bản bằng số hiệu lớn nhất.
4. Nếu nhiều quy tắc chồng lấn, thiếu nguồn, chưa đủ điều kiện hoặc chưa xác định chuyển tiếp, trả ngoại lệ để nghiên cứu/soát xét; không silent fallback sang thuế suất 0 hoặc quy tắc cũ.
5. Engine nhận input đã chuẩn hóa và rule snapshot bất biến, trả phép tính và trace. Tách bước kiểm chứng pháp lý, soát xét hồ sơ, duyệt theo quy chế và phát hành.
6. Thay source/rule/input sau duyệt làm mất hiệu lực duyệt tương ứng. Tính lại có new run_id và comparison; giữ kết quả cũ, không overwrite lịch sử.

## Mẫu helper
`../../vn-finance-core/scripts/legal_preflight.py` kiểm tra điều kiện cấu hình, không tự giải quyết quan hệ giữa văn bản hoặc xác nhận pháp luật. Case có status facts/chain_check do người xử lý thực tế xác nhận; không tự điền APPROVED/VERIFIED_FOR_CASE để qua gate. Các thẻ nghiên cứu của gói chỉ tạo DRAFT.
Độ mới tối đa 30 ngày là chính sách mẫu, tùy chỉnh theo rủi ro; helper không gọi mạng và không tự cập nhật luật.

## Các tình huống test
- Ngày giao dịch thuộc năm 2025 nhưng hồ sơ xét lại năm 2026: giữ cả hai mốc.
- Thu nhập lương cư trú tháng 01/2026, đánh giá 12/10/2026: xét Điều29 Luật109, không chỉ hiệu lực 01/07.
- Năm tài chính bắt đầu 01/07/2025: không tự chọn TT99 chỉ vì giao dịch tháng 02/2026.
- Hợp đồng vay ký trước 15/08/2026: phải xử lý chuyển tiếp và phần sửa đổi, không dùng ngày tính toán thay ngày ký.
- NQ43: số sau ưu đãi, loại thu nhập, năm doanh thu, chia/tách và hướng dẫn; thiếu một điều kiện thiết yếu thì kết quả có điều kiện.
- TT53: system_go_live trước/sau hiệu lực và yêu cầu có hạn khác nhau; không cho future rule chạy từ tháng 10.
- Metadata có ngày khác điều khoản: báo xung đột để đọc bản gốc; không tự sửa nguồn.
- Cùng phạm vi/basis/time hai quy tắc không có quan hệ ưu tiên đã xác minh: báo AMBIGUOUS_RULE.
