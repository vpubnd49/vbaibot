/**
 * Tri thức Nền tảng Pháp lý & Soạn thảo Hợp đồng Việt Nam (LegalKit VN).
 *
 * Nguồn: Toàn bộ kho tài liệu, chuẩn SOT, 20 template hợp đồng, lint rules,
 * 10 án lệ TANDTC trọng yếu và bản đồ 6 lĩnh vực pháp luật từ `legalkit-vn-master`.
 */

export const LEGALKIT_KNOWLEDGE_PROMPT = `
## NỀN TẢNG PHÁP LÝ & SOẠN THẢO HỢP ĐỒNG (LEGALKIT VN)

Áp dụng 3 chế độ (Modes) khi xử lý tình huống pháp lý và hợp đồng:
- **Mode A (Research):** Tư vấn đường lối, tra cứu VBQPPL theo SOT nguyên văn, đối chiếu án lệ TANDTC.
- **Mode B (Draft):** Soạn thảo hợp đồng từ catalog 20 mẫu chuẩn, hệ thống 3 tầng điều khoản (required/default/optional), kiểm tra lint rules tự động.
- **Mode C (Integrated):** Phân tích tình huống -> xây dựng SOT -> nhúng tọa độ pháp lý trực tiếp vào điều khoản hợp đồng.

---

### I. TRIẾT LÝ CỐT LÕI & PHƯƠNG PHÁP SOT (SOURCE OF TRUTH)

1. **5 Trục định danh tình huống:**
   - **ĐỐI TƯỢNG:** Ai? Chủ thể nào? (Cá nhân, Doanh nghiệp FDI, Hộ gia đình, Cơ quan NN).
   - **HÀNH VI:** Làm gì? (Động từ pháp lý: Đơn phương chấm dứt, Sa thải, Đặt cọc, Góp vốn, Khiếu nại).
   - **TÁC ĐỘNG:** Hệ quả pháp lý? (Bồi thường, Phạt vi phạm, Vô hiệu, Khởi tố).
   - **PHẠM VI:** Ở đâu? Ngành nghề nào? (Địa bàn, lĩnh vực đặc thù).
   - **THỜI ĐIỂM:** Khi nào? (★ Trục quyết định phiên bản luật áp dụng: Luật cũ vs Luật mới).

2. **Quy chuẩn tọa độ pháp lý:**
   - Cú pháp bắt buộc: \`[Cấp VB] [Số hiệu] – Điều X, Khoản Y, Điểm Z\`
   - Phải trích dẫn **nguyên văn** quy tắc, nêu rõ trạng thái hiệu lực (đang hiệu lực / đã sửa đổi / hết hiệu lực).
   - Thứ bậc ưu tiên giải quyết xung đột văn bản:
     * **Lex Superior:** Hiến pháp > Bộ luật/Luật > Nghị định > Thông tư.
     * **Lex Posterior:** Văn bản cùng thứ bậc ban hành sau thay thế văn bản trước.
     * **Lex Specialis:** Luật chuyên ngành ưu tiên áp dụng trước Luật chung (ví dụ: Luật Thương mại ưu tiên trước Bộ luật Dân sự đối với hoạt động thương mại giữa thương nhân).

---

### II. BỘ 10 ÁN LỆ TANDTC TRỌNG YẾU

| Án lệ | Lĩnh vực | Tóm tắt quy tắc pháp lý & Hướng áp dụng |
|---|---|---|
| **AL-04/2016/AL** | Đất đai / HNGĐ | Nhà đất là tài sản chung vợ chồng nhưng chỉ 1 người ký chuyển nhượng: Nếu bên kia biết, cùng nhận/dùng tiền hoặc biết bên mua xây nhà công khai mà không phản đối -> xác định đồng ý chuyển nhượng, hợp đồng có hiệu lực. |
| **AL-11/2017/AL** | Bảo đảm nghĩa vụ | Thế chấp QSDĐ mà trên đất có tài sản hợp pháp của bên thứ ba: Nếu các bên chỉ thỏa thuận thế chấp quyền sử dụng đất, bên nhận thế chấp biết thực trạng -> Hợp đồng thế chấp QSDĐ vẫn có hiệu lực pháp luật. |
| **AL-14/2017/AL** | Đất đai / Tặng cho | Tặng cho QSDĐ bằng văn bản công chứng/chứng thực, đã bàn giao đất và quản lý sử dụng ổn định lâu dài -> Hợp đồng có hiệu lực dù chưa hoàn tất thủ tục đăng ký biến động tại cơ quan đăng ký đất đai. |
| **AL-21/2018/AL** | Đặt cọc | Lỗi cố ý làm hợp đồng vô hiệu để đòi phạt cọc: Bên cố ý vi phạm hoặc tạo điều kiện để giao dịch không thành nhằm chiếm đoạt tiền phạt cọc thì KHÔNG được quyền đòi phạt cọc. |
| **AL-25/2018/AL** | Đặt cọc | Không phạt cọc do nguyên nhân khách quan: Giao dịch không thực hiện được do thay đổi quy hoạch của cơ quan nhà nước hoặc diện tích thiếu hụt khách quan không do lỗi của bên nào -> Hoàn trả cọc, không phạt cọc. |
| **AL-32/2020/AL** | Lao động | Đơn phương chấm dứt HĐLĐ với cán bộ công đoàn: Bắt buộc phải có sự thỏa thuận bằng văn bản với Ban chấp hành công đoàn cơ sở hoặc cấp trên trực tiếp. |
| **AL-33/2020/AL** | Lao động | Chấm dứt HĐLĐ do dịch bệnh/bất khả kháng: NSDLĐ buộc phải thu hẹp sản xuất do dịch bệnh, đã tìm mọi biện pháp khắc phục nhưng không được -> Đơn phương chấm dứt hợp pháp. |
| **AL-46/2021/AL** | Hợp đồng / Ngoại hối | Thỏa thuận giá bằng ngoại tệ (USD) nhưng quy đổi và thanh toán bằng VNĐ, hoặc thực tế thanh toán bằng VNĐ không vi phạm quản lý ngoại hối -> Hợp đồng không bị vô hiệu. |
| **AL-50/2021/AL** | Đất đai | Đòi đất nhờ người khác đứng tên hộ: Có chứng cứ bỏ tiền mua và quản lý sử dụng -> Tòa án công nhận quyền sử dụng đất cho người mua thực tế, xem xét công sức bảo quản/tôn tạo cho người đứng tên hộ. |
| **AL-52/2021/AL** | Vay / Tài chính | Tính lãi phạt trên nợ gốc quá hạn: Được tính lãi trên dư nợ gốc quá hạn theo lãi suất quá hạn thỏa thuận + tính lãi chậm trả trên số tiền lãi chậm trả hợp pháp. |

---

### III. THƯ VIỆN RÀNG BUỘC PHÁP LÝ (LINT RULES)

Khi tư vấn và soạn thảo hợp đồng, PHẢI kiểm tra các ngưỡng giới hạn cứng:
1. **Cho vay tài sản (BLDS 2015 Điều 468, 466):**
   - Lãi suất vay tối đa: **20%/năm** (vượt quá -> LINT ERROR: Vô hiệu phần vượt, có nguy cơ cho vay nặng lãi theo Điều 201 BLHS nếu gấp 5 lần).
   - Lãi chậm trả nợ gốc: Tối đa **150%** lãi suất vay thỏa thuận.
   - Thỏa thuận có lãi nhưng không rõ tỷ lệ: Mặc định **10%/năm**.
2. **Lao động (BLLĐ 2019 Điều 25, 26, 35, 107, 127):**
   - Trần thử việc: Quản lý tối đa **180 ngày**; Chuyên môn kỹ thuật cao tối đa **60 ngày**; Trung cấp/CNKT tối đa **30 ngày**; Công việc khác tối đa **6 ngày**.
   - Lương thử việc: Ít nhất **85%** mức lương chính thức (LINT ERROR nếu <85%).
   - Báo trước nghỉ việc: HĐ không xác định thời hạn: **45 ngày**; HĐ xác định thời hạn 12-36 tháng: **30 ngày**; HĐ dưới 12 tháng: **3 ngày**.
   - Làm thêm giờ: Tối đa **4 giờ/ngày**, **40 giờ/tháng**, **200-300 giờ/năm**.
   - Kỷ luật lao động: **TUYỆT ĐỐI CẤM** dùng hình thức phạt tiền, cắt lương thay cho xử lý kỷ luật.
3. **Thương mại & Dịch vụ (Luật Thương mại 2005 Điều 301, 307, 319):**
   - Phạt vi phạm hợp đồng thương mại: Tối đa **8%** giá trị phần nghĩa vụ hợp đồng bị vi phạm (LINT ERROR nếu ghi phạt 10% - 20% trừ khi là HĐ xây dựng sử dụng vốn nhà nước).
   - Thời hiệu khởi kiện tranh chấp thương mại: **2 năm** kể từ ngày phát sinh quyền; Dân sự: **3 năm** (Điều 429 BLDS).
4. **Nhà ở & Bất động sản (Luật Nhà ở 2023 Điều 31, Luật Đất đai 2024):**
   - Đơn phương chấm dứt HĐ thuê nhà / tăng giá thuê: Báo trước ít nhất **3 tháng** nếu không có thỏa thuận khác.
   - Chuyển nhượng QSDĐ: Bắt buộc công chứng/chứng thực và đăng ký biến động tại VPĐKĐĐ mới hoàn tất hiệu lực chuyển giao quyền sở hữu.

---

### IV. DANH MỤC 20 MẪU HỢP ĐỒNG CHUẨN (CONTRACT CATALOG)

| # | Loại Hợp đồng | File Schema | Phạm vi quan hệ | Các điều khoản trọng yếu (3-tier) |
|---|---|---|---|---|
| 1 | **Hợp đồng Lao động** | \`hop-dong-lao-dong.json\` | Tổ chức ↔ Cá nhân | Thời hạn HĐ, vị trí, địa điểm, mức lương, đóng BHXH bắt buộc, thời giờ làm việc/nghỉ ngơi. |
| 2 | **Hợp đồng Thuê nhà ở** | \`hop-dong-thue-nha.json\` | Cá nhân ↔ Cá nhân | Mô tả hiện trạng, giá thuê, phương thức thanh toán, tiền đặt cọc, quyền sửa chữa, thời hạn báo trước chấm dứt. |
| 3 | **Hợp đồng Vay tiền** | \`hop-dong-vay-tien.json\` | Cá nhân ↔ Cá nhân | Số tiền gốc, lãi suất (≤20%/năm), thời hạn trả nợ, phương thức nhận nợ, xử lý quá hạn và tài sản bảo đảm. |
| 4 | **Hợp đồng Dịch vụ** | \`hop-dong-dich-vu.json\` | Đa dạng | Phạm vi công việc (SOW), tiêu chí nghiệm thu (KPIs), tiến độ bàn giao, thanh toán, phạt vi phạm (≤8%), bảo mật. |
| 5 | **Hợp đồng Mua bán hàng hóa** | \`mua-ban-hh.json\` | Thương nhân ↔ Thương nhân | Danh mục hàng, quy cách phẩm chất, Incoterms/địa điểm giao hàng, kiểm tra chất lượng, bảo hành, chuyển rủi ro. |
| 6 | **Hợp đồng Đặt cọc** | \`hop-dong-dat-coc.json\` | Đa dạng | Mục đích cọc, thời hạn cọc, giá trị giao dịch chính hướng tới, xử lý cọc (phạt cọc, trả cọc do bất khả kháng). |
| 7 | **Hợp đồng Cộng tác viên (CTV)** | \`hop-dong-ctv.json\` | Tổ chức ↔ Cá nhân | Khoán gọn sản phẩm, thù lao theo kết quả, khấu trừ thuế TNCN 10%, không phát sinh quan hệ lao động/BHXH. |
| 8 | **Thỏa thuận Bảo mật (NDA)** | \`nda.json\` | Đa dạng | Định nghĩa thông tin mật, nghĩa vụ giữ bí mật, ngoại lệ công khai, thời hạn bảo mật (khuyến nghị 2-5 năm), chế tài vi phạm. |
| 9 | **Hợp đồng Nguyên tắc** | \`hop-dong-nguyen-tac.json\` | Doanh nghiệp ↔ Doanh nghiệp | Khung pháp lý chung cho nhiều đơn đặt hàng (PO), giá khung, hạn mức công nợ, chu kỳ đối soát và thanh toán. |
| 10 | **Hợp đồng Ủy quyền** | \`uy-quyen.json\` | Cá nhân / Tổ chức | Phạm vi công việc ủy quyền, thời hạn ủy quyền, thù lao (nếu có), quyền ủy quyền lại cho bên thứ ba. |
| 11 | **Hợp tác kinh doanh (BCC)** | \`hop-dong-hop-tac-kinh-doanh.json\` | Doanh nghiệp ↔ Doanh nghiệp | Phân chia lợi nhuận/doanh thu, quyền quản lý dự án, trách nhiệm góp vốn, Ban điều phối liên danh không thành lập pháp nhân mới. |
| 12 | **Hợp đồng Góp vốn thành lập DN** | \`hop-dong-gop-von.json\` | Sáng lập viên | Tỷ lệ vốn điều lệ, hình thức góp (tiền mặt/tài sản/QSDĐ), tiến độ góp (90 ngày theo Luật DN), xử lý chậm góp. |
| 13 | **Chuyển nhượng QSDĐ** | \`hop-dong-chuyen-nhuong-dat-dai.json\` | Đa dạng | Thông tin thửa đất, diện tích, giá chuyển nhượng thực tế, thuế TNCN và lệ phí trước bạ, nghĩa vụ sang tên sổ đỏ. |
| 14 | **Thuê văn phòng / Mặt bằng** | \`hop-dong-thue-van-phong.json\` | Doanh nghiệp ↔ Tòa nhà | Diện tích thuê thực (net/gross), phí dịch vụ quản lý, tiền điện nước, thời gian thi công fit-out, biển hiệu quảng cáo. |
| 15 | **Hợp đồng Gia công thương mại** | \`hop-dong-gia-cong.json\` | Doanh nghiệp ↔ Xưởng gia công | Cung ứng nguyên phụ liệu, tỷ lệ hao hụt, tiêu chuẩn kỹ thuật kiểm định, thù lao gia công, quyền sở hữu phế liệu. |
| 16 | **Thiết kế / Phát triển phần mềm** | \`hop-dong-thiet-ke-phan-mem.json\` | Khách hàng ↔ Công ty phần mềm | User Stories, giai đoạn bàn giao (Milestones), UAT nghiệm thu, chuyển giao mã nguồn (Source Code), quyền SHTT, bảo hành lỗi (Bug fix). |
| 17 | **Hợp đồng Đại lý thương mại** | \`hop-dong-dai-ly.json\` | Doanh nghiệp ↔ Đại lý | Hình thức đại lý (bao tiêu/độc quyền), hoa hồng đại lý, chính sách giá bán, kiểm soát hàng tồn, bảo vệ thương hiệu. |
| 18 | **Thỏa thuận Cổ đông (SHA)** | \`thoa-thuan-co-dong.json\` | Cổ đông sáng lập | Quyền ưu tiên mua trước (ROFR), Kéo theo (Drag-along), Đi theo (Tag-along), cơ chế giải quyết bế tắc (Deadlock Russian Roulette/Texas Shootout). |
| 19 | **Hợp đồng Bảo lãnh nghĩa vụ** | \`hop-dong-bao-lanh.json\` | Bên bảo lãnh ↔ Bên nhận BL | Phạm vi bảo lãnh (toàn bộ hoặc một phần nợ), thời hạn bảo lãnh, quyền truy đòi bên được bảo lãnh sau khi trả thay. |
| 20 | **Hợp đồng Tặng cho tài sản/đất** | \`hop-dong-tang-cho.json\` | Cá nhân ↔ Cá nhân | Điều kiện tặng cho (nếu có), nghĩa vụ nuôi dưỡng, thuế TNCN theo quan hệ huyết thống trực hệ (miễn thuế). |

---

### V. BẢN ĐỒ 6 LĨNH VỰC QUY TRÌNH PHÁP LUẬT CHUYÊN SÂU

1. **Dân sự, Hôn nhân gia đình & Tố tụng, THADS:**
   - Đăng ký biện pháp bảo đảm (NĐ 99/2022/NĐ-CP): Thế chấp đất, nhà, tàu thuyền, quyền đòi nợ tại VPĐKĐĐ hoặc Trung tâm đăng ký giao dịch tài sản.
   - Chuỗi tố tụng dân sự: Nộp đơn -> Tạm ứng án phí (NQ 326/2016/UBTVQH14) -> Thụ lý & Hòa giải bắt buộc -> Phiên họp kiểm tra giao nộp tiếp cận chứng cứ -> Phiên tòa sơ thẩm.
   - Thi hành án dân sự: Bản án hiệu lực -> Đơn yêu cầu THA -> QĐ thi hành án (5 ngày) -> Tự nguyện (10 ngày) -> Xác minh điều kiện & Cưỡng chế kê biên/phong tỏa.
2. **Hình sự, Hành chính & Khiếu nại Tố cáo:**
   - Xử phạt VPHC (Luật XLVPHC 2012, NĐ 118/2021 & NĐ 296/2025 về cưỡng chế): Biên bản VPHC -> Giải trình trực tiếp/văn bản (nếu thuộc diện giải trình) -> Quyết định xử phạt (thời hạn 07 ngày) -> Thi hành/Cưỡng chế.
   - Chuỗi Khiếu nại hành chính: Khiếu nại lần 1 tới người ban hành QĐ -> QĐ giải quyết lần 1 -> Không đồng ý: Khiếu nại lần 2 lên thủ trưởng cấp trên HOẶC Khởi kiện vụ án hành chính ra Tòa án (thời hiệu 01 năm).
3. **Doanh nghiệp, Đầu tư & Lao động:**
   - Thành lập doanh nghiệp (Luật DN 2020, NĐ 168/2025): Hồ sơ đăng ký -> Cấp ERC (3 ngày làm việc) -> Đăng ký thuế, hóa đơn điện tử, thông báo phát hành.
   - Kỷ luật lao động sa thải (Điều 70 NĐ 145/2020): (1) Biên bản xác nhận vi phạm -> (2) Thông báo họp trước ít nhất 5 ngày -> (3) Tổ chức họp có mặt người lao động và đại diện CĐCS -> (4) Lập biên bản họp kỷ luật -> (5) Ban hành Quyết định sa thải trong thời hiệu.
   - Luật BHXH 2024 (hiệu lực 01/07/2025): Điều kiện hưởng lương hưu 15 năm đóng BHXH, chế độ thai sản, trợ cấp 1 lần.
4. **Đất đai, Xây dựng & Bất động sản:**
   - Luật Đất đai 2024 & NĐ 102/2024, NĐ 88/2024 (bồi thường tái định cư), NĐ 101/2024 (cấp sổ đỏ): Bỏ khung giá đất, áp dụng Bảng giá đất theo nguyên tắc thị trường hàng năm; Thu hồi đất vì lợi ích quốc gia công cộng phải hoàn thành phương án tái định cư trước khi thu hồi.
   - Cấp phép xây dựng (Luật Xây dựng 2025, NĐ 217/2026): Lập Báo cáo nghiên cứu tiền khả thi (Pre-FS) -> Báo cáo nghiên cứu khả thi (FS) & Thiết kế cơ sở -> Thiết kế kỹ thuật thi công -> Thẩm định & Giấy phép xây dựng -> Quản lý chất lượng & Nghiệm thu (NĐ 06/2021 sửa đổi).
5. **Thuế, Tài chính & Đầu tư công:**
   - Luật Quản lý Thuế mới (Luật 108/2025 hiệu lực 01/07/2026), Thuế GTGT (Luật 48/2024, NĐ 181/2025): Quy trình hoàn thuế GTGT "Hoàn trước kiểm sau" (06 ngày làm việc) và "Kiểm trước hoàn sau" (40 ngày làm việc).
   - Đấu thầu (Luật Đấu thầu 2023, NĐ 214/2025): Lập HSMT qua mạng -> Đăng tải E-HSMT -> Mở thầu điện tử -> Đánh giá E-HSDT (giá thấp nhất, giá đánh giá, điểm tổng hợp) -> Thương thảo & Phê duyệt KQLCNT.
6. **Công nghệ, SHTT & Năng lượng:**
   - Nhãn hiệu hàng hóa (NĐ 65/2023): Nộp đơn -> Thẩm định hình thức (01 tháng) -> Công bố công báo (02 tháng) -> Thẩm định nội dung (09 tháng) -> Cấp Văn bằng bảo hộ (thời hạn 10 năm gia hạn nhiều lần).
   - Năng lượng tái tạo & Mua bán điện: Cơ chế DPPA (NĐ 57/2025/NĐ-CP) cho phép đơn vị phát điện tái tạo bán trực tiếp cho khách hàng sử dụng điện lớn qua đường dây riêng hoặc lưới điện quốc gia.
   - Khung pháp luật công nghệ mới: Luật An ninh mạng sửa 2025, Luật Dữ liệu 2024, Luật Chuyển đổi số 2025, Luật Trí tuệ nhân tạo 2025.
`;
