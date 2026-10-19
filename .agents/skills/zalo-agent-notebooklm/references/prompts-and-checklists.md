# Thư Viện 115 Prompt Tiếng Việt, 8 Quy Trình Theo Nghề & 5 Checklist Thực Chiến

> Tài liệu tổng hợp đầy đủ **Thư viện 80 Prompt tra nhanh (Phụ lục A)**, **35 Prompt chuyên sâu trong các chương**, **8 Quy trình mẫu theo nghề (Chương 15)** và **5 Checklist kiểm chứng chất lượng (Phụ lục B)** cho Google Gemini Notebook (NotebookLM).

---

## 1. CÔNG THỨC ĐẶT CÂU HỎI 4 PHẦN: V – N – N – Đ (CHƯƠNG 4)

| Thành phần | Ý nghĩa | Ví dụ mẫu |
|:---|:---|:---|
| **V – Vai trò** | Định danh chuyên môn của AI | *"Đóng vai giảng viên Kinh tế vĩ mô..."*, *"Bạn là luật sư tư vấn..."* |
| **N – Nhiệm vụ** | Hành động cụ thể cần thực hiện | Tóm tắt, so sánh, liệt kê, giải thích, phản biện, lập kế hoạch... |
| **N – Nguồn** | Giới hạn phạm vi tài liệu tham chiếu | *"Chỉ dựa trên tài liệu A và B"*, *"Trong Chương 4 và Chương 5"* |
| **Đ – Định dạng** | Cấu trúc trình bày kết quả đầu ra | Bảng 3 cột, tối đa 6 dòng, 5 gạch đầu dòng, dưới 200 chữ, kèm ví dụ thực tế tại Việt Nam |

**Prompt mẫu áp dụng V–N–N–Đ:**
> *"Đóng vai giảng viên Kinh tế vĩ mô. So sánh chính sách tài khóa và chính sách tiền tệ, chỉ dựa trên Chương 4 và Chương 5 của giáo trình. Trình bày bằng bảng 3 cột (Tiêu chí – Tài khóa – Tiền tệ), tối đa 6 dòng, sau đó cho 1 ví dụ thực tế ở Việt Nam nếu tài liệu có nhắc."*

---

## 2. THƯ VIỆN 80 PROMPT TIẾNG VIỆT COPY-DÙNG-NGAY (PHỤ LỤC A)

### Nhóm 1: Cài đặt Configure Chat – Custom Instructions (Prompt 01 – 10)
*(Dán vào `Configure Chat → Custom`, đồng bộ trên cả Web, App Gemini và AI Mode)*

1. **Gia sư kiên nhẫn**:
   `Bạn là gia sư kiên nhẫn. Giải thích từng bước bằng tiếng Việt đơn giản, mỗi khái niệm kèm 1 ví dụ đời thường. Sau mỗi câu trả lời, hỏi lại tôi 1 câu để kiểm tra hiểu bài.`
2. **Trợ lý nghiên cứu khó tính**:
   `Bạn là trợ lý nghiên cứu nghiêm ngặt. Chỉ dùng thông tin trong nguồn, luôn trích dẫn. Nêu rõ mức độ chắc chắn và chỗ các nguồn mâu thuẫn. Không suy đoán.`
3. **Biên tập viên ngắn gọn**:
   `Trả lời tối đa 5 gạch đầu dòng, mỗi dòng dưới 20 từ. Kết thúc bằng 1 dòng "Điều quan trọng nhất:".`
4. **Chuyên viên CSKH**:
   `Bạn là nhân viên chăm sóc khách hàng thân thiện của [tên cửa hàng]. Xưng "em", gọi khách là "anh/chị". Chỉ trả lời dựa trên chính sách trong nguồn; nếu không có, xin số điện thoại để nhân viên liên hệ lại.`
5. **Người phản biện**:
   `Đóng vai người phản biện. Với mỗi lập luận trong nguồn, nêu điểm mạnh, điểm yếu, giả định ngầm và 1 phản ví dụ có thể có.`
6. **Huấn luyện viên công việc**:
   `Bạn là quản lý có 10 năm kinh nghiệm ngành [ngành]. Biến kiến thức trong nguồn thành việc cụ thể tôi làm được trong tuần này, có thứ tự ưu tiên.`
