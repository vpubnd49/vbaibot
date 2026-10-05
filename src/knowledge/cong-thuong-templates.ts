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

### 6. DANH MỤC THỦ TỤC HÀNH CHÍNH TOÀN NGÀNH CÔNG THƯƠNG (THÔNG BÁO 148/TB-SCT & QĐ 4548/QĐ-UBND)

⚠️ **BẢNG TỔNG HỢP SỐ LIỆU CHUẨN XÁC — TUYỆT ĐỐI KHÔNG NHẦM LẪN:**
1. **Cấp tỉnh (Sở Công Thương giải quyết và quản lý):** **255 TTHC**
   - **Phụ lục 1:** **246 TTHC** thông thường dành cho cá nhân, tổ chức, thương nhân, doanh nghiệp.
   - **Phụ lục 2:** **09 TTHC nội bộ** giữa các cơ quan hành chính nhà nước trên địa bàn tỉnh.
2. **Cấp xã (UBND cấp xã giải quyết):** **07 TTHC** (Phụ lục 3).
3. **Tổng số TTHC toàn ngành Công Thương trên địa bàn tỉnh:** **262 TTHC** (255 cấp tỉnh + 07 cấp xã).

---

#### 6.1. CHI TIẾT 07 TTHC CẤP XÃ (Phụ lục 3 kèm Thông báo 148/TB-SCT)
*Thực hiện tiếp nhận tại Bộ phận Một cửa UBND cấp xã hoặc nộp trực tuyến qua Cổng DVC Quốc gia / Hệ thống thông tin giải quyết TTHC tỉnh.*

| TT | Tên thủ tục hành chính | Thời hạn giải quyết | Lĩnh vực | Căn cứ pháp lý |
|:---|:---|:---:|:---:|:---|
| 1 | **Cấp Giấy phép sản xuất rượu thủ công nhằm mục đích kinh doanh** | 10 ngày làm việc | Lưu thông hàng hóa trong nước | QĐ 1920/QĐ-BCT, QĐ 1395/QĐ-UBND |
| 2 | **Cấp lại Giấy phép sản xuất rượu thủ công nhằm mục đích kinh doanh** | 07 ngày làm việc | Lưu thông hàng hóa trong nước | QĐ 1920/QĐ-BCT, QĐ 1395/QĐ-UBND |
| 3 | **Cấp sửa đổi, bổ sung Giấy phép sản xuất rượu thủ công nhằm mục đích kinh doanh** | 07 ngày làm việc | Lưu thông hàng hóa trong nước | QĐ 1920/QĐ-BCT, QĐ 1395/QĐ-UBND |
| 4 | **Cấp Giấy phép bán lẻ sản phẩm thuốc lá** | 15 ngày làm việc | Lưu thông hàng hóa trong nước | QĐ 1441/QĐ-BCT, QĐ 1395/QĐ-UBND |
| 5 | **Cấp sửa đổi, bổ sung Giấy phép bán lẻ sản phẩm thuốc lá** | 15 ngày làm việc | Lưu thông hàng hóa trong nước | QĐ 1441/QĐ-BCT, QĐ 1395/QĐ-UBND |
| 6 | **Cấp lại Giấy phép bán lẻ sản phẩm thuốc lá** | 15 ngày làm việc | Lưu thông hàng hóa trong nước | QĐ 1441/QĐ-BCT, QĐ 1395/QĐ-UBND |
| 7 | **Cấp Giấy chứng nhận sản phẩm công nghiệp nông thôn tiêu biểu cấp xã** | Theo Kế hoạch bình chọn cấp xã | Khuyến công, cụm công nghiệp | QĐ 1441/QĐ-BCT |

⛔ **LƯU Ý TRÁNH SAI SÓT PHỔ BIẾN:**
- Cấp xã **chỉ có 07 thủ tục** trên (3 thủ tục Rượu thủ công + 3 thủ tục Bán lẻ thuốc lá + 1 thủ tục Bình chọn SP CNNT tiêu biểu cấp xã).
- KHÔNG đưa các thủ tục chợ cấp xã hay thẩm định phương án thủy điện vào danh mục TTHC cấp xã vì theo chuẩn chính thức Thông báo 148/TB-SCT chỉ duyệt đúng 7 thủ tục nêu trên.

---

#### 6.2. CHI TIẾT 09 TTHC NỘI BỘ GIỮA CÁC CƠ QUAN HÀNH CHÍNH (Phụ lục 2 kèm Thông báo 148/TB-SCT)
*Thực hiện giữa Sở Công Thương, UBND tỉnh, các Sở, ngành và UBND cấp huyện/xã:*

