# Cẩm Nang Toàn Tập Google Gemini Notebook (NotebookLM) – Cập Nhật 10/2026

> Tài liệu tham chiếu chuẩn hóa toàn bộ tính năng, thông số kỹ thuật, giới hạn gói cước, công cụ Studio, Chat Agent (Cloud Sandbox) và quy trình thực chiến của **Google Gemini Notebook** (tên cũ: **NotebookLM**, cập nhật đến ngày `15/10/2026` theo Ebook *"Hướng dẫn toàn tập Gemini Notebook"* của tác giả Minh Đỗ và tài liệu chính thức của Google).

---

## 1. CỘT MỐC PHÁT TRIỂN & BA NƠI CÙNG TÊN "NOTEBOOK"

### 1.1. Các mốc thay đổi quan trọng (05/2023 – 10/2026)

| Thời điểm | Sự kiện & Thay đổi cốt lõi |
|:---|:---|
| **05/2023** | Ra mắt thử nghiệm tại Google I/O với tên **Project Tailwind**, sau đó đổi thành **NotebookLM**. |
| **10/2025** | **Video Overview** bổ sung các phong cách hình trực quan (*Whiteboard, Watercolor, Anime, Kawaii, Paper-craft...*). |
| **03/2026** | Mở rộng tùy chỉnh sâu cho **Infographic, Slide Deck, Flashcards, Quiz**. |
| **04/2026** | Tích hợp **Notebooks trong app Gemini** (`gemini.google.com`) đồng bộ 2 chiều với NotebookLM. |
| **08/06/2026** | Ra mắt **Chat Agent**: trang bị "máy tính đám mây" (Cloud Sandbox) chạy code Python, vẽ biểu đồ, xuất file Word/Excel/PowerPoint/PDF (triển khai cho gói Ultra trước). |
| **16/07/2026** | **NotebookLM chính thức đổi tên thành Gemini Notebook** (hơn 30 triệu người dùng & 600.000 tổ chức); nền tảng Agent chạy trên **Gemini 3.5 kết hợp Antigravity** với hơn 100 kỹ năng (*skills*). |
| **07/2026** | Bổ sung **Collections** (gom nhóm notebook như playlist), tùy biến ảnh bìa và bản tóm tắt notebook khi chia sẻ. |
| **27/08/2026** | Ra mắt **Expert Intelligence**: cho phép dùng hơn 100.000 đầu sách đã mua trên **Google Play Books** làm nguồn. |
| **08/2026** | **Google Workspace Studio** hỗ trợ quy trình tự động thêm nguồn vào Gemini Notebook. |
| **02/09/2026** | Chuyển sang cơ chế tính hạn mức theo **Compute (sức tính toán)**, **làm mới mỗi 5 giờ** (kèm trần hạn mức tuần). |
| **15/09/2026** | Tung **Giao diện mới (New UI)**, **Short Video Overview (~60s dọc)**, báo cáo tương tác **Learning Overview**, định dạng **Quiz mới** (*Multiple select, Short answer, Fill in the blank*), **Voice Chat** và **Audio Recorder** trên ứng dụng di động. |

### 1.2. Phân biệt 3 nơi cùng tên "Notebook" của Google

Cả 3 nơi đều dùng chung hệ thống dữ liệu sổ tay gốc (tạo ở một nơi sẽ tự hiện ở nơi kia):

| Tiêu chí | Gemini Notebook (App độc lập) | Notebooks trong App Gemini | Notebooks trong AI Mode (Search) |
|:---|:---|:---|:---|
| **Địa chỉ truy cập** | `notebook.google.com` (link cũ `notebooklm.google.com` tự chuyển hướng) & App di động | `gemini.google.com` → Thanh bên mục **Notebooks** (hoặc gõ `@Gemini Notebook`) | Google Search → **AI Mode** |
| **Thời điểm ra mắt** | 2023 (đổi tên 16/07/2026) | 04/2026 (Trường học/Tổ chức từ 14/09/2026) | 19/08/2026 |
| **Khung Studio** | **Đầy đủ 9 công cụ** (Audio, Video, Mind Map, Slide, Infographic, Report, Data Table, Flashcard, Quiz) | Không có khung Studio riêng, nhưng dùng được công cụ sáng tạo/Canvas của Gemini | Không có Studio |
| **Cơ sở trả lời** | **Chỉ bám sát nguồn bạn đưa vào**, luôn kèm số trích dẫn `①, ②` | Nguồn trong notebook + kết hợp tìm kiếm Web & công cụ Gemini | Nguồn trong notebook + Web |
| **Ngôn ngữ** | **80+ ngôn ngữ (Có tiếng Việt đầy đủ)** | Theo ngôn ngữ app Gemini | Hiện chỉ hỗ trợ tiếng Anh |
| **Quyền riêng tư** | Không dùng để huấn luyện AI (trừ khi gửi phản hồi); không hiện quảng cáo | Notebook chứa đoạn chat Gemini làm ngữ cảnh sẽ ở chế độ riêng tư, không chia sẻ được | Lịch sử chat AI Mode không đồng bộ về gốc và **có thể dùng cho cá nhân hóa/quảng cáo** |