7. **Giải thích cho trẻ em**:
   `Giải thích như nói với học sinh lớp 5: câu ngắn, từ dễ, so sánh với đồ vật quen thuộc, không dùng thuật ngữ nếu không giải thích.`
8. **Song ngữ Anh – Việt**:
   `Trả lời bằng tiếng Việt, nhưng giữ thuật ngữ chuyên ngành tiếng Anh trong ngoặc ở lần xuất hiện đầu tiên. Cuối câu trả lời liệt kê bảng thuật ngữ Anh – Việt.`
9. **Giáo viên chấm bài**:
   `Bạn là giáo viên chấm bài. Khi tôi dán câu trả lời của tôi, chấm theo thang 10 dựa trên đáp án trong nguồn, chỉ ra chỗ thiếu và gợi ý sửa.`
10. **Cố vấn chiến lược**:
    `Bạn là cố vấn chiến lược cho doanh nghiệp nhỏ ở Việt Nam. Mọi câu trả lời kết thúc bằng: Rủi ro – Chi phí ước tính – Bước tiếp theo.`

*(Bổ sung mẫu Trợ lý báo cáo cho sếp – Chương 4)*:
> `Bạn là chuyên viên phân tích. Trả lời ngắn gọn theo cấu trúc: Kết luận chính (1 câu) → 3 gạch đầu dòng bằng chứng có trích dẫn → Rủi ro / điểm cần lưu ý. Dùng số liệu cụ thể khi có.`

---

### Nhóm 2: Hỏi Đáp & Tư Duy Phản Biện Trong Khung Chat (Prompt 11 – 25)

11. **Tóm tắt 3 tầng**: `Tóm tắt nguồn ở 3 mức: 1 câu, 1 đoạn 5 câu, và 1 trang có tiêu đề phụ.`
12. **Tìm ý chính**: `5 ý quan trọng nhất trong các nguồn là gì? Mỗi ý kèm trích dẫn và lý do vì sao quan trọng.`
13. **So sánh các nguồn**: `Các nguồn đồng ý và bất đồng với nhau ở điểm nào? Trình bày dạng bảng: Vấn đề – Nguồn A – Nguồn B – Ghi chú.`
14. **Kiểm tra một khẳng định**: `Khẳng định "[khẳng định]" có được nguồn ủng hộ không? Trích nguyên văn đoạn liên quan và đánh giá mức độ ủng hộ.`
15. **Giả định ngầm**: `Tác giả đang ngầm giả định những gì mà không chứng minh? Giả định nào yếu nhất?`
16. **Lập luận đối lập**: `Đâu là lập luận mạnh nhất chống lại quan điểm chính của nguồn? Nguồn có trả lời được không?`
17. **Giải thích thuật ngữ**: `Liệt kê 15 thuật ngữ quan trọng trong nguồn, giải thích mỗi thuật ngữ 1 câu dễ hiểu bằng tiếng Việt.`
18. **Dòng thời gian**: `Lập dòng thời gian các sự kiện, mốc quan trọng trong nguồn, dạng bảng Thời điểm – Sự kiện – Ý nghĩa.`
19. **Câu hỏi chưa có lời đáp**: `Những câu hỏi nào nguồn nêu ra nhưng chưa trả lời được? Tôi nên tìm thêm nguồn gì?`
20. **Áp dụng vào tình huống**: `Tình huống của tôi: [tình huống]. Những ý nào trong nguồn áp dụng được? Ý nào không phù hợp và vì sao?`
21. **Kiểm tra số liệu**: `Liệt kê mọi con số, tỉ lệ, số liệu trong nguồn kèm ngữ cảnh và trích dẫn, để tôi kiểm tra lại.`
22. **Giải thích 2 cấp độ**: `Giải thích [khái niệm] hai lần: một lần cho chuyên gia, một lần cho người mới hoàn toàn.`
23. **5 lần "Tại sao" (5 Whys)**: `Áp dụng kỹ thuật 5 Whys cho vấn đề [vấn đề] dựa trên nguồn để tìm nguyên nhân gốc.`
24. **Phân tích SWOT**: `Lập bảng SWOT cho [đối tượng] chỉ dựa trên thông tin trong nguồn, mỗi ô kèm trích dẫn.`
25. **Câu hỏi nên hỏi tiếp**: `Dựa trên những gì tôi đã hỏi, gợi ý 10 câu hỏi sâu hơn tôi nên hỏi tiếp về chủ đề này.`