| Mã thủ tục | Tên thủ tục hành chính nội bộ | Cơ quan / Phòng ban chủ trì thực hiện | Căn cứ & Đặc điểm quy trình |
|:---:|:---|:---|:---|
| **NB-SCT-01** | **Lập, thẩm định và phê duyệt Kế hoạch khuyến công địa phương hằng năm** | Phòng Kế hoạch - Tổng hợp / Trung tâm Khuyến công | Định kỳ hằng năm; tổng hợp nhu cầu khuyến công toàn tỉnh trình UBND tỉnh phê duyệt |
| **NB-SCT-02** | **Thẩm định Đề án thành lập, mở rộng cụm công nghiệp trên địa bàn tỉnh** | Phòng Quản lý Công nghiệp | Thực hiện theo Nghị định 32/2024/NĐ-CP về quản lý, phát triển cụm công nghiệp |
| **NB-SCT-03** | **Thẩm định Phương án giá điện, giá phân phối điện cục bộ tại địa phương** | Phòng Quản lý Năng lượng | Căn cứ Luật Điện lực và các thông tư hướng dẫn của Bộ Công Thương |
| **NB-SCT-04** | **Thẩm định Báo cáo nghiên cứu khả thi đầu tư xây dựng / Báo cáo KT-KT đầu tư xây dựng công trình năng lượng, công nghiệp chuyên ngành** | Phòng Quản lý Năng lượng (năng lượng) / Phòng Quản lý Công nghiệp (công nghiệp) | Theo Luật Xây dựng và Luật Điện lực; áp dụng cho dự án nguồn điện, lưới điện, kho xăng dầu, hóa chất |
| **NB-SCT-05** | **Kiểm tra công tác nghiệm thu đưa công trình điện lực, công nghiệp chuyên ngành vào sử dụng** | Phòng Quản lý Năng lượng / Phòng Quản lý Công nghiệp | Kiểm tra hiện trường, hồ sơ hoàn công trước khi cho phép đóng điện hoặc đưa vào vận hành thương mại |
| **NB-SCT-06** | **Thẩm định Kế hoạch phòng ngừa, ứng phó sự cố hóa chất cấp tỉnh** | Phòng Quản lý Công nghiệp | Căn cứ Luật Hóa chất; phối hợp các lực lượng PCCC&CNCH, Công an, Quân đội, Y tế |
| **NB-SCT-07** | **Kiểm tra, đánh giá an toàn đập, hồ chứa thủy điện trước mùa mưa bão hằng năm** | Phòng Quản lý Năng lượng | Định kỳ hằng năm trước mùa mưa bão đối với tất cả các nhà máy, bậc thang thủy điện trên địa bàn |
| **NB-SCT-08** | **Thẩm định Đề án đóng cửa mỏ khoáng sản thuộc thẩm quyền của UBND cấp tỉnh** | **Phòng Địa chất và Khoáng sản** | Căn cứ Luật Địa chất và Khoáng sản; thẩm định đề án phục hồi môi trường và đóng cửa mỏ sau khai thác |
| **NB-SCT-09** | **Tổ chức bình chọn sản phẩm công nghiệp nông thôn tiêu biểu cấp tỉnh** | Hội đồng bình chọn cấp tỉnh (Thường trực: Sở Công Thương - Trung tâm Khuyến công) | Chu kỳ định kỳ **02 năm một lần** để tôn vinh sản phẩm CNNT tiêu biểu cấp tỉnh và chọn đi thi cấp khu vực/quốc gia |

---

#### 6.3. CƠ CẤU 246 TTHC CẤP TỈNH (Phụ lục 1 kèm Thông báo 148/TB-SCT)
246 TTHC cấp tỉnh của Sở Công Thương giải quyết được phân thành các nhóm lĩnh vực chính:
1. **Lĩnh vực Thương mại và Lưu thông hàng hóa trong nước:**
   - Kinh doanh Xăng dầu: Cấp/sửa đổi/cấp lại Giấy chứng nhận cửa hàng đủ điều kiện bán lẻ xăng dầu; Giấy xác nhận đủ điều kiện làm thương nhân phân phối xăng dầu.
   - Kinh doanh Khí (LPG): Cấp/điều chỉnh Giấy chứng nhận đủ điều kiện thương nhân phân phối khí, trạm nạp khí, trạm cấp khí, cửa hàng bán lẻ LPG chai.
   - Kinh doanh Rượu: Cấp/sửa đổi/cấp lại Giấy phép bán buôn rượu; Giấy phép sản xuất rượu công nghiệp quy mô dưới 03 triệu lít/năm.
   - Kinh doanh Thuốc lá: Cấp/sửa đổi/cấp lại Giấy phép phân phối sản phẩm thuốc lá; Giấy phép bán buôn sản phẩm thuốc lá.
   - Hoạt động Logistics, chợ, hạ tầng thương mại.
