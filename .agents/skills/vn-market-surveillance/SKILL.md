---
name: Nghiệp vụ Quản lý Thị trường & Kiểm tra Thương mại (vn-market-surveillance)
description: Hỗ trợ toàn diện nghiệp vụ ngành Quản lý thị trường (QLTT) Việt Nam: tra cứu dữ liệu từ các nguồn chính thống trên Internet (dms.gov.vn, online.gov.vn, vbpl.vn), định danh hành vi vi phạm và khung phạt theo Nghị định 98/2020/NĐ-CP (sửa đổi bởi NĐ 17/2022/NĐ-CP), kiểm tra thẩm quyền xử phạt của Đội trưởng/Cục trưởng QLTT, quy trình kiểm tra đột xuất theo Pháp lệnh QLTT 2016 & Thông tư 27/2020/TT-BCT, và lập biểu mẫu nghiệp vụ theo Thông tư 22/2021/TT-BCT. Triggers: 'quản lý thị trường', 'qltt', 'kiểm tra thị trường', 'hàng giả', 'hàng lậu', 'không rõ nguồn gốc', 'nghị định 98', 'thông tư 27', 'thông tư 22', 'đội quản lý thị trường', 'cục quản lý thị trường', 'tạm giữ tang vật', 'khám phương tiện', 'kiểm tra đột xuất', 'thương mại điện tử lậu', 'niêm yết giá', 'nhãn hàng hóa'.
---

# KỸ NĂNG NGHIỆP VỤ QUẢN LÝ THỊ TRƯỜNG VIỆT NAM (`vn-market-surveillance`)

Kỹ năng này cung cấp quy trình chuẩn để **tra cứu dữ liệu trên Internet**, **đối chiếu văn bản quy phạm pháp luật**, **xác định khung phạt & thẩm quyền xử phạt**, và **soạn thảo hồ sơ/biểu mẫu kiểm tra** cho lực lượng **Quản lý thị trường (QLTT)**.

---

## 1. HỆ THỐNG CĂN CỨ PHÁP LÝ CỐT LÕI (BẮT BUỘC ĐỐI CHIẾU)

Khi tư vấn, tra cứu hoặc lập hồ sơ cho ngành Quản lý thị trường, luôn đối chiếu chính xác các văn bản sau:

1. **Tổ chức & Hoạt động công vụ QLTT**:
   - **Pháp lệnh Quản lý thị trường số 11/2016/UBTVQH13** ngày 08/3/2016.
   - **Nghị định số 33/2022/NĐ-CP** ngày 27/5/2022 quy định chi tiết một số điều của Pháp lệnh Quản lý thị trường.
   - **Thông tư số 27/2020/TT-BCT** ngày 30/9/2020 (được sửa đổi, bổ sung bởi **Thông tư số 20/2021/TT-BCT** và **Thông tư số 24/2023/TT-BCT**) quy định về nội dung, trình tự, thủ tục hoạt động kiểm tra, xử lý vi phạm hành chính và thực hiện các biện pháp nghiệp vụ của lực lượng QLTT.
   - **Thông tư số 22/2021/TT-BCT** ngày 10/12/2021 quy định về quản lý, sử dụng biểu mẫu trong hoạt động kiểm tra, xử lý vi phạm hành chính và thực hiện các biện pháp nghiệp vụ của lực lượng QLTT (áp dụng trên Hệ thống xử lý VPHC **INS**).

2. **Xử phạt vi phạm hành chính chuyên ngành**:
   - **Luật Xử lý vi phạm hành chính năm 2012** (sửa đổi, bổ sung năm 2020) và **Nghị định số 118/2021/NĐ-CP** quy định chi tiết một số điều và biện pháp thi hành Luật Xử lý VPHC.
   - **Nghị định số 98/2020/NĐ-CP** ngày 26/8/2020 quy định xử phạt VPHC trong hoạt động thương mại, sản xuất, buôn bán hàng giả, hàng cấm và bảo vệ quyền lợi người tiêu dùng (được sửa đổi, bổ sung bởi **Nghị định số 17/2022/NĐ-CP** ngày 31/01/2022 và **Nghị định số 24/2025/NĐ-CP**).
   - **Nghị định số 43/2017/NĐ-CP** (sửa đổi, bổ sung bởi **Nghị định số 111/2021/NĐ-CP**) về nhãn hàng hóa; xử phạt theo **Nghị định số 119/2017/NĐ-CP** (sửa đổi bởi **Nghị định số 126/2021/NĐ-CP**).
   - **Nghị định số 115/2018/NĐ-CP** (sửa đổi bởi **Nghị định số 124/2021/NĐ-CP**) về xử phạt VPHC trong lĩnh vực an toàn thực phẩm.
   - **Nghị định số 99/2020/NĐ-CP** về xử phạt VPHC trong lĩnh vực dầu khí, kinh doanh xăng dầu và khí.