---

### Nhóm 3: Audio Overview – Podcast AI (Prompt 26 – 33)
*(Dán vào ô prompt trong hộp `Customize Audio Overview`)*

26. **Podcast cho người mới**: `Hai host giải thích cho người hoàn toàn mới, tránh thuật ngữ, có nhiều ví dụ ở Việt Nam.`
27. **Tập trung một chương**: `Chỉ tập trung vào [chương/phần], bỏ qua các phần còn lại.`
28. **Ôn thi**: `Tập trung vào kiến thức hay ra thi, cuối tập nhắc lại 5 ý cần nhớ.`
29. **Tranh luận (Debate)**: `Một host ủng hộ, một host phản đối [quan điểm]. Kết thúc bằng điểm hai bên đồng ý.`
30. **Nhận xét (Critique)**: `Nhận xét bản thảo của tôi như một biên tập viên: điểm mạnh, điểm yếu, 3 đề xuất sửa cụ thể.`
31. **Bản tin sáng (Brief)**: `Như bản tin buổi sáng: 3 tin quan trọng nhất, mỗi tin 2–3 câu.`
32. **Cho lãnh đạo**: `Người nghe là giám đốc bận rộn: tập trung vào số liệu, rủi ro, quyết định cần đưa ra.`
33. **Kể chuyện**: `Mở đầu bằng một câu chuyện hoặc tình huống thực tế, rồi mới đi vào kiến thức.`

---

### Nhóm 4: Video Overview – Explainer, Short, Cinematic (Prompt 34 – 41)
*(Dán vào ô prompt trong hộp `Customize Video Overview`)*

34. **Explainer cho học sinh**: `Giải thích [chủ đề] cho học sinh THCS: mở đầu bằng câu hỏi, 3 ý chính, mỗi ý 1 hình minh họa.`
35. **Hướng dẫn từng bước**: `Video hướng dẫn quy trình [quy trình] theo từng bước đánh số, hiển thị số bước trên màn hình.`
36. **Short 60 giây (Dọc 9:16)**: `Chỉ 1 ý duy nhất: [ý chính]. Câu mở đầu gây tò mò trong 3 giây đầu.`
37. **Tóm tắt báo cáo**: `Tóm tắt báo cáo cho nhân viên: 3 con số chính hiển thị lớn, 2 việc cần làm.`
38. **So sánh hai lựa chọn**: `So sánh [A] và [B]: giống nhau, khác nhau, khi nào chọn cái nào.`
39. **Phong cách Custom**: `Phong cách minh họa phẳng (flat illustration), tông cam đào và xanh mint, nhân vật người Việt mặc áo sơ mi công sở, nền sáng, chữ trên màn hình to và ít.`
40. **Giới thiệu sản phẩm**: `Giới thiệu [sản phẩm] cho khách hàng: vấn đề – giải pháp – lợi ích – kêu gọi hành động.`
41. **Lịch sử một sự kiện**: `Kể lại [sự kiện] theo trình tự thời gian, nhấn mạnh nguyên nhân và hệ quả.`

---

### Nhóm 5: Slide Deck & Revise Slide (Prompt 42 – 49)
*(Dán vào hộp `Customize Slide Deck` hoặc ô `Revise` trên từng slide)*

42. **Thuyết trình 10 phút**: `Presenter Slides 8 trang cho bài thuyết trình 10 phút, mỗi slide 1 ý + 1 hình, slide cuối là câu hỏi thảo luận.`
43. **Báo cáo gửi email**: `Detailed Deck đầy đủ để sếp đọc riêng: bối cảnh, phân tích, số liệu, đề xuất, phụ lục.`
44. **Bài giảng**: `Slide bài giảng cho [lớp]: mục tiêu, khởi động, nội dung chính, bài tập, tóm tắt.`
45. **Pitch deck gọi vốn**: `Pitch deck 10 slide: vấn đề, giải pháp, thị trường, sản phẩm, mô hình kinh doanh, đối thủ, đội ngũ, tài chính, kêu gọi vốn.`
46. **Đào tạo nội bộ**: `Slide đào tạo nhân viên mới về [quy trình], có slide "lỗi thường gặp" và "ai hỗ trợ".`
47. **Revise – Rút gọn chữ**: `(Revise) Rút gọn chữ trên slide này còn tối đa 3 gạch đầu dòng, mỗi dòng dưới 10 từ.`
48. **Revise – Thêm số liệu**: `(Revise) Thêm con số: [số liệu] vào slide này, hiển thị lớn ở giữa.`
49. **Revise – Đổi phong cách**: `(Revise) Đổi toàn bộ sang tông màu xanh navy và trắng, phong cách tối giản.`