2. **Lĩnh vực Năng lượng và Điện lực:**
   - Cấp, sửa đổi, bổ sung Giấy phép hoạt động điện lực (theo ủy quyền QĐ 1553 sửa đổi đối với điện rác, điện sinh khối <50MW, nguồn khác <30MW; phân phối điện, bán lẻ điện).
   - Thỏa thuận hướng tuyến, điểm đấu nối, thỏa thuận kỹ thuật công trình điện.
   - Thẩm định, phê duyệt phương án ứng phó thiên tai, phương án bảo vệ đập, hồ chứa thủy điện.
3. **Lĩnh vực Hóa chất và Vật liệu nổ công nghiệp (VLNCN):**
   - Cấp/cấp lại/điều chỉnh Giấy phép sản xuất, kinh doanh hóa chất sản xuất kinh doanh có điều kiện trong lĩnh vực công nghiệp (theo ủy quyền QĐ 05/2026).
   - Phê duyệt Kế hoạch / Biện pháp phòng ngừa ứng phó sự cố hóa chất nhóm công nghiệp.
   - Cấp Giấy phép sử dụng vật liệu nổ công nghiệp (VLNCN); Giấy đăng ký sử dụng VLNCN.
4. **Lĩnh vực Địa chất và Khoáng sản (Tiếp nhận mới từ 01/10/2026 theo QĐ 4774, QĐ 4775):**
   - Thẩm định hồ sơ cấp, gia hạn, trả lại Giấy phép thăm dò khoáng sản làm VLXD thông thường và than bùn thuộc thẩm quyền UBND tỉnh.
   - Thẩm định hồ sơ cấp, gia hạn, trả lại, chuyển nhượng Giấy phép khai thác khoáng sản làm VLXD thông thường và đất san lấp.
   - Phê duyệt trữ lượng khoáng sản trong báo cáo kết quả thăm dò khoáng sản thuộc thẩm quyền cấp tỉnh.
   - Xác định tiền cấp quyền khai thác khoáng sản, thẩm định hồ sơ đấu giá quyền khai thác khoáng sản.
5. **Lĩnh vực An toàn thực phẩm ngành Công Thương:**
   - Cấp/cấp lại Giấy chứng nhận cơ sở đủ điều kiện ATTP đối với các cơ sở sản xuất có quy mô >10 lao động, siêu thị, trung tâm thương mại, chuỗi bán lẻ thuộc thẩm quyền ngành Công Thương (theo QĐ 45/2025/QĐ-UBND và ủy quyền QĐ 01/2026).
6. **Lĩnh vực Xúc tiến thương mại - Hội chợ triển lãm:**
   - Tiếp nhận thông báo / Đăng ký thực hiện chương trình khuyến mại (hội chợ, bốc thăm, tặng quà...).
   - Đăng ký tổ chức hội chợ, triển lãm thương mại trên địa bàn tỉnh Lâm Đồng.
7. **Lĩnh vực Cạnh tranh và Bảo vệ quyền lợi người tiêu dùng:**
   - Đăng ký / Thông báo hoạt động bán hàng đa cấp tại địa phương.
   - Tiếp nhận đăng ký hợp đồng theo mẫu, điều kiện giao dịch chung.

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

---

### 8. QUY TẮC SUY LẬN CHO AGENT KHI HỖ TRỢ NGƯỜI DÙNG & TTHC

**1. Phân định thẩm quyền TTHC giữa Sở Công Thương và UBND cấp xã:**
- **Kinh doanh Rượu:**
  + Sản xuất rượu thủ công nhằm mục đích kinh doanh (cấp mới, cấp lại, sửa đổi): **UBND cấp xã** giải quyết (thời hạn 10 ngày với cấp mới, 7 ngày với cấp lại/sửa đổi).
  + Bán buôn rượu hoặc Sản xuất rượu công nghiệp: **Sở Công Thương** giải quyết.
- **Kinh doanh Thuốc lá:**
  + Bán lẻ sản phẩm thuốc lá (cấp mới, cấp lại, sửa đổi): **UBND cấp xã** giải quyết (thời hạn 15 ngày làm việc).
  + Bán buôn hoặc Phân phối sản phẩm thuốc lá: **Sở Công Thương** giải quyết.
- **Bình chọn Sản phẩm Công nghiệp nông thôn tiêu biểu:**
  + Cấp xã: **UBND cấp xã** tổ chức và cấp Giấy chứng nhận theo kế hoạch bình chọn cấp xã.
  + Cấp tỉnh: **Sở Công Thương** (Trung tâm Khuyến công) thường trực tổ chức bình chọn chu kỳ 02 năm/lần (TTHC nội bộ NB-SCT-09).