---

## 2. GÓI CƯỚC, HẠN MỨC COMPUTE 5 GIỜ & QUY ĐỊNH WATERMARK TẠI VIỆT NAM

### 2.1. Bảng so sánh 4 gói cước (Cập nhật 15/10/2026)

| Thông số | Miễn phí (Free) | Google AI Plus | Google AI Pro | Google AI Ultra |
|:---|:---|:---|:---|:---|
| **Hạn mức sử dụng (Compute)** | Chuẩn (1×) | **2×** chuẩn | **4×** chuẩn | **5× hoặc 20×** so với Pro |
| **Số nguồn tối đa / notebook** | **50** nguồn | **100** nguồn | **300** nguồn | **500** (gói 20TB) / **600** (gói 30TB) |
| **Số notebook tối đa / người** | **100** notebook | **200** notebook | **500** notebook | **500** notebook |
| **Video Cinematic (18+, EN)** | Không có | Không có | **Có hỗ trợ** | **Có hỗ trợ** |
| **Advanced Sharing & Analytics** | Cơ bản | Mở rộng | **Tùy biến Chat & Xem Analytics** | **Tùy biến Chat & Xem Analytics** |
| **Chat Agent (chạy code, xuất file)** | Chưa công bố | Đang triển khai | Mở dần trên Web sau Ultra | **Ưu tiên đầu tiên (Ultra trước)** |
| **Giá tham khảo tại VN / tháng** | **0đ** | **132.000đ** | **489.000đ** | **2.250.000đ** (5×) / **5.500.000đ** (20×) |

### 2.2. Cơ chế hạn mức Compute làm mới mỗi 5 giờ (Từ 02/09/2026)
- Thay vì đếm số lượt cứng cho từng loại, hệ thống tính theo **Compute (sức tính toán)**. Một câu chat tốn rất ít compute, trong khi tạo Video Cinematic tốn lượng compute lớn hơn nhiều lần.
- **Chu kỳ làm mới**: Hạn mức tự động làm mới **mỗi 5 giờ**, cho đến khi chạm trần hạn mức tuần.
- **Kiểm tra & Hẹn tạo (`Generate later`)**:
  - Xem mức sử dụng tại `Settings → Usage`. Trước khi bấm tạo trong Studio có thanh hiển thị chi phí dự kiến.
  - Khi hết hạn mức 5 giờ, trên giao diện Web có nút **`Generate later` (Tạo sau)**: hệ thống lưu cấu hình và tự động chạy ngầm ngay khi hạn mức được làm mới.
  - *Mẹo tiết kiệm*: Các tác phẩm Google tự động tạo sẵn lúc mới thêm nguồn không bị trừ vào hạn mức của bạn.

### 2.3. Quy định Watermark bắt buộc tại Việt Nam
- Mọi hình ảnh, infographic và video tạo bởi Gemini Notebook đều nhúng **SynthID** (watermark vô hình).
- Theo chính sách khu vực của Google: Người dùng gói Pro/Ultra có thể tắt watermark hiển thị ở các quốc gia khác, **NHƯNG tại Việt Nam, Ấn Độ và Hàn Quốc, watermark hiển thị (logo nhìn thấy được) luôn được áp dụng tự động** trên mọi ảnh/infographic/video kể cả khi dùng gói Pro hay Ultra.
- **Nguyên tắc**: Tuyệt đối không dùng công cụ xóa watermark khi đăng tải và luôn ghi chú minh bạch *"Nội dung có sử dụng AI (Gemini Notebook)"*.