---

### Nhóm 6: Infographic Một Trang (Prompt 50 – 55)
*(Dán vào hộp `Customize Infographic` – ưu tiên chọn mức chi tiết `Concise` cho tiếng Việt)*

50. **Quy trình**: `Infographic dọc mô tả quy trình [quy trình] gồm các bước đánh số, mỗi bước 1 biểu tượng và tối đa 8 từ.`
51. **So sánh**: `Infographic ngang so sánh [A] và [B] theo 5 tiêu chí, hai cột màu khác nhau.`
52. **Số liệu nổi bật**: `Làm nổi bật 3 con số quan trọng nhất bằng chữ thật to, mỗi số 1 câu giải thích ngắn.`
53. **Dòng thời gian**: `Infographic dòng thời gian các mốc chính, từ trái sang phải.`
54. **Mẹo nhanh (Vuông)**: `Infographic vuông "7 mẹo" để đăng mạng xã hội, chữ ngắn, dễ đọc trên điện thoại.`
55. **Ôn thi một trang**: `Infographic tóm tắt toàn bộ chương thành 1 trang ôn thi: định nghĩa, công thức, ví dụ.`
*(Mẫu bổ sung Chương 8)*: `Infographic dọc bằng tiếng Việt, tông màu xanh lá và trắng, chia 4 khối: Vấn đề – Nguyên nhân – Giải pháp – Số liệu nổi bật. Mỗi khối tối đa 2 câu ngắn. Làm nổi bật 3 con số quan trọng nhất bằng chữ thật to.`

---

### Nhóm 7: Reports & Data Table (Prompt 56 – 63)

56. **Báo cáo tuần**: `Viết báo cáo tuần bằng tiếng Việt theo cấu trúc: 1) Tóm tắt 3 dòng; 2) Việc đã xong (gạch đầu dòng); 3) Vấn đề và rủi ro, mỗi vấn đề kèm mức độ Cao/Trung bình/Thấp; 4) Kế hoạch tuần tới; 5) Cần hỗ trợ từ ai. Giọng văn chuyên nghiệp, ngắn gọn, có trích dẫn nguồn.`
57. **Tóm tắt sách**: `Tóm tắt cuốn sách thành: ý tưởng lớn nhất (1 câu), 7 bài học chính (mỗi bài 3 câu + 1 ví dụ), 5 câu trích đáng nhớ, 3 hành động tôi có thể làm ngay tuần này.`
58. **Biên bản họp**: `Từ bản ghi cuộc họp, lập biên bản: thời gian, thành phần, 5 nội dung chính đã thảo luận, các quyết định đã chốt, bảng việc cần làm (Việc – Người phụ trách – Hạn chót), các vấn đề còn bỏ ngỏ. Không suy đoán, chỗ nào không rõ thì ghi "chưa rõ trong bản ghi".`
59. **Kế hoạch bài học**: `Kế hoạch bài học 45 phút với mục tiêu, hoạt động, thời lượng, học liệu.`
60. **Data Table – So sánh sản phẩm**: `Tạo bảng so sánh, mỗi hàng là một sản phẩm/nhà cung cấp trong nguồn. Các cột: Tên, Giá (VNĐ), Tính năng nổi bật, Ưu điểm, Nhược điểm, Phù hợp cho ai, Nguồn. Nếu nguồn không có thông tin, ghi "Không có trong nguồn".`
61. **Data Table – Tổng quan nghiên cứu**: `Mỗi hàng là một bài nghiên cứu. Các cột: Tác giả, Năm, Câu hỏi nghiên cứu, Phương pháp, Cỡ mẫu, Kết quả chính, Hạn chế.`
62. **Data Table – Việc cần làm**: `Trích mọi việc cần làm trong nguồn. Cột: Việc, Người phụ trách, Hạn chót, Trạng thái, Nguồn.`
63. **Data Table – Bảng thuật ngữ**: `Mỗi hàng là một thuật ngữ. Cột: Thuật ngữ, Tiếng Anh, Định nghĩa, Ví dụ, Trang/nguồn.`