---

## 2. QUY TRÌNH TRA CỨU DỮ LIỆU TỪ CÁC NGUỒN TRÊN INTERNET

Khi người dùng yêu cầu tra cứu thông tin thị trường, hàng hóa, doanh nghiệp, website thương mại điện tử hoặc văn bản mới trên Internet, hãy chủ động gọi công cụ **`web_search`**, **`news_lookup`**, **`national_legal`** hoặc **`legal_search`** theo thứ tự ưu tiên các nguồn chính thống sau:

1. **Nguồn chỉ đạo & tin tức chuyên ngành Quản lý thị trường**:
   - Cổng thông tin điện tử Tổng cục Quản lý thị trường: `dms.gov.vn` (Truy vấn mẫu: `site:dms.gov.vn <từ khóa mặt hàng / hành vi vi phạm>`).
   - Cổng thông tin Cục QLTT địa phương (ví dụ: `lamdong.dms.gov.vn`).
2. **Nguồn kiểm tra Thương mại điện tử & Website bán hàng (`online.gov.vn`)**:
   - Tra cứu xem website/ứng dụng bán hàng đã Thông báo hoặc Đăng ký với Bộ Công Thương chưa (`site:online.gov.vn <tên miền / mã số thuế>`) để xác định hành vi vi phạm theo **Điều 62, Điều 63 Nghị định 98/2020/NĐ-CP**.
3. **Nguồn tra cứu Văn bản quy phạm pháp luật & Công báo**:
   - Cơ sở dữ liệu quốc gia về pháp luật (`vbpl.vn`), Công báo Chính phủ (`congbao.chinhphu.vn`), Cổng thông tin Bộ Công Thương (`moit.gov.vn`).
4. **Nguồn tra cứu Nhãn hiệu, Mã số mã vạch & Công bố chất lượng**:
   - Cục Sở hữu trí tuệ (`ipvietnam.gov.vn`) đối với hành vi xâm phạm quyền đối với nhãn hiệu, giả mạo nhãn hiệu.
   - Trung tâm Mã số mã vạch Quốc gia (`vnpc.tcvn.gov.vn`) đối với kiểm tra xuất xứ mã vạch GS1.

---

## 3. BẢNG TRA CỨU NHANH HÀNH VI VI PHẠM PHỔ BIẾN (NGHỊ ĐỊNH 98/2020/NĐ-CP & NĐ 17/2022/NĐ-CP)

> **Lưu ý nguyên tắc mức phạt tiền (Khoản 4 Điều 4 NĐ 98/2020/NĐ-CP sửa đổi bởi NĐ 17/2022/NĐ-CP)**:
> Mức phạt tiền quy định tại Chương II Nghị định 98/2020/NĐ-CP là mức phạt áp dụng đối với **cá nhân** (trừ một số điều quy định riêng cho tổ chức). Trường hợp hành vi VPHC do **tổ chức** thực hiện thì **phạt tiền gấp hai (02) lần** mức phạt tiền quy định đối với cá nhân.