---

## 3. HỆ THỐNG NGUỒN (SOURCES) & NGHIÊN CỨU Tự ĐỘNG

### 3.1. Bảng thông số kỹ thuật các loại nguồn đầu vào

| Loại nguồn | Định dạng / Cách nạp | Giới hạn & Đặc tả kỹ thuật |
|:---|:---|:---|
| **Tài liệu tệp (Files)** | `PDF`, `DOCX`, `TXT`, `Markdown`, `CSV`, `PPTX`, `EPUB` | Tối đa **500.000 từ** hoặc **200MB** mỗi nguồn (không giới hạn số trang). |
| **Google Workspace** | `Google Docs`, `Google Slides`, `Google Sheets` | Slides **≤ 100 slide**; Sheets **≤ 100.000 token**. **Tự động đồng bộ** vài phút/lần khi file gốc trên Drive thay đổi. (Docs nhiều tab sẽ gộp thành 1 nguồn; không lấy phần comment). |
| **Hình ảnh (Images)** | `jpg`, `png`, `webp`, `heic`, `gif`, `tiff`, `avif` | Đọc được cả ảnh chụp vở ghi viết tay rõ nét, bảng trắng, phiếu bài tập. |
| **Âm thanh (Audio)** | `mp3`, `wav`, `m4a`, `aac`, `ogg`, `opus` | Tự động chép lời (transcript) khi nạp, **hỗ trợ tiếng Việt**. |
| **Trang Web (URLs)** | Dán 1 hoặc nhiều URL (cách nhau bởi dấu cách/xuống dòng) | **Chỉ lấy phần chữ tĩnh**; không lấy ảnh/video nhúng, không đọc trang khóa đăng nhập/paywall hoặc render thuần JS. |
| **YouTube** | URL video YouTube công khai | Chỉ đọc phụ đề (transcript có sẵn hoặc tự động). Video mới đăng **dưới 72 giờ** có thể chưa nạp được. Nếu video bị xóa/chuyển riêng tư, nguồn tự xóa sau 30 ngày. |
| **Văn bản dán** | `Copied text` | Lưu thành một ghi chú nguồn cố định trong khung Nguồn. |
| **Sách Play Books** | Sách đã mua trên Google Play Books (*Expert Intelligence*) | Hơn 100.000 đầu sách từ 27/08/2026. Chỉ đọc phần chữ; **không thể chia sẻ công khai** notebook chứa tác phẩm tạo từ sách này; người được chia sẻ riêng cũng phải mua sách. |
| **Ghi chú (Notes)** | `Save to note` hoặc `Create note` | Ghi chú hiện nằm trực tiếp trong khung Nguồn và **được dùng làm nguồn** cho cả Chat lẫn Studio. |

### 3.2. Tìm nguồn tự động: Fast Research vs. Deep Research

Tại ô *"Search the web for new sources"* ở đầu khung Nguồn, người dùng có thể chọn tìm trên **Web** hoặc **Drive**:

| Tiêu chí | Fast Research (Tìm nhanh) | Deep Research (Nghiên cứu sâu - 18+) |
|:---|:---|:---|
| **Thời gian xử lý** | Vài giây đến 1 – 2 phút | Vài phút (duyệt hàng trăm trang web) |
| **Cơ chế hoạt động** | Tìm kiếm nhanh các trang liên quan trực tiếp đến từ khóa | Lập kế hoạch nghiên cứu đa bước, đọc hàng trăm trang, tổng hợp thành báo cáo nhiều trang |
| **Kết quả trả về** | Danh sách nguồn đề xuất để tick chọn `Import` | **Báo cáo tổng quan chuyên sâu + Danh sách nguồn** (có thể chọn Import cả báo cáo lẫn nguồn) |
| **Khi nào sử dụng** | Cần bổ sung nhanh vài tài liệu cho chủ đề đã rõ | Bắt đầu dự án/luận văn mới hoàn toàn, cần bức tranh toàn cảnh và phân tích đa chiều |