---

### Nhóm 8: Flashcards & Quiz (Prompt 64 – 69)

64. **Thẻ định nghĩa**: `Mặt trước: thuật ngữ. Mặt sau: định nghĩa tối đa 2 câu + 1 ví dụ.`
65. **Thẻ công thức**: `Chỉ tạo thẻ về công thức: mặt trước là tên/ứng dụng, mặt sau là công thức và ý nghĩa từng ký hiệu.`
66. **Thẻ ứng dụng**: `Mặt trước là một tình huống thực tế, mặt sau là khái niệm áp dụng và cách giải.`
67. **Quiz phân loại**: `Câu hỏi từ dễ đến khó, 30% câu áp dụng vào tình huống mới, không hỏi chi tiết vụn vặt.`
68. **Quiz bẫy**: `Tập trung vào những điểm dễ nhầm lẫn, phương án sai phải hợp lý.`
69. **Quiz ôn phần yếu**: `Chỉ hỏi về những chủ đề tôi đã trả lời sai trong quiz vừa rồi.`
*(Prompt Phân tích kết quả Quiz trong khung Chat – Chương 10)*:
> `Dựa trên kết quả quiz vừa rồi của tôi, tôi yếu ở những chủ đề nào? Với mỗi chủ đề yếu, hãy giải thích lại thật dễ hiểu, cho 1 ví dụ và 2 câu hỏi luyện thêm.`

---

### Nhóm 9: Phân Tích Dữ Liệu & Xuất File Bằng Chat Agent (Prompt 70 – 75)

70. **Làm sạch dữ liệu (Kiểm tra dữ liệu bẩn)**:
    `Trước khi phân tích, kiểm tra file dữ liệu: có ô trống, dòng trùng lặp, định dạng ngày hoặc số bị lỗi không? Liệt kê vấn đề và đề xuất cách làm sạch. Chưa sửa gì cho đến khi tôi đồng ý.`
71. **Tổng hợp theo tháng**:
    `Tính tổng, trung bình, số lượng theo tháng; xuất bảng ra Excel.`
72. **Vẽ biểu đồ**:
    `Vẽ biểu đồ cột [chỉ số] theo [nhóm], màu cam, có nhãn số, tải PNG.`
73. **Top và đáy**:
    `Tìm 5 mục cao nhất và 5 mục thấp nhất theo [chỉ số], giải thích có thể vì sao.`
74. **Báo cáo PDF**:
    `Viết báo cáo 2 trang có biểu đồ, nhận xét và đề xuất, xuất PDF.`
75. **Kiểm tra lại phép tính**:
    `Cho tôi xem code và công thức bạn đã dùng, rồi tính lại bằng cách khác để đối chiếu.`
*(Prompt Tổng hợp Phân tích doanh thu Multi-sheet + PDF – Chương 11)*:
> `Từ file doanh thu trong nguồn: (1) tính tổng doanh thu và số đơn theo tháng; (2) tìm 5 sản phẩm bán chạy nhất; (3) vẽ biểu đồ cột doanh thu theo tháng; (4) viết 5 nhận xét bằng tiếng Việt; (5) xuất tất cả thành 1 file Excel (mỗi phần 1 sheet) và 1 file PDF báo cáo 2 trang.`

---

### Nhóm 10: Deep Research Tìm Nguồn Chuyên Sâu (Prompt 76 – 80)
*(Gõ ở khung Nguồn sau khi chọn `Web + Deep Research`)*

76. **Tổng quan chủ đề mới**: `Tổng quan về [chủ đề] cho người mới: khái niệm, lịch sử ngắn, xu hướng 2024–2026, nguồn uy tín nên đọc.`
77. **Thị trường Việt Nam**: `Quy mô, xu hướng, đối thủ chính, khách hàng mục tiêu của thị trường [ngành] tại Việt Nam, ưu tiên số liệu chính thức.`
78. **Tổng quan tài liệu khoa học**: `Nghiên cứu về [chủ đề] trong giai đoạn 2021–2026, ưu tiên bài báo khoa học có bình duyệt và báo cáo của tổ chức quốc tế. Tôi cần: các trường phái chính, kết quả nghiên cứu nổi bật, những điểm còn tranh cãi, và khoảng trống nghiên cứu ở bối cảnh Việt Nam.`
79. **So sánh giải pháp**: `So sánh các giải pháp/công cụ cho [vấn đề]: tính năng, giá, ưu nhược điểm, đánh giá người dùng.`
80. **Chính sách, quy định pháp luật**: `Các quy định pháp luật Việt Nam hiện hành về [lĩnh vực], ưu tiên văn bản từ cơ quan nhà nước (.gov.vn).`

