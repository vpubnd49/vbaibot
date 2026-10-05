/**
 * Tri thức chuyên ngành Công Thương — Sở Công Thương tỉnh Lâm Đồng.
 *
 * Nguồn: TOÀN BỘ thư mục `bosung/CT` (11 file: 4 PDF + 7 DOCX):
 *
 *  === NHÓM 1: CHỨC NĂNG, NHIỆM VỤ, CƠ CẤU TỔ CHỨC ===
 *  - QĐ 80/2026/QĐ-UBND (80 QDQP.pdf): Bãi bỏ toàn bộ QĐ 04/2025/QĐ-UBND
 *  - QĐ 4774/QĐ-UBND (4774 QD.pdf): Thành lập Phòng Địa chất và Khoáng sản
 *  - QĐ 4775/QĐ-UBND (4775 QD.pdf + bản Word): Ban hành Quy định CNNVQH
 *    và cơ cấu tổ chức mới của Sở Công Thương tỉnh Lâm Đồng
 *
 *  === NHÓM 2: ỦY QUYỀN CỦA UBND TỈNH CHO GĐ SỞ CT ===
 *  - QĐ 1553/QĐ-UBND ngày 04/10/2025: Ủy quyền NV, QH lĩnh vực CN&TM
 *  - QĐ sửa đổi QĐ 1553 (hoạt động điện lực): Cấp GP điện rác, sinh khối <50MW
 *  - QĐ ủy quyền ATTP (01/2026): Cấp GCN ATTP ngành CT cho GĐ SCT + UBND xã
 *  - QĐ ủy quyền hóa chất (05/2026): Giải quyết TTHC hóa chất, VCHHNH
 *
 *  === NHÓM 3: PHÂN CẤP QUẢN LÝ ATTP ===
 *  - QĐ 45/2025/QĐ-UBND (45 QDQP KY SO.pdf + bản Word):
 *    Quy định phân cấp quản lý nhà nước về ATTP trên địa bàn tỉnh Lâm Đồng
 *
 *  === NHÓM 4: DANH MỤC TTHC NGÀNH CÔNG THƯƠNG (THÔNG BÁO 148/TB-SCT) ===
 *  - Thông báo số 148/TB-SCT ngày 20/09/2026 của Sở Công Thương tỉnh Lâm Đồng
 *  - Quyết định số 4548/QĐ-UBND ngày 15/09/2026 của Chủ tịch UBND tỉnh Lâm Đồng
 *  - Phụ lục 1: Danh mục 246 TTHC cấp tỉnh (Sở Công Thương giải quyết)
 *  - Phụ lục 2: Danh mục 09 TTHC nội bộ giữa các cơ quan HCNN (mã NB-SCT-01 đến NB-SCT-09)
 *  - Phụ lục 3: Danh mục 07 TTHC cấp xã (UBND cấp xã giải quyết)
 *  - Tổng TTHC quản lý: Cấp tỉnh 255 (246 thông thường + 09 nội bộ), Cấp xã 07 thủ tục.
 *
 * Agent sử dụng khối tri thức này khi:
 *  1. Trả lời câu hỏi về chức năng, nhiệm vụ Sở Công Thương
 *  2. Soạn thảo VB liên quan đến công thương, năng lượng, khoáng sản, hóa chất
 *  3. Phân công đúng đơn vị khi giao việc công nghiệp, thương mại, ATTP,
 *     địa chất, khoáng sản, năng lượng, QLTT, hóa chất, điện lực
 *  4. Nhận diện thẩm quyền ủy quyền (GĐ SCT thay mặt UBND tỉnh)
 *  5. Phân biệt phân cấp ATTP giữa Sở Y tế / Sở NNMT / Sở CT / UBND xã
 *  6. Tra cứu, hướng dẫn TTHC chuẩn xác theo Thông báo số 148/TB-SCT
 */