### 3.3. Kỹ thuật "Ghi chú 00 – Bối cảnh" & Quản lý nhãn tự động
- **Ghi chú `00 – Bối cảnh`**: Tạo một ghi chú đặt tên `00 – Bối cảnh` ghi rõ vai trò của bạn, mục tiêu dự án, đối tượng độc giả và quy chuẩn đầu ra. Khi tick chọn ghi chú này cùng tài liệu, mọi sản phẩm Studio (Slide, Quiz, Audio, Báo cáo) sẽ bám sát mục tiêu cá nhân hóa.
- **Nhãn tự động (Auto-tags)**: Khi sổ tay có từ **5 nguồn trở lên**, Gemini Notebook tự động gắn nhãn phân nhóm chủ đề cho nguồn.

---

## 4. KHUNG CHAT, CONFIGURE CHAT & "CHAT AGENT" CHẠY CODE

### 4.1. Kiểm chứng trích dẫn & 3 kiểu lỗi ngụy tạo cần cảnh giác
Mỗi nhận định của Gemini Notebook đều đính kèm số trích dẫn `①, ②`. Khi rê chuột hoặc bấm vào sẽ mở đúng đoạn văn, bảng biểu hoặc hình ảnh gốc. Cần kiểm tra 3 lỗi suy diễn phổ biến:
1. **Gộp ý (Conflation)**: Ghép 2 đoạn ở 2 ngữ cảnh khác nhau thành một kết luận mới không có trong nguồn.
2. **Bỏ điều kiện (Condition Stripping)**: Nguồn ghi *"trong một số trường hợp / có thể"*, AI tóm tắt thành *"luôn luôn / bắt buộc"*.
3. **Không có số trích dẫn**: Mọi câu nhận định không gắn số trích dẫn phải được coi là suy luận ngoài luồng và cần kiểm tra chéo.

### 4.2. Configure Chat (Cấu hình tính cách & độ dài trả lời)
- **Phong cách (`Style/Role`)**:
  - `Default`: Trả lời nghiên cứu tiêu chuẩn.
  - `Learning Guide`: Đóng vai gia sư gợi mở từng bước, đặt câu hỏi dẫn dắt thay vì đưa ngay đáp án.
  - `Custom`: Tự viết System Prompt định nghĩa vai trò, giọng văn, cấu trúc đầu ra (đồng bộ sang cả App Gemini và AI Mode).
- **Độ dài (`Response Length`)**: `Default`, `Longer`, `Shorter`.

### 4.3. Chat "Agent": Máy tính đám mây (Cloud Sandbox) chạy code & Xuất file
Từ 08/06/2026 và nâng cấp ngày 16/07/2026 (chạy trên **Gemini 3.5 + Antigravity** với hơn **100 kỹ năng**), mỗi sổ tay có một môi trường Cloud Sandbox bảo mật riêng:

| Nhóm đầu ra | Định dạng file tải về | Khả năng xử lý của Chat Agent |
|:---|:---|:---|
| **Biểu đồ trực quan** | `PNG`, `SVG` | Tự viết code vẽ biểu đồ cột, đường, tròn; hỗ trợ ra lệnh sửa màu sắc, thêm nhãn số, đổi loại biểu đồ ngay trong chat. |
| **Tài liệu văn bản** | `PDF`, `Word (.docx)`, `Markdown (.md)`, `TXT` | Dàn trang báo cáo nhiều trang có chèn biểu đồ, xuất thẳng file `.docx` hoặc `.pdf`. |
| **Bảng tính dữ liệu** | `Excel (.xlsx)`, `CSV`, `JSON` | Xuất file Excel nhiều sheet (`mỗi phần 1 sheet`), giữ nguyên công thức tính toán. |
| **Trình chiếu (Editable 100%)** | `PowerPoint (.pptx)` | **Tạo file PPTX chỉnh sửa được 100% từng chữ (text box thật)** – khắc phục hoàn toàn nhược điểm chữ bị "dính" vào nền ảnh của công cụ Slide Deck trong Studio. |
| **Hình ảnh** | `PNG`, `JPG`, `GIF` | Sinh hình ảnh minh họa phục vụ bài đăng hoặc báo cáo. |