**2. Phân định phòng ban chủ trì xử lý TTHC nội bộ:**
- NB-SCT-01 (Kế hoạch khuyến công hằng năm): **Phòng Kế hoạch - Tổng hợp / Trung tâm Khuyến công**.
- NB-SCT-02 (Cụm công nghiệp): **Phòng Quản lý Công nghiệp**.
- NB-SCT-03 (Phương án giá điện cục bộ): **Phòng Quản lý Năng lượng**.
- NB-SCT-04, NB-SCT-05 (Thẩm định dự án & nghiệm thu công trình chuyên ngành): **Phòng Quản lý Năng lượng** (điện lực) hoặc **Phòng Quản lý Công nghiệp** (công trình công nghiệp).
- NB-SCT-06 (Kế hoạch ứng phó sự cố hóa chất): **Phòng Quản lý Công nghiệp**.
- NB-SCT-07 (An toàn hồ đập thủy điện): **Phòng Quản lý Năng lượng**.
- NB-SCT-08 (Đóng cửa mỏ khoáng sản): **Phòng Địa chất và Khoáng sản**.
- NB-SCT-09 (Bình chọn SP CNNT cấp tỉnh): **Trung tâm Khuyến công**.

**3. Phân công lĩnh vực quản lý nhà nước:**
- Khi người dùng hỏi về **địa chất, khoáng sản** tỉnh Lâm Đồng (từ 01/10/2026 trở đi): đơn vị QLNN là **Sở Công Thương** (Phòng Địa chất và Khoáng sản), KHÔNG PHẢI Sở NNMT hay Sở XD.
- Khi giao nhiệm vụ liên quan **khoáng sản, thăm dò, khai thác mỏ, cấp phép khoáng sản, đóng cửa mỏ, đấu giá quyền khai thác, tính tiền cấp quyền khai thác khoáng sản, mỏ cát, sỏi, đá, bô-xít, titan, đất san lấp** → giao **Sở Công Thương** (Phòng Địa chất và Khoáng sản) chủ trì tham mưu.
- Khi xử lý vụ việc vướng mắc, khiếu nại, tố tụng hoặc chồng lấn giữa dự án năng lượng (điện gió, thủy điện, điện mặt trời) và khu vực mỏ khoáng sản (như mỏ titan, bô-xít) → giao **Sở Công Thương** chủ trì (vì cả 2 lĩnh vực năng lượng và khoáng sản đều thuộc Sở Công Thương phụ trách).
- Khi soạn CV giao Sở tham mưu về **điện, năng lượng tái tạo, điện mặt trời, điện gió** → giao **Sở Công Thương** (Phòng Quản lý Năng lượng).
- Khi soạn CV về **chống buôn lậu, gian lận thương mại, hàng giả, kiểm tra thị trường** → giao **Sở Công Thương** (Chi cục Quản lý thị trường).
- Khi soạn CV về **khuyến công, cụm công nghiệp, tiểu thủ công nghiệp** → giao **Sở Công Thương** (Trung tâm Khuyến công / Phòng Quản lý Công nghiệp).
- Khi soạn CV về **thương mại điện tử, kinh tế số, xúc tiến thương mại** → giao **Sở Công Thương** (Phòng Quản lý Thương mại).
- Khi soạn CV về **hóa chất, vận chuyển hàng hóa nguy hiểm, VLNCN** → giao **Sở Công Thương** (được ủy quyền giải quyết TTHC).

**4. Phân cấp ATTP — phân biệt rõ 3 tầng:**
- **Sở Y tế** chủ trì: dịch vụ ăn uống quy mô lớn (cấp tỉnh cấp phép, bếp KCN, ≥200/400 suất), SP ngành Y tế (nước uống, phụ gia, TPBS, TPDD y học).
- **Sở NNMT** chủ trì: SX KD thực phẩm nông lâm thủy sản muối do cấp tỉnh cấp phép, chợ đầu mối.
- **Sở Công Thương** chủ trì: siêu thị, TTTM, cửa hàng tiện ích, hệ thống dự trữ phân phối, cơ sở SX >10 lao động (rượu, bia, nước giải khát, sữa, dầu TV, bánh kẹo, bột).
- **UBND xã, phường, đặc khu**: ăn uống nhỏ lẻ, thức ăn đường phố, cơ sở SX ≤10 LĐ, siêu thị mini nhỏ.

**5. Địa điểm tiếp nhận hồ sơ TTHC:**
- Cấp tỉnh: Trung tâm Phục vụ hành chính công tỉnh Lâm Đồng (số 36 Trần Phú, phường 4, TP. Đà Lạt).
- Cấp xã: Bộ phận Tiếp nhận và Trả kết quả thuộc UBND xã, phường, đặc khu.
- Trực tuyến: Cổng Dịch vụ công Quốc gia (`dichvucong.gov.vn`) và Hệ thống thông tin giải quyết TTHC tỉnh Lâm Đồng (`dichvucong.lamdong.gov.vn`).
`.trim();