| STT | Nhóm hành vi vi phạm | Điều khoản (NĐ 98/2020 sửa đổi bởi NĐ 17/2022) | Lưu ý xác định tang vật & Hình thức phạt bổ sung / Khắc phục |
|---|---|---|---|
| 1 | **Hoạt động kinh doanh không có giấy chứng nhận đăng ký kinh doanh / đăng ký hộ kinh doanh** | **Điều 6** | Phân biệt hộ kinh doanh (Khoản 1, 2) và doanh nghiệp; kiểm tra điều kiện kinh doanh đối với ngành nghề đầu tư kinh doanh có điều kiện (Điều 7). |
| 2 | **Buôn bán hàng cấm, sản xuất hàng cấm** | **Điều 8** | Thuốc lá điếu nhập lậu, pháo nổ, hóa chất cấm... Lưu ý ngưỡng chuyển truy cứu trách nhiệm hình sự theo **Điều 190, 191 Bộ luật Hình sự** (ví dụ: thuốc lá điếu nhập lậu từ 1.500 bao trở lên). |
| 3 | **Buôn bán, sản xuất hàng giả** (giả về giá trị sử dụng/công dụng; giả mạo nhãn hàng hóa, bao bì; giả mạo về sở hữu trí tuệ; tem, nhãn, bao bì giả) | **Điều 9, 10, 11, 12, 13, 14** | Khung phạt chia theo trị giá hàng giả tương đương với số lượng của hàng thật hoặc số tiền thu lợi bất hợp pháp. Nếu trị giá hàng giả tương đương hàng thật từ **30.000.000 đồng** trở lên (hoặc dưới 30 triệu nhưng thuộc trường hợp định khung tại **Điều 192, 193, 194, 195 BLHS**) $\rightarrow$ **Chuyển cơ quan điều tra hình sự** theo Điều 62 Luật XLVPHC. |
| 4 | **Kinh doanh hàng hóa nhập lậu** | **Điều 15** | Chia 11 nấc theo trị giá hàng hóa nhập lậu (từ dưới 3 triệu đồng đến từ 100 triệu đồng trở lên). Phạt gấp 02 lần mức tiền phạt nếu là người trực tiếp nhập lậu hoặc hàng hóa thuộc danh mục thực phẩm, phụ gia thực phẩm, chất bảo quản, thuốc phòng/chữa bệnh... Tịch thu tang vật (trừ trường hợp buộc tiêu hủy). |
| 5 | **Kinh doanh hàng hóa không rõ nguồn gốc, xuất xứ** | **Điều 17** | Hàng hóa lưu thông trên thị trường không có căn cứ xác định được nguồn gốc nơi sản xuất hoặc xuất xứ của hàng hóa (hóa đơn, chứng từ, tài liệu kèm theo). Chia 11 nấc theo trị giá hàng hóa vi phạm. |
| 6 | **Kinh doanh hàng hóa quá hạn sử dụng** | **Điều 17** | Phạt theo trị giá hàng hóa vi phạm; buộc tiêu hủy hàng hóa quá hạn sử dụng và buộc nộp lại số lợi bất hợp pháp có được. |
| 7 | **Vi phạm về Thương mại điện tử (Website / App / Bán hàng qua mạng)** | **Điều 62, 63, 64, 65, 66** | Không thông báo website TMĐT bán hàng với Bộ Công Thương (Điều 62); không đăng ký website cung cấp dịch vụ TMĐT; cung cấp thông tin hàng giả, hàng cấm, hàng nhập lậu trên môi trường Internet. |
| 8 | **Vi phạm về niêm yết giá hàng hóa, dịch vụ** | Pháp luật về Quản lý giá | Không niêm yết giá hàng hóa tại địa điểm phải niêm yết giá; niêm yết giá không rõ ràng gây nhầm lẫn cho khách hàng; bán cao hơn giá niêm yết. |

---

## 4. THẨM QUYỀN XỬ PHẠT CỦA LỰC LƯỢNG QUẢN LÝ THỊ TRƯỜNG (ĐIỀU 80 NĐ 98/2020 SỬA ĐỔI BỞI NĐ 17/2022)

Khi lập Tờ trình hoặc Quyết định xử phạt, bắt buộc kiểm tra **trần thẩm quyền phạt tiền, tịch thu tang vật và tước quyền sử dụng giấy phép**:

1. **Kiểm soát viên thị trường đang thi hành công vụ**:
   - Phạt cảnh cáo; phạt tiền đến **500.000 đồng** (đối với cá nhân) / **1.000.000 đồng** (đối với tổ chức) tùy lĩnh vực.
2. **Đội trưởng Đội Quản lý thị trường**:
   - Phạt cảnh cáo;
   - Phạt tiền đến **25.000.000 đồng** (đối với cá nhân) và đến **50.000.000 đồng** (đối với tổ chức) trong lĩnh vực thương mại (lưu ý kiểm tra trần tối đa của từng nghị định chuyên ngành);
   - Tịch thu tang vật, phương tiện VPHC có giá trị không vượt quá **02 lần** mức tiền phạt theo thẩm quyền;
   - Áp dụng biện pháp khắc phục hậu quả theo quy định.
   - *(Lưu ý: Đội trưởng Đội QLTT **không** có thẩm quyền tước quyền sử dụng giấy phép, chứng chỉ hành nghề có thời hạn hoặc đình chỉ hoạt động có thời hạn — nếu vụ việc có hình thức phạt bổ sung là **tước giấy phép** thì phải chuyển hồ sơ lên **Cục trưởng Cục QLTT** hoặc **Chủ tịch UBND cấp có thẩm quyền**!)*
3. **Cục trưởng Cục Quản lý thị trường cấp tỉnh / Cục trưởng Cục Nghiệp vụ QLTT**:
   - Phạt cảnh cáo;
   - Phạt tiền đến **50.000.000 đồng** (đối với cá nhân) và đến **100.000.000 đồng** (đối với tổ chức) theo Nghị định 98/2020/NĐ-CP;
   - Tịch thu tang vật, phương tiện VPHC;
   - **Tước quyền sử dụng giấy phép, chứng chỉ hành nghề có thời hạn hoặc đình chỉ hoạt động có thời hạn**;
   - Áp dụng các biện pháp khắc phục hậu quả.
4. **Tổng cục trưởng Tổng cục Quản lý thị trường / Chủ tịch UBND cấp tỉnh**:
   - Phạt tiền đến mức tối đa của khung phạt theo Nghị định chuyên ngành; tịch thu tang vật không giới hạn giá trị; tước quyền sử dụng giấy phép.