#### Quy trình 5 bước phân tích dữ liệu CSV / Google Sheets bằng tiếng Việt:
1. **Nạp nguồn**: Thêm file `CSV` hoặc `Google Sheets` vào khung Nguồn.
2. **Chạy kiểm tra dữ liệu bẩn**: Yêu cầu kiểm tra ô trống, dòng trùng lặp, lỗi định dạng ngày/số trước khi tính toán.
3. **Đặt câu hỏi & Theo dõi `thinking steps`**: Mở xem từng bước suy nghĩ và đoạn code Python mà Chat Agent thực thi để kiểm soát công thức.
4. **Vẽ & Tinh chỉnh biểu đồ**: Ra lệnh vẽ và yêu cầu chỉnh sửa trực tiếp (*"Đổi sang biểu đồ cột, màu cam, thêm nhãn số"*).
5. **Xuất gói file hoàn chỉnh**: Yêu cầu xuất đồng thời file Excel đa sheet và báo cáo PDF.

---

## 5. CHI TIẾT 9 CÔNG CỤ TRONG KHUNG STUDIO

### 5.1. Audio Overview (Podcast AI từ tài liệu)
- **Hỗ trợ ngôn ngữ**: 80+ ngôn ngữ, **có tiếng Việt tự nhiên**.
- **4 định dạng (`Format`)**:
  1. **`Deep Dive` (Mặc định)**: Hai người dẫn trò chuyện sôi nổi, mổ xẻ sâu và kết nối các chủ đề.
  2. **`Brief`**: Một người nói, tóm tắt cốt lõi **dưới 2 phút**.
  3. **`Critique`**: Hai người dẫn nhận xét, phê bình có tính xây dựng (rất hợp để góp ý bài luận, kế hoạch, dự thảo).
  4. **`Debate`**: Hai người dẫn tranh luận 2 chiều đối lập về một vấn đề trong tài liệu.
- **Độ dài (`Length`)**: `Short` / `Default` / `Long` (trên UI chính thức ưu tiên tiếng Anh; với tiếng Việt nên ghi rõ thời lượng mong muốn như *"Giữ tập này khoảng 5 phút"* vào ô prompt).
- **Interactive Mode (`Join` – Chỉ tiếng Anh, Beta)**: Khi đang nghe audio mới tạo, bấm nút **`Join`** để nói chuyện trực tiếp qua micro với 2 host AI; host trả lời dựa trên nguồn rồi quay lại mạch podcast.

### 5.2. Video Overview (3 định dạng & 9 phong cách hình)
- **Thời gian chờ thực tế**: Có thể mất **hơn 30 phút** (đặc biệt với bản Cinematic). Cần bật `Web notifications` hoặc tăng timeout của tiến trình nền.
- **3 định dạng (`Format`)**:

| Định dạng | Đặc tả & Tỷ lệ khung hình | Điều kiện & Ngôn ngữ |
|:---|:---|:---|
| **`Explainer`** | Video giải thích có cấu trúc toàn diện, nối kết các điểm dữ liệu kèm hình minh họa và thuyết minh. | Mọi gói cước; **có thuyết minh tiếng Việt**. |
| **`Short`** *(Mới 09/2026)* | **Video dọc (~60 giây, tỷ lệ 9:16)**, kết hợp lời kể ngắn gọn với hoạt họa giáo dục (công thức, sơ đồ), tối ưu cho Reels, TikTok, YouTube Shorts. | Mọi gói cước; hỗ trợ **80+ ngôn ngữ (có tiếng Việt)**. |
| **`Cinematic`** | Trải nghiệm phim "điện ảnh", kể chuyện bằng hình ảnh chuyển động phong phú cho các ý tưởng phức tạp. | Yêu cầu gói **Pro / Ultra**, tài khoản **18+**, hiện **chỉ hỗ trợ tiếng Anh**, tốn nhiều compute. |

- **9 Phong cách hình (`Visual style` – 18+, áp dụng cho Explainer)**:
  `Classic` (Mặc định) · `Whiteboard` (Vẽ tay bảng trắng) · `Watercolor` (Màu nước) · `Retro Print` (In ấn cổ điển) · `Heritage` (Cổ kính) · `Paper-craft` (Cắt dán giấy) · `Kawaii` (Dễ thương kiểu Nhật) · `Anime` (Hoạt hình Nhật) · `Auto / Custom` (Tự mô tả phong cách riêng).