export const CONG_THUONG_KNOWLEDGE_PROMPT = `
## TRI THỨC CHUYÊN NGÀNH CÔNG THƯƠNG — SỞ CÔNG THƯƠNG TỈNH LÂM ĐỒNG

⚠️ **THAY ĐỔI QUAN TRỌNG VỀ TỔ CHỨC & TTHC (NĂM 2026):**
- QĐ số 80/2026/QĐ-UBND ngày 01/10/2026: **BÃI BỎ TOÀN BỘ** Quyết định số 04/2025/QĐ-UBND ngày 08/8/2025 về chức năng, nhiệm vụ và quyền hạn của Sở Công Thương.
- QĐ số 4775/QĐ-UBND ngày 01/10/2026: **BAN HÀNH MỚI** Quy định chức năng, nhiệm vụ, quyền hạn và cơ cấu tổ chức của Sở Công Thương tỉnh Lâm Đồng (thay thế QĐ 190/QĐ-UBND ngày 05/7/2025 về phê duyệt cơ cấu tổ chức).
- QĐ số 4774/QĐ-UBND ngày 01/10/2026: **THÀNH LẬP** Phòng Địa chất và Khoáng sản thuộc Sở Công Thương (tiếp nhận 11 biên chế từ Sở NN&MT + chức năng từ Sở Xây dựng).
- QĐ số 4548/QĐ-UBND ngày 15/9/2026 của Chủ tịch UBND tỉnh Lâm Đồng & **Thông báo số 148/TB-SCT ngày 20/9/2026** của Sở Công Thương: **CÔNG KHAI DANH MỤC THỦ TỤC HÀNH CHÍNH TOÀN NGÀNH CÔNG THƯƠNG** gồm **255 TTHC cấp tỉnh** (246 TTHC thông thường + 09 TTHC nội bộ) và **07 TTHC cấp xã**.

### CĂN CỨ PHÁP LÝ HIỆN HÀNH
- Luật Tổ chức chính quyền địa phương số 72/2025/QH15
- Nghị quyết số 66.25/2026/NQ-CP ngày 04/9/2026 của Chính phủ về xử lý khó khăn, vướng mắc liên quan đến chức năng, nhiệm vụ, quyền hạn quản lý nhà nước về khu công nghiệp, địa chất, khoáng sản
- Nghị định số 150/2025/NĐ-CP ngày 12/6/2025 quy định tổ chức các cơ quan chuyên môn thuộc UBND tỉnh (được sửa đổi, bổ sung bởi NĐ 370/2025/NĐ-CP)
- Nghị định số 146/2025/NĐ-CP ngày 12/6/2025 quy định phân quyền, phân cấp trong lĩnh vực công nghiệp và thương mại
- Nghị định số 139/2025/NĐ-CP ngày 12/6/2025 quy định phân định thẩm quyền chính quyền địa phương 02 cấp trong lĩnh vực QLNN của Bộ CT
- Thông tư số 37/2025/TT-BCT ngày 14/6/2025 hướng dẫn chức năng, nhiệm vụ, quyền hạn của cơ quan chuyên môn về công thương (được sửa đổi, bổ sung bởi TT 50/2026/TT-BCT ngày 13/9/2026)
- Thông tư số 38/2025/TT-BCT ngày 19/6/2025 sửa đổi, bổ sung về phân cấp thực hiện TTHC (sửa đổi bởi TT 15/2026/TT-BCT ngày 25/3/2026)
- Luật Hóa chất ngày 14/6/2025; NĐ 25/2026/NĐ-CP, NĐ 26/2026/NĐ-CP; TT 01/2026/TT-BCT, TT 02/2026/TT-BCT
- Quyết định số 4548/QĐ-UBND ngày 15/9/2026 của Chủ tịch UBND tỉnh Lâm Đồng và Thông báo số 148/TB-SCT ngày 20/9/2026 của Sở Công Thương Lâm Đồng

---

### 1. VỊ TRÍ VÀ CHỨC NĂNG

Sở Công Thương là cơ quan chuyên môn thuộc UBND cấp tỉnh; thực hiện chức năng tham mưu, giúp UBND cấp tỉnh thực hiện quản lý nhà nước về công thương, bao gồm các ngành và lĩnh vực:

- **Năng lượng:** điện, than, dầu khí, năng lượng mới, năng lượng tái tạo, sử dụng năng lượng tiết kiệm và hiệu quả
- **Địa chất, khoáng sản** *(BỔ SUNG MỚI từ 01/10/2026)*
- **Hóa chất, vật liệu nổ công nghiệp**
- **Công nghiệp:** cơ khí, luyện kim, tiêu dùng, thực phẩm, hỗ trợ, môi trường, công nghệ cao (không bao gồm công nghiệp công nghệ số)
- **Khuyến công, cụm công nghiệp, tiểu thủ công nghiệp**
- **Thương mại:** thương mại trong nước, xuất nhập khẩu, thương mại biên giới, dịch vụ logistics
- **Phát triển thị trường ngoài nước, quản lý thị trường**
- **Xúc tiến thương mại, thương mại điện tử, dịch vụ thương mại**
- **Hội nhập kinh tế quốc tế**
- **Cạnh tranh, bảo vệ quyền lợi người tiêu dùng, phòng vệ thương mại**
- **Các dịch vụ công trong các ngành, lĩnh vực thuộc phạm vi quản lý**

Sở Công Thương có tư cách pháp nhân, có con dấu và tài khoản riêng; chấp hành sự chỉ đạo, quản lý của UBND tỉnh, đồng thời chấp hành sự chỉ đạo, kiểm tra, hướng dẫn về chuyên môn, nghiệp vụ của Bộ Công Thương.

---

### 2. NHIỆM VỤ VÀ QUYỀN HẠN (Điều 2 QĐ 4775/QĐ-UBND)

1. Thực hiện nhiệm vụ và quyền hạn theo quy định tại Điều 4 Nghị định số 150/2025/NĐ-CP (sửa đổi bởi NĐ 370/2025/NĐ-CP).

2. Chịu trách nhiệm tổ chức thực hiện quản lý nhà nước theo vị trí, chức năng trong lĩnh vực công nghiệp và thương mại, cụ thể:
   - a) Về năng lượng: điện, than, dầu khí, năng lượng mới, năng lượng tái tạo và các năng lượng khác
   - b) Về hóa chất, vật liệu nổ công nghiệp
   - c) Về công nghiệp nặng, công nghiệp nhẹ
   - d) Về khuyến công, cụm công nghiệp, tiểu thủ công nghiệp
   - đ) Về an toàn kỹ thuật công nghiệp; bảo vệ môi trường trong ngành Công Thương
   - e) Thực hiện nhiệm vụ về quản lý đầu tư xây dựng công trình thuộc chuyên ngành trong phạm vi quản lý
   - g) Về thương mại và thị trường trong nước; quản lý thị trường
   - h) Về xuất khẩu, nhập khẩu hàng hóa; dịch vụ logistics
   - i) Về phòng vệ thương mại
   - k) Về thương mại điện tử và kinh tế số
   - l) Về quản lý cạnh tranh và bảo vệ quyền lợi người tiêu dùng, quản lý hoạt động kinh doanh theo phương thức đa cấp
   - m) Thực hiện chức năng quản lý nhà nước về giá trong lĩnh vực, phạm vi quản lý
   - n) Về xúc tiến thương mại
   - o) Về hội nhập kinh tế quốc tế; phát triển thị trường ngoài nước, hợp tác khu vực và song phương
   - p) Quản lý nhà nước đối với hoạt động hiện diện thương mại và đầu tư kinh doanh của nhà cung cấp dịch vụ nước ngoài, nhà đầu tư nước ngoài tại Việt Nam trong lĩnh vực công nghiệp, thương mại
   - q) Cấp, cấp lại, sửa đổi, bổ sung, điều chỉnh, thu hồi, gia hạn các loại giấy phép, giấy xác nhận, giấy chứng nhận
   - r) Thực hiện quản lý chất lượng các công trình công nghiệp
   - s) Thực hiện hợp tác quốc tế trong lĩnh vực công nghiệp và thương mại
   - t) Về khoa học, công nghệ và đổi mới sáng tạo; chuyển đổi xanh, sử dụng năng lượng tiết kiệm và hiệu quả, phát triển bền vững, sản xuất và tiêu dùng bền vững, ứng phó với biến đổi khí hậu trong ngành Công Thương
   - u) Về dịch vụ công
   - v) Chủ trì giải quyết vụ việc tranh chấp đầu tư phát sinh trên cơ sở hợp đồng, thỏa thuận, cam kết với nhà đầu tư nước ngoài
   - x) Thực hiện các nhiệm vụ quản lý nhà nước về thống kê, phân tích và dự báo thống kê ngành Công Thương
   - **y) Về địa chất và khoáng sản** *(MỚI — bổ sung từ 01/10/2026 theo NQ 66.25/2026/NQ-CP và QĐ 4774, 4775/QĐ-UBND)*:
     * Tham mưu, giúp UBND tỉnh thực hiện quản lý nhà nước về địa chất và khoáng sản trên địa bàn tỉnh;
     * Lập, điều chỉnh, tổ chức thực hiện phương án thăm dò, khai thác, sử dụng khoáng sản trong quy hoạch tỉnh; khoanh định khu vực cấm, tạm thời cấm hoạt động khoáng sản; khu vực khoáng sản phân tán, nhỏ lẻ;
     * Thẩm định hồ sơ cấp, gia hạn, điều chỉnh, thu hồi, trả lại giấy phép thăm dò khoáng sản, giấy phép khai thác khoáng sản; phê duyệt đề án đóng cửa mỏ khoáng sản; phê duyệt trữ lượng khoáng sản thuộc thẩm quyền của UBND cấp tỉnh;
     * Tổ chức đấu giá quyền khai thác khoáng sản; xác định tiền cấp quyền khai thác khoáng sản, tiền sử dụng số liệu, thông tin về địa chất, khoáng sản;
     * Quản lý nhà nước về khai thác, chế biến khoáng sản (bô-xít, titan, than, khoáng sản làm VLXD thông thường như đá, cát, sỏi, đất sét, đất san lấp...);
     * Thanh tra, kiểm tra, giám sát việc chấp hành pháp luật về địa chất và khoáng sản; bảo vệ khoáng sản chưa khai thác; bảo đảm an toàn kỹ thuật mỏ và bảo vệ môi trường trong hoạt động khoáng sản.

---

### 3. CƠ CẤU TỔ CHỨC (Điều 3 QĐ 4775/QĐ-UBND)

**3.1. Lãnh đạo Sở:**
- Giám đốc Sở (đứng đầu, do Chủ tịch UBND tỉnh bổ nhiệm)
- Các Phó Giám đốc (số lượng theo quy định UBND tỉnh)
- Phó Giám đốc Sở không kiêm nhiệm người đứng đầu tổ chức, đơn vị thuộc và trực thuộc Sở (trừ trường hợp pháp luật quy định khác)

**3.2. Phòng chuyên môn, nghiệp vụ (6 phòng):**
1. **Văn phòng Sở** — hành chính, tổng hợp, văn thư, lưu trữ
2. **Phòng Kế hoạch - Tổng hợp** — kế hoạch, tài chính, tổng hợp báo cáo
3. **Phòng Quản lý Công nghiệp** — công nghiệp nặng, nhẹ, hỗ trợ, tiêu dùng, thực phẩm, an toàn kỹ thuật công nghiệp, khuyến công, cụm CN, TTCN
4. **Phòng Quản lý Năng lượng** — điện, than, dầu khí, năng lượng mới, năng lượng tái tạo, sử dụng NLTK&HQ
5. **Phòng Quản lý Thương mại** — thương mại nội địa, XNK, logistics, TMĐT, kinh tế số, xúc tiến TM, cạnh tranh, bảo vệ NTD, phòng vệ TM, hội nhập KT quốc tế
6. **Phòng Địa chất và Khoáng sản** *(MỚI — thành lập theo QĐ 4774/QĐ-UBND ngày 01/10/2026)* — tham mưu quản lý nhà nước về địa chất, khoáng sản (tiếp nhận nguyên trạng Phòng Địa chất và Khoáng sản từ Sở Nông nghiệp và Môi trường + chức năng quản lý khoáng sản từ Sở Xây dựng; điều chuyển 11 biên chế công chức)

**3.3. Đơn vị hành chính thuộc Sở:**
- **Chi cục Quản lý thị trường tỉnh Lâm Đồng** — kiểm tra, kiểm soát thị trường, chống buôn lậu, gian lận thương mại, hàng giả

**3.4. Đơn vị sự nghiệp công lập thuộc Sở:**
- **Trung tâm Khuyến công tỉnh Lâm Đồng** — khuyến công, hỗ trợ phát triển công nghiệp, tiểu thủ công nghiệp

---

### 3.5. CHI TIẾT VỀ PHÒNG ĐỊA CHẤT VÀ KHOÁNG SẢN (QĐ số 4774/QĐ-UBND & QĐ số 4775/QĐ-UBND)

⚠️ **SỰ KIỆN QUAN TRỌNG:** Ngày 01/10/2026, UBND tỉnh Lâm Đồng ban hành **Quyết định số 4774/QĐ-UBND** thành lập Phòng Địa chất và Khoáng sản thuộc Sở Công Thương (do Phó Chủ tịch UBND tỉnh Nguyễn Hồng Hải ký).

**1. Nguồn gốc thành lập và biên chế:**
- Phòng Địa chất và Khoáng sản là phòng chuyên môn, nghiệp vụ thuộc Sở Công Thương.
- Được thành lập trên cơ sở:
  + Tiếp nhận **nguyên trạng Phòng Địa chất và Khoáng sản** thuộc Sở Nông nghiệp và Môi trường;
  + Tiếp nhận **chức năng, nhiệm vụ quản lý nhà nước về khoáng sản** thuộc Sở Xây dựng;
  + Điều chuyển **11 biên chế công chức** từ Sở Nông nghiệp và Môi trường sang Sở Công Thương.
- Căn cứ pháp lý: Luật Tổ chức CQĐP 2025; Nghị quyết 66.25/2026/NQ-CP ngày 04/9/2026 của Chính phủ; Nghị định 150/2025/NĐ-CP (sửa đổi bởi NĐ 370/2025/NĐ-CP); Nghị định 121/2026/NĐ-CP; Thông tư 37/2025/TT-BCT và Thông tư 50/2026/TT-BCT ngày 13/9/2026 của Bộ Công Thương; Tờ trình số 161/TTr-SCT ngày 24/9/2026 của Giám đốc Sở Công Thương.

**2. Nhiệm vụ và quyền hạn của Phòng Địa chất và Khoáng sản:**
- **Tham mưu quản lý nhà nước về địa chất và khoáng sản** trên địa bàn toàn tỉnh Lâm Đồng.
- **Quy hoạch & Kế hoạch:** Xây dựng, triển khai quy hoạch thăm dò, khai thác, chế biến và sử dụng khoáng sản tỉnh; khoanh định khu vực cấm, tạm thời cấm hoạt động khoáng sản; khu vực khoáng sản phân tán, nhỏ lẻ.
- **Cấp phép & Quản lý mỏ:** Tiếp nhận, thẩm định hồ sơ cấp, gia hạn, điều chỉnh, thu hồi, trả lại Giấy phép thăm dò khoáng sản, Giấy phép khai thác khoáng sản; phê duyệt đề án đóng cửa mỏ khoáng sản; thẩm định, phê duyệt trữ lượng khoáng sản trong báo cáo kết quả thăm dò khoáng sản thuộc thẩm quyền UBND tỉnh.
- **Quản lý đa dạng khoáng sản:**
  + Khoáng sản làm vật liệu xây dựng thông thường (đá, cát, sỏi, đất sét, đất san lấp...).
  + Khoáng sản công nghiệp, kim loại, năng lượng (bô-xít, titan, than, quặng sắt, cao lanh, sét gạch ngói...).
  + Giám sát hoạt động khai thác mỏ gắn với an toàn lao động, an toàn kỹ thuật mỏ và bảo vệ môi trường trong hoạt động khoáng sản.
- **Tài chính & Đấu giá mỏ:** Tổ chức đấu giá quyền khai thác khoáng sản; xác định tiền cấp quyền khai thác khoáng sản, tiền sử dụng số liệu, thông tin về địa chất, khoáng sản; tính toán nghĩa vụ tài chính theo quy định.
- **Thanh tra, kiểm tra & Xử lý vi phạm:** Kiểm tra, thanh tra việc chấp hành pháp luật về địa chất và khoáng sản; bảo vệ tài nguyên khoáng sản chưa khai thác; phối hợp Công an tỉnh và UBND các xã, phường, đặc khu xử lý khai thác khoáng sản trái phép (cát, sỏi, đất san lấp, đá...).

**3. Cơ chế bàn giao và trách nhiệm các cơ quan (Điều 3 QĐ 4774):**
- **Sở Nông nghiệp và Môi trường:** Bàn giao đầy đủ hồ sơ, tài liệu, dữ liệu, CSDL, chương trình, đề án, dự án, tài sản và nguồn lực liên quan đến địa chất, khoáng sản cho Sở Công Thương; phối hợp Sở Nội vụ rà soát, điều động 11 công chức; tiếp tục thực hiện các nhiệm vụ còn lại (đất đai, môi trường, tài nguyên nước, lâm nghiệp...).
- **Sở Xây dựng:** Lập danh mục và bàn giao đầy đủ hồ sơ, tài liệu, dữ liệu, dự án và nguồn lực liên quan đến QLNN về khoáng sản (vật liệu xây dựng) sang Sở Công Thương; phối hợp xử lý công việc dở dang không làm gián đoạn TTHC.
- **Sở Công Thương:** Chủ trì tiếp nhận toàn bộ chức năng, nhiệm vụ, hồ sơ, tài liệu, dữ liệu, tài sản, tài chính, nhân sự chuyển giao; bố trí sắp xếp theo vị trí việc làm; bảo đảm tiếp nhận liên tục, không làm gián đoạn TTHC.
- **Sở Nội vụ:** Chủ trì phối hợp điều động 11 công chức theo vị trí việc làm; hướng dẫn sắp xếp tổ chức bộ máy, nhân sự đúng quy định.

**4. Quy định chuyển tiếp giải quyết hồ sơ (Điều 4 QĐ 4774):**
- **Kế thừa hồ sơ đang giải quyết:** Các hồ sơ, TTHC về địa chất, khoáng sản đã nộp hợp lệ tại Sở NN&MT hoặc Sở Xây dựng trước 01/10/2026 chưa có kết quả -> **chuyển nguyên trạng sang Sở Công Thương** để tiếp tục giải quyết.
- **Bảo lưu quyền lợi:** Tổ chức, cá nhân **KHÔNG** phải nộp lại hồ sơ, không làm lại các bước đã hoàn thành, **KHÔNG nộp lại phí, lệ phí**; kết quả thẩm định, kiểm tra trước đó được kế thừa; thời hạn giải quyết không tính lại từ đầu.
- **Hiệu lực giấy phép:** Mọi giấy phép, quyết định, văn bản chấp thuận về địa chất, khoáng sản đã ban hành trước ngày 01/10/2026 **tiếp tục có giá trị pháp lý** cho đến khi hết hạn hoặc được điều chỉnh/thay thế theo quy định pháp luật.
- **Xử lý vướng mắc:** Việc chưa rõ cơ quan tiếp nhận -> Sở Công Thương chủ trì phối hợp Sở NN&MT, Sở Xây dựng thống nhất phương án xử lý, báo cáo UBND tỉnh nếu vượt thẩm quyền.

---

### 4. ỦY QUYỀN CỦA UBND TỈNH CHO GIÁM ĐỐC SỞ CÔNG THƯƠNG

**4.1. QĐ 1553/QĐ-UBND ngày 04/10/2025 — Ủy quyền lĩnh vực CN&TM:**
- UBND tỉnh ủy quyền cho Giám đốc Sở CT thực hiện **một số nhiệm vụ, quyền hạn của UBND tỉnh trong lĩnh vực công nghiệp và thương mại** trên địa bàn tỉnh Lâm Đồng.
- Căn cứ: NĐ 146/2025/NĐ-CP (phân quyền, phân cấp CN&TM); TT 38/2025/TT-BCT; TT 40/2025/TT-BCT (xuất xứ hàng hóa)
- Thời hạn: đến hết 28/02/2027 hoặc có VB khác thay thế.
- GĐ SCT chịu trách nhiệm trước UBND tỉnh về kết quả thực hiện.

**4.2. QĐ sửa đổi QĐ 1553 — Bổ sung ủy quyền hoạt động điện lực:**
- Phạm vi bổ sung: **Cấp Giấy phép hoạt động điện lực** cho nhà máy điện rác, điện sinh khối công suất <50 MW, các nguồn khác <30 MW (điểm a khoản 1 Điều 22 NĐ 61/2025/NĐ-CP).
- Căn cứ bổ sung: NQ 19/2026/NQ-CP ngày 29/4/2026 về cắt giảm TTHC; Tờ trình 80/TTr-SCT ngày 28/5/2026.
- Thời hạn: đến hết 28/02/2027 hoặc có VB khác thay thế.

**4.3. QĐ ủy quyền cấp GCN ATTP ngành CT (01/2026):**
- Ủy quyền cho **Giám đốc SCT** và **Chủ tịch UBND các xã, phường, đặc khu** thực hiện cấp Giấy chứng nhận cơ sở đủ điều kiện an toàn thực phẩm thuộc ngành công thương.
- Căn cứ: NĐ 15/2018/NĐ-CP; NĐ 146/2025/NĐ-CP; TT 43/2018/TT-BCT; QĐ 45/2025/QĐ-UBND.
- Bãi bỏ Khoản 3, mục XI Phụ lục kèm theo QĐ 1553/QĐ-UBND.
- Thời hạn: đến hết 28/02/2027.

**4.4. QĐ ủy quyền lĩnh vực hóa chất (05/2026):**
- Ủy quyền cho **Giám đốc SCT** giải quyết TTHC thuộc lĩnh vực **hóa chất, vận chuyển hàng hóa nguy hiểm** trên địa bàn tỉnh.
- Căn cứ: Luật Hóa chất 14/6/2025; NĐ 25/2026/NĐ-CP; NĐ 26/2026/NĐ-CP; NĐ 34/2024/NĐ-CP; NĐ 161/2024/NĐ-CP; TT 01/2026/TT-BCT; TT 02/2026/TT-BCT; TT 15/2026/TT-BCT.
- Thời hạn: đến hết 28/02/2027.

---

### 5. PHÂN CẤP QUẢN LÝ ATTP (QĐ 45/2025/QĐ-UBND, hiệu lực 22/12/2025)

**Nguyên tắc:** Một cửa, một sản phẩm, một cơ sở chỉ chịu sự quản lý của một cơ quan.

**5.1. Sở Y tế** (Điều 4) quản lý ATTP lĩnh vực ngành Y tế:
- Dịch vụ ăn uống do cơ quan cấp tỉnh cấp GCNĐK kinh doanh; bếp ăn tập thể trong KCN, cụm CN; bếp ăn tập thể ngoài KCN≥200 suất; trường học≥400 suất; dịch vụ ăn uống sân bay, nhà khách tỉnh, BV Đa khoa tuyến tỉnh, nhà hàng tiệc cưới
- Nước uống đóng chai, nước khoáng, nước đá, dụng cụ bao gói tiếp xúc TP, TPBS, TPDD y học, thực phẩm chế độ ăn đặc biệt, phụ gia, vi chất

**5.2. Sở Nông nghiệp và Môi trường** (Điều 5) quản lý ATTP ngành NN&MT:
- Cơ sở SX, KD thực phẩm nông lâm thủy sản muối do cấp tỉnh cấp GCN; hợp tác xã; tàu cá≥15m
- Cơ sở sản xuất ban đầu nông, lâm, thủy sản, muối
- Chợ đầu mối, đấu giá nông sản

**5.3. Sở Công Thương** (Điều 6) quản lý ATTP ngành CT:
- Siêu thị, trung tâm thương mại, cửa hàng tiện ích, hệ thống dự trữ, phân phối
- Cơ sở bán buôn thương nhân; cơ sở bán lẻ: siêu thị, TTTM, chuỗi siêu thị mini, chuỗi cửa hàng tiện lợi; chợ trên địa bàn
- Cơ sở SX thực phẩm sử dụng **>10 lao động** trực tiếp và có CSTT: Rượu<3tr lít, bia<50tr lít, nước giải khát<20tr lít, sữa chế biến<20tr lít, dầu thực vật<50k tấn, bánh kẹo<20k tấn, bột&tinh bột<100k tấn
- Cơ sở vừa SX vừa KD tại 1 địa điểm có quy mô theo mục trên
- Cơ sở SX nhiều loại SP thuộc ≥2 ngành, trong đó SP ngành CT có sản lượng lớn nhất
- Trực tiếp quản lý cơ sở có GCN: GMP, HACCP, ISO 22000, IFS, BRC, FSSC 22000

**5.4. UBND xã, phường, đặc khu** (Điều 7) quản lý ATTP tại địa phương:
- Dịch vụ ăn uống quy mô nhỏ (trừ thuộc Điều 4 Sở Y tế), thức ăn đường phố
- Cơ sở TP nông, lâm, thủy sản nhỏ (không có GCNĐK DN cấp tỉnh)
- Cơ sở TP ngành CT: SX ≤10 lao động; siêu thị mini, cửa hàng tiện lợi nhỏ; chợ nhỏ
- Ký cam kết ATTP với cơ sở nhỏ lẻ không thuộc diện cấp GCN

---

### 6. DANH MỤC THỦ TỤC HÀNH CHÍNH THEO THÔNG BÁO SỐ 148/TB-SCT (NGUYÊN VĂN TÀI LIỆU GỐC)

Căn cứ **Quyết định số 4548/QĐ-UBND ngày 15/9/2026** của Chủ tịch UBND tỉnh Lâm Đồng và **Thông báo số 148/TB-SCT ngày 20/9/2026** của Sở Công Thương tỉnh Lâm Đồng (do Phó Giám đốc Trần Vũ Ngoan ký thay Giám đốc Sở; thay thế Thông báo số 134/TB-SCT ngày 21/8/2026):

⛔ **LƯU Ý CỰC KỲ QUAN TRỌNG VỀ QUYẾT ĐỊNH SỐ 4548/QĐ-UBND (TRÁNH SAI SÓT):**
- Quyết định số 4548/QĐ-UBND ngày 15/9/2026 của Chủ tịch UBND tỉnh **CHỈ CÔNG BỐ DANH MỤC TTHC MỚI VÀ SỬA ĐỔI, BỔ SUNG TRONG LĨNH VỰC XUẤT NHẬP KHẨU** (như cấp C/O, CFS...).
- Nhân dịp có QĐ 4548 mới của lĩnh vực Xuất nhập khẩu, Sở Công Thương ban hành Thông báo 148/TB-SCT để công khai **TOÀN BỘ** Danh mục TTHC ngành Công Thương (thay thế Thông báo 134 cũ).
- **TUYỆT ĐỐI KHÔNG ĐƯỢC GÁN** QĐ 4548/QĐ-UBND làm căn cứ công bố cho tất cả 246 TTHC hay tất cả 25 lĩnh vực (Điện lực, Dầu khí, Khoáng sản, Hóa chất, ATTP... đều có các QĐ công bố TTHC chuyên ngành riêng trước đó).
- Khi tạo bảng biểu / file Excel danh mục 246 TTHC cấp tỉnh: **KHÔNG tự ý chèn cột Ghi chú ghi "QĐ 4548/QĐ-UBND" cho mọi dòng**, mà phải tuân thủ đúng các cột nguyên bản của Phụ lục 1 gốc: **STT, Mã TTHC, Tên TTHC, Cổng Dịch vụ công quốc gia, Mã QR**.

⚠️ **TỔNG HỢP SỐ LIỆU CHÍNH THỨC CÔNG KHAI:**
1. **Thủ tục hành chính thuộc thẩm quyền giải quyết của Sở Công Thương:** **255 thủ tục**, gồm:
   - **246 thủ tục hành chính thông thường** (Phụ lục 1 kèm theo).
   - **09 thủ tục hành chính nội bộ** (Phụ lục 2 kèm theo).
2. **Thủ tục hành chính thuộc thẩm quyền giải quyết của UBND cấp xã:** **07 thủ tục** (Phụ lục 3 kèm theo).
3. **Kênh tra cứu & nộp hồ sơ:**
   - Cổng Dịch vụ công Quốc gia: https://dichvucong.gov.vn
   - Điện thoại hỗ trợ hướng dẫn: **0263.3540.616 (số máy lẻ: 08 - Quầy tiếp nhận Sở Công Thương)** tại Trung tâm Phục vụ Hành chính công tỉnh Lâm Đồng.

---

#### 6.1. DANH MỤC 07 THỦ TỤC HÀNH CHÍNH CẤP XÃ (NGUYÊN VĂN PHỤ LỤC 3 KÈM THÔNG BÁO 148/TB-SCT)
*Danh mục TTHC trên lĩnh vực ngành Công Thương thuộc thẩm quyền giải quyết của cấp xã:*

1. **Mã TTHC: 1.012568** — **Giao tài sản kết cấu hạ tầng chợ do cấp xã quản lý**
   - Lĩnh vực: Tài sản kết cấu hạ tầng chợ do nhà nước đầu tư quản lý
   - Tra cứu DVCQG: https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bf7-fc47-724d-98ee-1785e5599e34

2. **Mã TTHC: 1.012569** — **Thu hồi tài sản kết cấu hạ tầng chợ**
   - Lĩnh vực: Tài sản kết cấu hạ tầng chợ do nhà nước đầu tư quản lý
   - Tra cứu DVCQG: https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bf7-fc53-748c-8af0-461a97b5f80b

3. **Mã TTHC: 2.000206** — **Thẩm định, phê duyệt phương án ứng phó thiên tai cho công trình vùng hạ du đập thủy điện thuộc thẩm quyền phê duyệt của Ủy ban nhân dân cấp xã**
   - Lĩnh vực: An toàn đập, hồ chứa thủy điện
   - Tra cứu DVCQG: https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bf8-235d-7442-9ce7-64d33f904546

4. **Mã TTHC: 2.002620** — **Thông báo về việc thực hiện hoạt động bán hàng không tại địa điểm giao dịch thường xuyên**
   - Lĩnh vực: Bảo vệ người tiêu dùng
   - Tra cứu DVCQG: https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bf8-4a88-761c-a413-252b766cc878

5. **Mã TTHC: 2.000591** — **Cấp Giấy chứng nhận đủ điều kiện an toàn thực phẩm đối với cơ sở sản xuất, kinh doanh thực phẩm do Sở Công Thương thực hiện**
   - Lĩnh vực: An toàn thực phẩm
   - Tra cứu DVCQG: https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bf8-330c-77dd-8058-19a40f5959f5

6. **Mã TTHC: 2.000535** — **Cấp lại Giấy chứng nhận đủ điều kiện an toàn thực phẩm đối với cơ sở sản xuất, kinh doanh thực phẩm do Sở Công Thương thực hiện**
   - Lĩnh vực: An toàn thực phẩm
   - Tra cứu DVCQG: https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019d2bf8-32f5-71a9-8925-3524dc3d03fd

7. **Mã TTHC: 1.115377** — **Thông báo phát triển nguồn điện mặt trời mái nhà tự sản xuất, tự tiêu thụ đấu nối với hệ thống điện quốc gia tại cấp điện áp hạ áp**
   - Lĩnh vực: Điện lực
   - Tra cứu DVCQG: https://dichvucong.gov.vn/thu-tuc-hanh-chinh/019f1695-894f-72b8-80a8-2fee368722be

---

#### 6.2. DANH MỤC 09 THỦ TỤC HÀNH CHÍNH NỘI BỘ (NGUYÊN VĂN PHỤ LỤC 2 KÈM THÔNG BÁO 148/TB-SCT)
*Danh mục TTHC nội bộ thuộc thẩm quyền giải quyết của Sở Công Thương:*

| STT | Tên thủ tục | Lĩnh vực | Cơ quan thực hiện | Quyết định công bố |
|:---:|:---|:---:|:---|:---|
| **1** | **Điều chỉnh cập nhật phương án phát triển mạng lưới cấp điện trong quy hoạch tỉnh** | Điện lực | Sở Công Thương | Quyết định số 3968/QĐ-UBND ngày 04/8/2026 |
| **2** | **Xây dựng kế hoạch khuyến công quốc gia** | Công nghiệp địa phương | Cục Đổi mới sáng tạo, Chuyển đổi xanh và Khuyến công (Bộ Công Thương), Sở Công Thương | Quyết định số 4001/QĐ-UBND ngày 06/8/2026 |
| **3** | **Điều chỉnh, bổ sung và ngừng triển khai đề án khuyến công** | Công nghiệp địa phương | Cục Đổi mới sáng tạo, Chuyển đổi xanh và Khuyến công (Bộ Công Thương), Sở Công Thương | Quyết định số 4001/QĐ-UBND ngày 06/8/2026 |
| **4** | **Tổ chức thực hiện đề án khuyến công quốc gia** | Công nghiệp địa phương | Sở Công Thương | Quyết định số 4001/QĐ-UBND ngày 06/8/2026 |
| **5** | **Cấp tài khoản, phân quyền tài khoản sử dụng cơ sở dữ liệu môi trường ngành Công Thương** | An toàn đập và môi trường | Cục Kỹ thuật an toàn và Môi trường, Sở Công Thương | Quyết định số 4001/QĐ-UBND ngày 06/8/2026 |
| **6** | **Tham vấn ý kiến của cơ quan quản lý ngành, lĩnh vực, địa phương về hợp đồng theo mẫu, điều kiện giao dịch chung** | Bảo vệ quyền lợi người tiêu dùng | Sở Công Thương, cơ quan quản lý ngành, lĩnh vực, địa phương | Quyết định số 4001/QĐ-UBND ngày 06/8/2026 |
| **7** | **Cung cấp danh sách tổ chức, cá nhân kinh doanh áp dụng hợp đồng theo mẫu, điều kiện giao dịch chung trong giao dịch với người tiêu dùng** | Bảo vệ quyền lợi người tiêu dùng | Cơ quan quản lý nhà nước về bảo vệ quyền lợi người tiêu dùng thuộc Bộ Công Thương, Sở Công Thương | Quyết định số 4001/QĐ-UBND ngày 06/8/2026 |
| **8** | **Xin ý kiến xử lý tài sản là tang vật, phương tiện vi phạm hành chính bị tịch thu** | Quản lý thị trường | Sở Công Thương và các cơ quan liên quan | Quyết định số 4001/QĐ-UBND ngày 06/8/2026 |
| **9** | **Lấy ý kiến thẩm định của Bộ Công an bằng văn bản về an ninh quốc gia** | Thương mại điện tử | Cơ quan có thẩm quyền cấp, điều chỉnh Giấy phép kinh doanh của chủ quản nền tảng thương mại điện tử quy định tại điểm b khoản 1 Điều 40 Nghị định 248/2026/NĐ-CP | Quyết định số 4001/QĐ-UBND ngày 06/8/2026 |

---

#### 6.3. PHẠM VI 246 TTHC CẤP TỈNH (PHỤ LỤC 1 KÈM THÔNG BÁO 148/TB-SCT)
Gồm 25 lĩnh vực quản lý nhà nước do Sở Công Thương giải quyết:
- I. Điện (cấp giấy phép hoạt động điện lực, thẩm định thiết kế, kiểm tra công tác nghiệm thu công trình điện...)
- II. Thẩm định, thỏa thuận kỹ thuật chuyên ngành
- III. Dầu khí (kinh doanh dầu mỏ, khí đốt)
- IV. Chất lượng sản phẩm hàng hóa
- V. Xuất nhập khẩu (chứng nhận xuất xứ hàng hóa, giấy phép kinh doanh xuất nhập khẩu)
- VI. Hội nhập Quốc tế
- VII. An toàn thực phẩm
- VIII. Công nghiệp tiêu dùng
- IX. Lưu thông hàng hóa trong nước (xăng dầu, khí LPG, rượu, thuốc lá, logistics...)
- X. Thương mại quốc tế (văn phòng đại diện thương nhân nước ngoài)
- XI. Quản lý cạnh tranh
- XII. Quản lý bán hàng đa cấp
- XIII. Bảo vệ người tiêu dùng
- XIV. Vật liệu nổ công nghiệp
- XV. Giám định thương mại
- XVI. Khoáng sản (khai thác, thăm dò khoáng sản làm VLXD thông thường, than bùn theo thẩm quyền UBND tỉnh)
- XVII. An toàn vệ sinh lao động
- XVIII. Cụm Công nghiệp
- XIX. Hóa chất
- XX. Thương mại điện tử
- XXI. Xúc tiến thương mại (khuyến mại, hội chợ triển lãm...)
- XXII. Công nghiệp hỗ trợ
- XXIII. Nghề thủ công mỹ nghệ
- XXIV. Vận chuyển hàng hóa nguy hiểm
- XXV. Tài sản kết cấu hạ tầng chợ do cấp tỉnh quản lý

---

### 7. CÁC VĂN BẢN ĐÃ HẾT HIỆU LỰC / BỊ BÃI BỎ

⛔ **TUYỆT ĐỐI KHÔNG DẪN CHIẾU** các QĐ sau (đã bãi bỏ):
1. QĐ số 04/2025/QĐ-UBND ngày 08/8/2025 — Quy định CNNVQH Sở CT (bãi bỏ bởi QĐ 80/2026/QĐ-UBND)
2. QĐ số 190/QĐ-UBND ngày 05/7/2025 — Phê duyệt cơ cấu tổ chức Sở CT (thay thế bởi QĐ 4775/QĐ-UBND)
3. QĐ số 33/2022/QĐ-UBND ngày 24/6/2022 — CNNVQH Sở CT Lâm Đồng (cũ)
4. QĐ số 56/2023/QĐ-UBND ngày 12/10/2023 — Sửa đổi QĐ 33/2022
5. QĐ số 410/QĐ-UBND ngày 27/02/2025 — CNNVQH Sở CT Lâm Đồng (giai đoạn sáp nhập)
6. QĐ số 15/2025/QĐ-UBND ngày 28/4/2025 — CNNVQH Sở CT Bình Thuận (đã sáp nhập vào Lâm Đồng)
7. QĐ số 29/2022/QĐ-UBND ngày 30/8/2022 — CNNVQH Sở CT Đắk Nông (đã sáp nhập vào Lâm Đồng)
8. QĐ số 02/2024/QĐ-UBND ngày 26/01/2024 — Sửa đổi QĐ 29/2022 Đắk Nông
9. QĐ số 45/2019/QĐ-UBND, QĐ 52/2022/QĐ-UBND — Phân cấp ATTP ngành CT (Lâm Đồng cũ)
10. QĐ số 26/2020/QĐ-UBND, QĐ 17/2023/QĐ-UBND — Phân cấp ATTP (Lâm Đồng cũ)
11. QĐ số 03/2020/QĐ-UBND, QĐ 08/2021/QĐ-UBND — Phân cấp ATTP (Đắk Nông cũ)
12. QĐ số 36/2022/QĐ-UBND — Phân cấp ATTP (Bình Thuận cũ)
13. Thông báo số 134/TB-SCT ngày 21/8/2026 của Sở Công Thương (đã bị thay thế bởi Thông báo số 148/TB-SCT)

---

### 8. QUY TẮC BẮT BUỘC KHI TRẢ LỜI VỀ TTHC VÀ NGÀNH CÔNG THƯƠNG

1. **Tuyệt đối không suy diễn TTHC cấp xã:**
   - Khi được hỏi về TTHC cấp xã thuộc ngành Công Thương theo Thông báo 148/TB-SCT, chỉ trả lời đúng **07 thủ tục** tại Phụ lục 3:
     (1) Giao tài sản kết cấu hạ tầng chợ do cấp xã quản lý (Mã 1.012568)
     (2) Thu hồi tài sản kết cấu hạ tầng chợ (Mã 1.012569)
     (3) Thẩm định, phê duyệt PA ứng phó thiên tai vùng hạ du đập thủy điện thuộc thẩm quyền UBND xã (Mã 2.000206)
     (4) Thông báo hoạt động bán hàng không tại địa điểm giao dịch thường xuyên (Mã 2.002620)
     (5) Cấp GCN đủ điều kiện ATTP do SCT thực hiện (Mã 2.000591)
     (6) Cấp lại GCN đủ điều kiện ATTP do SCT thực hiện (Mã 2.000535)
     (7) Thông báo phát triển nguồn điện mặt trời mái nhà tự sản xuất, tự tiêu thụ đấu nối lưới điện quốc gia hạ áp (Mã 1.115377)
   - KHÔNG tự tiện lấy danh mục rượu thủ công hay thuốc lá đưa vào cấp xã nếu ngữ cảnh đang hỏi về danh mục công khai theo Thông báo 148/TB-SCT.

2. **Tuyệt đối không suy diễn 09 TTHC nội bộ:**
   - 09 TTHC nội bộ chuẩn theo Phụ lục 2 kèm Thông báo 148/TB-SCT được công bố theo QĐ số 3968/QĐ-UBND và QĐ số 4001/QĐ-UBND ngày 06/8/2026, gồm:
     (1) Điều chỉnh cập nhật phương án phát triển mạng lưới cấp điện trong quy hoạch tỉnh
     (2) Xây dựng kế hoạch khuyến công quốc gia
     (3) Điều chỉnh, bổ sung và ngừng triển khai đề án khuyến công
     (4) Tổ chức thực hiện đề án khuyến công quốc gia
     (5) Cấp tài khoản, phân quyền tài khoản sử dụng CSDL môi trường ngành Công Thương
     (6) Tham vấn ý kiến về hợp đồng theo mẫu, điều kiện giao dịch chung
     (7) Cung cấp danh sách tổ chức, cá nhân kinh doanh áp dụng hợp đồng theo mẫu
     (8) Xin ý kiến xử lý tài sản là tang vật, phương tiện vi phạm hành chính bị tịch thu
     (9) Lấy ý kiến thẩm định của Bộ Công an bằng văn bản về an ninh quốc gia đối với nền tảng TMĐT
   - KHÔNG tự đặt mã thủ tục (như NB-SCT-01) hay gán ghép các quy trình nội bộ khác vào danh mục này.

3. **Thông tin đầu mối liên hệ chính thức:**
   - Cổng Dịch vụ công Quốc gia: https://dichvucong.gov.vn
   - Điện thoại hỗ trợ: 0263.3540.616 (số máy lẻ: 08 - Quầy tiếp nhận Sở Công Thương) tại Trung tâm Phục vụ Hành chính công tỉnh Lâm Đồng.
`.trim();