---

## 3. TÁM QUY TRÌNH MẪU THEO NGHỀ (CHƯƠNG 15)

| Nghề / Nhu cầu | Nguồn đầu vào | Chuỗi công cụ sử dụng | Đầu ra hoàn chỉnh |
|:---|:---|:---|:---|
| **1. Sinh viên ôn thi cuối kỳ** | Slide bài giảng, giáo trình PDF, ghi chép, đề thi cũ, video bài giảng. | `Configure Chat (Learning Guide)` → `Study Guide` + `Mind Map` → `Audio Deep Dive` → `Flashcards & Quiz` (lịch 7 ngày). | Đề cương, sơ đồ tư duy, bộ thẻ Anki CSV, bộ đề dự đoán tự luận có trích dẫn. |
| **2. Giáo viên soạn giáo án & học liệu** | Sách giáo khoa, khung chương trình, tài liệu tham khảo. | `Report (Create your own - Giáo án 5 bước)` → `Presenter Slides` + `Infographic` → `Quiz 10 câu` → `Video Explainer (Whiteboard)`. | Giáo án 45 phút, bộ slide, poster treo lớp, video bài giảng và link `Chat View` cho học sinh hỏi 24/7. |
| **3. Nhân viên văn phòng & Quản lý** | Ghi âm cuộc họp (`.mp3`/`.m4a`), email dán text, Google Docs/Sheets. | Chép lời âm thanh → Prompt `Biên bản họp` (`Save to note`) → `Report (Báo cáo tuần)` → `Detailed Deck` / `Presenter Slides`. | Biên bản họp rõ bảng phân công việc, báo cáo tuần chuẩn công ty, slide báo cáo sếp. |
| **4. Người làm nội dung (Creator)** | 1 link video YouTube dài (công khai, có phụ đề) + kịch bản. | Prompt `Tái chế nội dung` → `Short Video (60s dọc)` → `Infographic Portrait`. | 1 bài blog 800 từ, 5 bài post Facebook, 10 câu quote, 1 video dọc Reels/TikTok, 1 infographic. |
| **5. Chủ shop & Doanh nghiệp nhỏ** | Chính sách đổi trả, bảng giá, file CSV đánh giá của khách hàng. | Notebook 1 (`FAQ cửa hàng` + `Custom CSKH` + `Chat View`) + Notebook 2 (`CSV phản hồi` + `Data Table` + `Chat Agent biểu đồ`). | Trợ lý CSKH tự động bám sát chính sách & Bảng phân tích tỷ lệ khen/chê kèm 3 việc ưu tiên cải thiện. |
| **6. Nghiên cứu & Luận văn** | Bài báo khoa học PDF, kết quả `Deep Research`, sách chuyên khảo. | `Deep Research` → `Data Table` (Tác giả - Năm - Phương pháp - Kết quả - Hạn chế) → `Export to Sheets` → Prompt `Tìm mâu thuẫn & khoảng trống`. | Ma trận tổng quan tài liệu (Literature Review Matrix) trên Google Sheets kèm tab trích dẫn và 3 đề xuất đề tài mới. |
| **7. Học ngoại ngữ (Tiếng Anh)** | Bài báo, video, podcast tiếng Anh theo sở thích. | Đặt `Output Language = English` → `Audio Overview (Shorter)` → Bấm **`Join` (Interactive mode)** luyện phản xạ nói → `Flashcards từ vựng B2`. | Phòng luyện nói trực tiếp với AI host + Bộ thẻ 30 từ/cụm từ kèm câu ví dụ trong nguồn và nghĩa tiếng Việt. |
| **8. Đọc sách & Tự học sâu** | Sách đã mua trên Google Play Books (*Expert Intelligence*) hoặc EPUB/PDF. | `Report (Tóm tắt sách 7 bài học)` → `Mind Map` từng chương → `Audio Debate / Critique` → Hỏi áp dụng vào tình huống cá nhân. | Bản đúc kết sách, podcast tranh luận đa chiều về quan điểm tác giả và kế hoạch hành động tuần. |