### 5.3. Mind Map (Sơ đồ tư duy tương tác – Chỉ trên Web)
- Biến tài liệu thành sơ đồ phân nhánh trực quan.
- **Tính năng đào sâu**: Bấm trực tiếp vào bất kỳ nút nhánh (`node`) nào trên sơ đồ, Gemini Notebook sẽ tự động sinh câu hỏi chuyên sâu về nhánh đó ngay trong khung Chat.
- Hỗ trợ phóng to/thu nhỏ và tải xuống thành file ảnh PNG (`Download`).

### 5.4. Infographic (Đồ họa thông tin một trang – 18+)
- **Mức chi tiết (`Detail level`)**: `Concise` (Ngắn gọn – **khuyên dùng cho tiếng Việt** để tránh lỗi sai dấu chữ trong ảnh), `Standard` (Chuẩn), `Detailed` (Chi tiết, Beta).
- **Hướng giấy (`Orientation`)**: `Square` (Vuông 1:1), `Portrait` (Dọc), `Landscape` (Ngang).
- **10 Phong cách thiết kế**: `Sketch Note`, `Kawaii`, `Professional`, `Scientific`, `Anime`, `Clay`, `Editorial`, `Instructional`, `Bento Grid`, `Bricks` (hoặc `Auto-select`).
- Xuất file ảnh `PNG` độ phân giải cao.

### 5.5. Slide Deck (Bộ trình chiếu & Cơ chế Revise – 18+)
- **2 định dạng (`Format`)**:
  - **`Detailed Deck`**: Đầy đủ câu chữ và số liệu chi tiết, dùng để gửi email hoặc đọc độc lập.
  - **`Presenter Slides`**: Cô đọng, ít chữ, nhiều hình minh họa để hỗ trợ người thuyết trình.
- **Độ dài**: `Short`, `Default`, `Long`.
- **`Review outline notes` *(Mới 09/2026)***: Công tắc cho phép duyệt và chỉnh sửa dàn ý nháp trước khi AI render bộ slide cuối cùng.
- **Chế độ `Revise` (Sửa từng slide)**:
  - Cho phép ghi yêu cầu sửa chữ, bố cục, hình ảnh trên từng slide cụ thể, xóa slide thừa hoặc kéo thả đổi thứ tự.
  - Mọi thay đổi được gom vào **`Pending Changes`**, sau đó bấm **`Generate revised deck`** để tạo lại trong 1 lần (tiết kiệm compute). *Lưu ý: Khi Revise, AI không tự đối chiếu lại nguồn nên nếu muốn thêm số liệu mới phải dán trực tiếp số liệu vào lời nhắc.*
- **Xuất file**: Tải về dưới dạng `PDF (.pdf)` hoặc `PowerPoint (.pptx)`. *(Lưu ý: Slide từ Studio thường ghép chữ vào nền ảnh; nếu cần sửa chữ 100% hãy dùng Chat Agent tạo PPTX).*

### 5.6. Reports (Báo cáo Document & Báo cáo tương tác Interactive)
- **Format 1 – `Interactive` *(Mới 09/2026, Chỉ trên Web)***:
  - Mẫu **`Learning Overview`**: Tạo một "giáo trình tương tác" có mục lục bên trái, nội dung tổng hợp ở giữa và các thẻ gợi ý `Recommended` để nhúng trực tiếp **Quiz, Flashcards, Video, Infographic, Mind Map** ngay bên trong bài đọc.
- **Format 2 – `Document` (Văn bản cấu trúc)**:
  - Các mẫu cố định: `Briefing Doc` (Tóm tắt điều hành), `Study Guide` (Đề cương ôn tập), `FAQ` (Hỏi đáp), các mẫu do AI tự đề xuất theo ngữ cảnh nguồn, hoặc **`Create your own`** (tự định nghĩa cấu trúc báo cáo).
  - Hỗ trợ chỉnh sửa trực tiếp (`Edit`) và xuất thẳng sang **Google Docs** (`Export to Docs`).

### 5.7. Data Table (Bảng dữ liệu tổng hợp có trích dẫn)
- Gom thông tin phân tán từ hàng chục tài liệu thành bảng cấu trúc theo hàng và cột do người dùng chỉ định.
- **Xuất sang Google Sheets (`Export to Sheets`)**: File Google Sheets sinh ra luôn gồm **2 tab**:
  - **Tab 1**: Bảng dữ liệu đã tổng hợp.
  - **Tab 2 (`Citations`)**: Danh sách trích dẫn chi tiết để kiểm chứng từng ô dữ liệu lấy từ tài liệu nào.