---

## 5. QUY TRÌNH KIỂM TRA ĐỘT XUẤT & BIỂU MẪU NGHIỆP VỤ (THÔNG TƯ 27/2020 & THÔNG TƯ 22/2021)

Khi người dùng yêu cầu lập hồ sơ kiểm tra đột xuất của Đội QLTT, phải tuân thủ chặt chẽ chuỗi trình tự sau:

1. **Bước 1 — Căn cứ đề xuất kiểm tra đột xuất (Khoản 2 Điều 20 Pháp lệnh QLTT & Điều 11 Thông tư 27/2020/TT-BCT)**:
   - Phải có ít nhất 1 trong 4 căn cứ hợp pháp:
     - (a) Thông tin về hành vi vi phạm pháp luật hoặc dấu hiệu vi phạm đã được **thẩm tra, xác minh** bằng biện pháp nghiệp vụ (có Báo cáo kết quả thẩm tra, xác minh);
     - (b) Thông tin từ phương tiện thông tin đại chúng, khiếu nại, tố cáo, kiến nghị, phản ánh của tổ chức, cá nhân đã được xem xét, thẩm tra, xác minh;
     - (c) Yêu cầu phối hợp bằng văn bản của cơ quan nhà nước có thẩm quyền;
     - (d) Văn bản chỉ đạo của cơ quan Quản lý thị trường cấp trên hoặc người có thẩm quyền.
2. **Bước 2 — Ban hành Quyết định kiểm tra & Phân công công chức**:
   - Lập **Đề xuất kiểm tra đột xuất** trình Đội trưởng Đội QLTT / Cục trưởng Cục QLTT ký **Quyết định kiểm tra** trên hệ thống INS (theo biểu mẫu Thông tư 22/2021/TT-BCT).
3. **Bước 3 — Công bố Quyết định kiểm tra & Thực hiện kiểm tra tại hiện trường**:
   - Đoàn kiểm tra xuất trình **Thẻ kiểm tra thị trường**, đọc Quyết định kiểm tra;
   - Nếu phát hiện dấu hiệu cất giấu tang vật: ban hành **Quyết định khám phương tiện vận tải, đồ vật / nơi cất giấu tang vật, phương tiện VPHC** đúng thẩm quyền theo Điều 127, 128, 129 Luật XLVPHC;
   - Lập **Biên bản kiểm tra**.
4. **Bước 4 — Lập Biên bản VPHC, Tạm giữ tang vật & Ra Quyết định xử phạt**:
   - Nếu có hành vi vi phạm: Lập **Biên bản vi phạm hành chính** (trong thời hạn quy định tại Điều 58 Luật XLVPHC và Nghị định 118/2021/NĐ-CP);
   - Nếu cần xác minh tình tiết, định giá tang vật hoặc ngăn chặn ngay vi phạm: ban hành **Quyết định tạm giữ tang vật, phương tiện, giấy phép, chứng chỉ hành nghề** kèm Biên bản tạm giữ và Biên bản niêm phong;
   - Ban hành **Quyết định xử phạt VPHC** trong thời hạn luật định (thông thường 07 ngày làm việc kể từ ngày lập Biên bản VPHC; vụ việc phức tạp tối đa 01 tháng hoặc gia hạn theo Điều 66 Luật XLVPHC).

---

## 6. MẪU ĐẦU RA KHI TƯ VẤN HOẶC LẬP BẢNG PHÂN TÍCH VỤ VIỆC QLTT

Mỗi khi người dùng đưa ra một tình huống kiểm tra thị trường hoặc yêu cầu tra cứu trên Internet, hãy trả lời theo cấu trúc chuẩn 5 mục:
1. **Kết quả tra cứu nguồn dữ liệu & văn bản hiện hành** (Nêu rõ số hiệu Nghị định, Thông tư, Điều, Khoản, Điểm và nguồn tra cứu `dms.gov.vn` / `online.gov.vn` / `vbpl.vn`).
2. **Định danh hành vi vi phạm & Chủ thể** (Cá nhân / Hộ kinh doanh / Tổ chức doanh nghiệp).
3. **Khung phạt tiền, Phạt bổ sung & Biện pháp khắc phục hậu quả** (Tính rõ mức tiền tối thiểu – tối đa và mức phạt trung bình).
4. **Thẩm quyền xử phạt** (Đội trưởng Đội QLTT xử phạt được ngay hay phải trình Cục trưởng Cục QLTT / Chủ tịch UBND cấp tỉnh / chuyển Cơ quan CSĐT).
5. **Danh mục Biểu mẫu INS cần lập & Tệp xuất kèm** (hỗ trợ xuất bảng tính mức phạt `.xlsx` hoặc dự thảo văn bản/tờ trình `.docx`/`.html`).
