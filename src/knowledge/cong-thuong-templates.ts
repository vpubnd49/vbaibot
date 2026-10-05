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
 * Agent sử dụng khối tri thức này khi:
 *  1. Trả lời câu hỏi về chức năng, nhiệm vụ Sở Công Thương
 *  2. Soạn thảo VB liên quan đến công thương, năng lượng, khoáng sản, hóa chất
 *  3. Phân công đúng đơn vị khi giao việc công nghiệp, thương mại, ATTP,
 *     địa chất, khoáng sản, năng lượng, QLTT, hóa chất, điện lực
 *  4. Nhận diện thẩm quyền ủy quyền (GĐ SCT thay mặt UBND tỉnh)
 *  5. Phân biệt phân cấp ATTP giữa Sở Y tế / Sở NNMT / Sở CT / UBND xã
 */

export const CONG_THUONG_KNOWLEDGE_PROMPT = `
## TRI THỨC CHUYÊN NGÀNH CÔNG THƯƠNG — SỞ CÔNG THƯƠNG TỈNH LÂM ĐỒNG

⚠️ **THAY ĐỔI QUAN TRỌNG TỪ 01/10/2026:**
- QĐ số 80/2026/QĐ-UBND ngày 01/10/2026: **BÃI BỎ TOÀN BỘ** Quyết định số 04/2025/QĐ-UBND ngày 08/8/2025 về chức năng, nhiệm vụ và quyền hạn của Sở Công Thương.
- QĐ số 4775/QĐ-UBND ngày 01/10/2026: **BAN HÀNH MỚI** Quy định chức năng, nhiệm vụ, quyền hạn và cơ cấu tổ chức của Sở Công Thương tỉnh Lâm Đồng (thay thế QĐ 190/QĐ-UBND ngày 05/7/2025 về phê duyệt cơ cấu tổ chức).
- QĐ số 4774/QĐ-UBND ngày 01/10/2026: **THÀNH LẬP** Phòng Địa chất và Khoáng sản thuộc Sở Công Thương.

### CĂN CỨ PHÁP LÝ HIỆN HÀNH
- Luật Tổ chức chính quyền địa phương số 72/2025/QH15
- Nghị quyết số 66.25/2026/NQ-CP ngày 04/9/2026 của Chính phủ về xử lý khó khăn, vướng mắc liên quan đến chức năng, nhiệm vụ, quyền hạn quản lý nhà nước về khu công nghiệp, địa chất, khoáng sản
- Nghị định số 150/2025/NĐ-CP ngày 12/6/2025 quy định tổ chức các cơ quan chuyên môn thuộc UBND tỉnh (được sửa đổi, bổ sung bởi NĐ 370/2025/NĐ-CP)
- Nghị định số 146/2025/NĐ-CP ngày 12/6/2025 quy định phân quyền, phân cấp trong lĩnh vực công nghiệp và thương mại
- Nghị định số 139/2025/NĐ-CP ngày 12/6/2025 quy định phân định thẩm quyền chính quyền địa phương 02 cấp trong lĩnh vực QLNN của Bộ CT
- Thông tư số 37/2025/TT-BCT ngày 14/6/2025 hướng dẫn chức năng, nhiệm vụ, quyền hạn của cơ quan chuyên môn về công thương (được sửa đổi, bổ sung bởi TT 50/2026/TT-BCT ngày 13/9/2026)
- Thông tư số 38/2025/TT-BCT ngày 19/6/2025 sửa đổi, bổ sung về phân cấp thực hiện TTHC (sửa đổi bởi TT 15/2026/TT-BCT ngày 25/3/2026)
- Luật Hóa chất ngày 14/6/2025; NĐ 25/2026/NĐ-CP, NĐ 26/2026/NĐ-CP; TT 01/2026/TT-BCT, TT 02/2026/TT-BCT

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

### 6. ĐIỀU KHOẢN CHUYỂN TIẾP

- Sở Công Thương tiếp tục tham mưu, giúp UBND tỉnh thực hiện nhiệm vụ, quyền hạn quản lý nhà nước **về an toàn thực phẩm** theo quy định pháp luật cho đến khi có quy định khác của cơ quan có thẩm quyền.

- **Về chuyển giao địa chất, khoáng sản (QĐ 4774/QĐ-UBND):**
  + Sở Nông nghiệp và Môi trường: bàn giao đầy đủ hồ sơ, tài liệu, dữ liệu, cơ sở dữ liệu, chương trình, đề án, dự án, tài sản và các nguồn lực liên quan đến nhiệm vụ chuyển giao
  + Sở Xây dựng: bàn giao nhiệm vụ quản lý nhà nước về khoáng sản thuộc phạm vi chuyển giao
  + Sở Công Thương: chủ trì tiếp nhận, tổ chức quản lý và sử dụng
  + Sở Nội vụ: chủ trì phối hợp điều động công chức theo vị trí việc làm (11 biên chế từ Sở NNMT)
  + Các hồ sơ, TTHC về ĐC, KS đã được Sở NNMT, Sở XD thụ lý trước thời điểm hiệu lực mà chưa có kết quả → chuyển nguyên trạng cho Sở CT tiếp tục giải quyết
  + Các giấy phép, quyết định, văn bản chấp thuận về ĐC, KS đã ban hành trước đây tiếp tục có giá trị pháp lý

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

### 8. QUY TẮC SUY LẬN CHO AGENT

**Phân công lĩnh vực:**
- Khi người dùng hỏi về **địa chất, khoáng sản** tỉnh Lâm Đồng (từ 01/10/2026 trở đi): đơn vị QLNN là **Sở Công Thương** (Phòng Địa chất và Khoáng sản), KHÔNG PHẢI Sở NNMT hay Sở XD.
- Khi giao nhiệm vụ liên quan **khoáng sản, thăm dò, khai thác mỏ, cấp phép khoáng sản, đóng cửa mỏ, đấu giá quyền khai thác, tính tiền cấp quyền khai thác khoáng sản, mỏ cát, sỏi, đá, bô-xít, titan, đất san lấp** → giao **Sở Công Thương** (Phòng Địa chất và Khoáng sản) chủ trì tham mưu.
- Khi xử lý vụ việc vướng mắc, khiếu nại, tố tụng hoặc chồng lấn giữa dự án năng lượng (điện gió, thủy điện, điện mặt trời) và khu vực mỏ khoáng sản (như mỏ titan, bô-xít) → giao **Sở Công Thương** chủ trì (vì cả 2 lĩnh vực năng lượng và khoáng sản đều thuộc Sở Công Thương phụ trách).
- Khi soạn CV giao Sở tham mưu về **điện, năng lượng tái tạo, điện mặt trời, điện gió** → giao **Sở Công Thương** (Phòng Quản lý Năng lượng).
- Khi soạn CV về **chống buôn lậu, gian lận thương mại, hàng giả, kiểm tra thị trường** → giao **Sở Công Thương** (Chi cục Quản lý thị trường).
- Khi soạn CV về **khuyến công, cụm công nghiệp, tiểu thủ công nghiệp** → giao **Sở Công Thương** (Trung tâm Khuyến công).
- Khi soạn CV về **thương mại điện tử, kinh tế số, xúc tiến thương mại** → giao **Sở Công Thương** (Phòng Quản lý Thương mại).
- Khi soạn CV về **hóa chất, vận chuyển hàng hóa nguy hiểm, VLNCN** → giao **Sở Công Thương** (được ủy quyền giải quyết TTHC).

**Phân cấp ATTP — phân biệt rõ 3 tầng:**
- **Sở Y tế** chủ trì: dịch vụ ăn uống quy mô lớn (cấp tỉnh cấp phép, bếp KCN, ≥200/400 suất), SP ngành Y tế (nước uống, phụ gia, TPBS, TPDD y học)
- **Sở NNMT** chủ trì: SX KD thực phẩm nông lâm thủy sản muối do cấp tỉnh cấp phép, chợ đầu mối
- **Sở Công Thương** chủ trì: siêu thị, TTTM, cửa hàng tiện ích, hệ thống dự trữ phân phối, cơ sở SX >10 lao động (rượu, bia, nước giải khát, sữa, dầu TV, bánh kẹo, bột)
- **UBND xã, phường, đặc khu**: ăn uống nhỏ lẻ, thức ăn đường phố, cơ sở SX ≤10 LĐ, siêu thị mini nhỏ

**Ủy quyền — biết rõ để soạn đúng VB:**
- GĐ SCT **được ủy quyền** thay UBND tỉnh thực hiện NV trong lĩnh vực CN&TM (QĐ 1553/QĐ-UBND), cấp GP điện lực (QĐ sửa đổi 1553), cấp GCN ATTP ngành CT (QĐ 01/2026), giải quyết TTHC hóa chất (QĐ 05/2026).
- Thời hạn ủy quyền: đến hết **28/02/2027**.
- **Khu công nghiệp**: thuộc Ban Quản lý các khu công nghiệp tỉnh Lâm Đồng, KHÔNG thuộc Sở CT.
`.trim();