### 5.8. Flashcards & Quiz (Công cụ học tập chủ động)
- **Flashcards**:
  - Tùy chỉnh số lượng (`Fewer` / `Standard` / `More`) và độ khó (`Easy` / `Medium` / `Hard`).
  - Nút **`Explain`** giải thích chi tiết thẻ khó trong khung Chat kèm trích dẫn; đánh dấu `Got it` (đã thuộc) / `Missed it` (chưa thuộc) và chế độ ôn riêng thẻ sai **`Only cards you missed`**.
  - Hỗ trợ **tải file `CSV`** để import thẳng vào **Anki** hoặc **Quizlet**.
- **Quiz**:
  - Hỗ trợ nút **`Hint`** (gợi ý khi bí) và **`Explain`** (giải thích đáp án sai).
  - **Các định dạng câu hỏi mới *(Từ 15/09/2026)***: Ngoài trắc nghiệm 1 đáp án truyền thống, đã có **`Multiple select`** (chọn nhiều đáp án đúng), **`Short answer`** (tự luận ngắn) và **`Fill in the blank`** (điền vào chỗ trống).
  - Sau khi làm xong, có thể hỏi trực tiếp trong khung Chat về kết quả vừa làm để AI phân tích lỗ hổng kiến thức và tạo đề luyện tập riêng cho phần yếu.

---

## 6. TỪ ĐIỂN GIAO DIỆN ANH – VIỆT CHUẨN (PHỤ LỤC D)

| Thuật ngữ Tiếng Anh | Nghĩa Tiếng Việt | Giải thích chức năng trong Gemini Notebook |
|:---|:---|:---|
| **Source guide** | Hướng dẫn nguồn | Bản tóm tắt tự động và các chủ đề chính của riêng một nguồn. |
| **Inactive source** | Nguồn không hoạt động | Nguồn Google Drive bị xóa hoặc mất quyền truy cập (vẫn chiếm chỗ cho đến khi xóa). |
| **Configure Chat** | Cấu hình chat | Thiết lập phong cách (`Default` / `Learning Guide` / `Custom`) và độ dài câu trả lời. |
| **Convert to source** | Chuyển thành nguồn | Biến ghi chú (Note) thành nguồn dữ liệu đầu vào cho Chat và Studio. |
| **Generate later** | Tạo sau | Hẹn hệ thống tự động tạo tác phẩm Studio ngay khi hạn mức 5 giờ được làm mới. |
| **Audio Overview** | Tổng quan âm thanh | Podcast AI từ nguồn với 4 chế độ: `Deep Dive`, `Brief`, `Critique`, `Debate`. |
| **Interactive mode / Join** | Chế độ tương tác | Bấm `Join` để trò chuyện bằng giọng nói trực tiếp với 2 người dẫn podcast (Tiếng Anh). |
| **Video Overview** | Tổng quan video | Video thuyết minh từ nguồn với 3 chế độ: `Explainer`, `Short` (dọc 60s), `Cinematic`. |
| **Detailed Deck / Presenter Slides** | Slide chi tiết / Slide thuyết trình | Hai chế độ tạo bộ slide trong Studio. |
| **Review outline notes** | Duyệt dàn ý slide | Xem và chỉnh sửa dàn ý trước khi AI tạo bộ slide hoàn chỉnh. |
| **Revise / Pending Changes** | Chỉnh sửa / Thay đổi chờ xử lý | Ghi yêu cầu sửa từng slide và gom tạo lại trong một lượt. |
| **Learning Overview** | Tổng quan học tập | Báo cáo tương tác (`Interactive Report`) nhúng sẵn Quiz, Flashcards, Video. |
| **Got it / Missed it** | Đã thuộc / Chưa thuộc | Nút đánh dấu trạng thái ghi nhớ khi lật thẻ Flashcards. |
| **Chat view** | Chế độ chỉ chat | Link chia sẻ giao diện rút gọn chỉ hiện khung hỏi đáp cho khách hàng/học viên. |
| **Allow copies** | Cho phép sao chép | Cho phép người nhận tạo bản sao độc lập của notebook (gồm nguồn và tác phẩm Studio). |
| **Collections** | Bộ sưu tập | Gom nhóm nhiều notebook theo dự án/chuyên đề như danh sách phát. |