---

## 4. BỘ 5 CHECKLIST IN RA DÙNG NGAY (PHỤ LỤC B)

### Checklist 1: Trước khi tạo Notebook
- [ ] Đã viết ra **câu hỏi lớn duy nhất** mà notebook này cần trả lời (*Quy tắc: 1 câu hỏi lớn = 1 notebook*).
- [ ] Đặt tên notebook rõ ràng, có mốc thời gian (ví dụ: `"Ôn thi Kinh tế vĩ mô – HK1 2026"`).
- [ ] Đã cài đặt `Output Language = Tiếng Việt` (hoặc ngôn ngữ mục tiêu).
- [ ] Đã chọn chế độ `Configure Chat` phù hợp (`Default` / `Learning Guide` / `Custom`).
- [ ] Đã xác định rõ ngay từ đầu notebook này là **riêng tư** hay sẽ **chia sẻ**.

### Checklist 2: Thẩm định chất lượng nguồn
- [ ] Nguồn có tên tác giả, cơ quan ban hành và ngày tháng rõ ràng.
- [ ] Ưu tiên **nguồn gốc** (văn bản quy phạm pháp luật, báo cáo chính thức, bài báo khoa học bình duyệt) hơn bài viết tổng hợp lại.
- [ ] Nguồn còn hiệu lực cập nhật, không bị lỗi thời so với câu hỏi.
- [ ] **Tuyệt đối không chứa thông tin nhạy cảm** (số CCCD/CMND, mật khẩu, số thẻ ngân hàng, hồ sơ bệnh án của người khác).
- [ ] Đã bỏ tick các nguồn không liên quan trước khi bấm hỏi hoặc tạo tác phẩm Studio.

### Checklist 3: Kiểm chứng câu trả lời của AI (Chống ảo giác)
- [ ] Đã bấm vào **số trích dẫn `①, ②`** cho mọi thông tin và kết luận quan trọng.
- [ ] Đoạn văn gốc trong tài liệu có thực sự nói đúng điều AI khẳng định (không bị *gộp ý* hoặc *bỏ điều kiện*)?
- [ ] Mọi con số, tỷ lệ, tên riêng, ngày tháng đã được đối chiếu khớp với bảng/văn bản nguồn.
- [ ] Đã thử hỏi lại theo cách diễn đạt khác để kiểm tra tính nhất quán.
- [ ] Các nhận định "ngoài nguồn" (không có số trích dẫn) đã được kiểm chứng độc lập.

### Checklist 4: Trước khi chia sẻ Notebook công khai / nội bộ
- [ ] Notebook không chứa tài liệu mật nội bộ hoặc dữ liệu cá nhân. *(Lưu ý: Chế độ `Chat View` chỉ ẩn giao diện chứ không khóa tuyệt đối quyền truy xuất nguồn).*
- [ ] Bạn có đầy đủ quyền hợp pháp để chia sẻ mọi tài liệu trong notebook.
- [ ] Không chứa các tác phẩm tạo từ sách bản quyền **Google Play Books**.
- [ ] Đã phân quyền đúng vai trò: `Viewer` (Người xem) hay `Editor` (Người sửa), `Full notebook` hay `Chat View`.
- [ ] Đã mở thử đường link bằng một tài khoản khác (hoặc tab ẩn danh) để kiểm tra trải nghiệm thực tế.

### Checklist 5: Trước khi đăng tác phẩm AI lên mạng xã hội
- [ ] Có quyền sử dụng hợp pháp đối với tài liệu nguồn; không tái đăng toàn văn nội dung trả phí của người khác dưới dạng audio/video/tóm tắt.
- [ ] Đã xem/nghe lại từ đầu đến cuối tác phẩm; đã kiểm tra và sửa hết **lỗi dấu tiếng Việt trên Infographic/Slide**, số liệu và tên riêng.
- [ ] **Giữ nguyên Watermark hiển thị** theo quy định tại Việt Nam; ghi rõ trong bài đăng/caption: *"Nội dung có sử dụng AI (Gemini Notebook)"*.
- [ ] Không chứa hình ảnh hoặc giọng nói gây hiểu lầm là người thật đang phát ngôn.
- [ ] Đã ghi đầy đủ nguồn tham khảo nếu nội dung dựa trên công trình của tác giả khác.
