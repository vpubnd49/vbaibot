/**
 * Mô tả tool vẽ ảnh - tách riêng vì đây là thứ dễ viết hỏng nhất.
 *
 * BÀI HỌC ĐẮT: đã từng nhét vào đây một "brief thiết kế 5 mục" kèm ví dụ cụ thể
 * (chữ bên trái, minh họa bên phải, nền navy chuyển tím than, điểm nhấn cyan).
 * Kết quả là MỌI ảnh ra một khuôn, và còn xấu hơn trước.
 *
 * Lý do: `cx/gpt-5.5-image` KHÔNG phải model vẽ ảnh. Router bóc đuôi `-image`
 * rồi gọi thẳng GPT-5.5 - model chat đầy đủ - với `instructions: ""` và một tool
 * `image_generation` (xem `imageProviders/codex.js`, hàm buildBody). Nó đọc
 * prompt như tin nhắn người dùng rồi TỰ thiết kế.
 *
 * Đo thật: gửi prompt trần trụi (đúng câu người dùng gõ, không gợi ý gì) 3 lần
 * cho ra 3 thiết kế khác hẳn nhau, đều dày dặn chuyên nghiệp, và nó tự nghĩ
 * thêm cụm icon kèm chữ tiếng Việt mà không ai bảo. Brief của mình chỉ trói tay
 * nó lại.
 *
 * Nguyên tắc từ đó: mô tả này chỉ nói những gì có LÝ DO CHỨC NĂNG (chữ phải
 * nguyên văn, tỉ lệ phải nói trong prompt vì không có tham số riêng). TUYỆT ĐỐI
 * không kê đơn thẩm mỹ - không ví dụ màu, không ví dụ bố cục, không mật độ.
 * Gu của người viết code lọt vào đây là mọi ảnh của mọi người dùng đều dính.
 */

/** Có lý do chức năng: không chép nguyên văn thì model vẽ ra chữ bịa */
const CHU_PHAI_NGUYEN_VAN =
  "CHỮ NGƯỜI DÙNG ĐƯA phải chép NGUYÊN VĂN vào prompt (tiêu đề, bài viết, câu trích, giá, tên, số điện thoại): " +
  'đặt trong ngoặc kép, ghi rõ vai trò từng phần (TIÊU ĐỀ: "...", ĐOẠN MỞ: "...", TRÍCH DẪN: "..."). ' +
  'TUYỆT ĐỐI không tóm tắt thành chủ đề - viết "chủ đề thiền Phật giáo" thì ảnh ra chữ bịa, còn chép nguyên ' +
  "văn thì ra đúng chữ họ cần. Giữ nguyên dấu tiếng Việt, dặn viết đúng chính tả.";

/** Có lý do chức năng: API không có tham số kích thước, model bỏ qua `size` */
const TI_LE_NOI_TRONG_PROMPT =
  "KÍCH THƯỚC/TỈ LỆ không có tham số riêng - muốn dọc, ngang, vuông hay tỉ lệ cụ thể (4:1, 16:9...) thì phải " +
  "nói trong prompt.";

/**
 * Điều quan trọng nhất: chuyển đúng ý người dùng, KHÔNG tự thêm ràng buộc.
 * Bên nhận prompt là một model chat biết thiết kế - để nó tự do thì mỗi lần ra
 * một phương án khác; áp sẵn phong cách là mọi ảnh giống nhau.
 */
const TRUNG_THANH_VOI_Y_NGUOI_DUNG =
  "Prompt phải TRUNG THÀNH với ý người dùng. Họ nói gì về phong cách (sang trọng, tối giản, rực rỡ, cổ điển, " +
  "trẻ trung...), màu sắc, bố cục, thứ muốn có trong ảnh thì đưa hết vào. Họ KHÔNG nói thì ĐỪNG TỰ BỊA ràng " +
  "buộc - đừng tự chọn màu, đừng tự sắp bố cục, đừng tự quyết dày hay thoáng. Bên nhận prompt là một model " +
  "biết thiết kế, để nó tự do thì mỗi lần ra một phương án khác nhau; áp sẵn phong cách là ảnh nào cũng như " +
  "ảnh nào. Mô tả ngắn gọn đúng thứ người dùng cần còn hơn tả dài theo gu của bạn.";

/** Người dùng chê xấu: phải hỏi/đoán đúng hướng họ muốn, không lặp lại prompt cũ */
const KHI_BI_CHE_XAU =
  "Người dùng chê xấu hoặc nhờ chỉnh lại: viết prompt MỚI theo ĐÚNG hướng họ nêu (sang trọng hơn, tối giản hơn, " +
  "nhiều màu hơn...), giữ nguyên phần chữ. Đừng gửi lại prompt cũ, cũng đừng tự đổi sang hướng họ không nhắc tới.";

/** Hướng dẫn sửa ảnh chuyên sâu (Image-to-Image / Inpainting / Virtual Staging) */
const QUY_TAC_SUA_ANH =
  "KHI SỬA ẢNH ĐÃ GỬI (mode = 'sua_anh_da_gui'):\n" +
  "1. ĐỔI NỀN / STUDIO BACKDROP: Giữ nguyên sản phẩm/chủ thể chính (hình dáng, màu sắc, chi tiết, nhãn hiệu). " +
  "Thay toàn bộ bối cảnh bằng phông nền mới (vd: phông studio đen tuyền ngả xám than mờ lì matte chống lóa, phông trắng tối giản, vân đá, bối cảnh sang trọng). " +
  "Ánh sáng studio kiểm soát tập trung vào sản phẩm, chuyển sắc gradient mịn màng ra các góc, vệt bóng mờ nhẹ tự nhiên (soft shadow) ở phần tiếp đất/chân máy.\n" +
  "2. PHỐI CẢNH NỘI THẤT / VIRTUAL STAGING (thêm rèm, sofa, giường, tủ, cây cảnh, tranh decor): Giữ nguyên cấu trúc căn phòng (tường, trần, sàn, giường ngủ, khung cửa sổ). " +
  "Lắp thêm vật thể mới (vd: rèm cầu vồng, rèm vải 2 lớp, bàn làm việc...) phủ vừa vặn khung cửa sổ hoặc vị trí chỉ định, ánh sáng và màu sắc hòa quyện tự nhiên với căn phòng.\n" +
  "3. LÀM SÁNG LẠI & CHỈNH ÁNH SÁNG (Relighting): Giữ nguyên bố cục ảnh gốc. Bù sáng cho các vùng tối, làm nổi rõ chi tiết, " +
  "tạo ánh sáng tự nhiên chan hòa (như nắng sớm qua cửa sổ) hoặc ánh sáng đèn studio ấm áp, cân bằng tương phản không bị chói gắt.\n" +
  "4. CẮT BỎ PHẦN THỪA & XÓA VẬT THỂ: Chỉ rõ vật thể thừa/bừa bộn cần loại bỏ (dây điện, đồ đạc ngổn ngang, người qua đường, rác...), " +
  "tái tạo bề mặt phía sau một cách tự nhiên và liền mạch.\n" +
  "5. THÊM CHỮ / TYPOGRAPHY / SLOGAN: Nêu rõ vị trí đặt chữ (góc trên, góc dưới, trung tâm), màu chữ tương phản dễ đọc, font chữ phù hợp và nội dung chữ nguyên văn trong ngoặc kép.\n" +
  "⭐ CẤU TRÚC PROMPT VÀNG KHI SỬA ẢNH: Phải tách bạch 2 phần: [BẢO TOÀN: nêu rõ đối tượng/không gian gốc cần giữ nguyên] + [BIẾN ĐỔI/THÊM/XÓA: nêu chi tiết nền mới, vật thể lắp thêm, ánh sáng, góc bóng đổ hoặc chữ cần chèn].";

export const CREATE_IMAGE_DESCRIPTION =
  "Vẽ ảnh mới bằng AI hoặc SỬA / VẼ LẠI / BIẾN ĐỔI ảnh người dùng vừa gửi, rồi gửi thẳng vào cuộc trò chuyện. " +
  "⚠️ TUYỆT ĐỐI KHÔNG DÙNG TOOL NÀY ĐỂ LÀM INFOGRAPHIC HOẶC TÓM TẮT TÀI LIỆU VĂN BẢN (mọi yêu cầu làm Infographic từ tài liệu văn bản BẮT BUỘC dùng tool 'notebooklm' với action: 'tao', loai: 'infographic'). " +
  "Dùng khi: " +
  "(1) Vẽ ảnh tranh vẽ, nghệ thuật (poster, banner, cover, e-magazine, ảnh minh họa); " +
  "(2) SỬA ẢNH ĐÃ GỬI (mode 'sua_anh_da_gui'): đổi nền / đặt vào phông studio, phối cảnh thêm rèm/nội thất vào phòng, làm sáng ảnh/chỉnh ánh sáng, xóa vật thể thừa/dọn dẹp bối cảnh, thêm chữ/slogan vào ảnh. " +
  "LƯU Ý: Khi người dùng gửi ảnh rồi yêu cầu sửa/đổi nền/thêm rèm/làm sáng/xóa vật thể/thêm chữ -> BẮT BUỘC chọn mode 'sua_anh_da_gui' để AI dùng ảnh gốc làm mẫu tham chiếu.\n" +
  "Mất 1-3 phút mỗi ảnh nên chỉ gọi khi người dùng thật sự muốn có ảnh.\n" +
  `${QUY_TAC_SUA_ANH}\n` +
  `${CHU_PHAI_NGUYEN_VAN}\n` +
  `${TI_LE_NOI_TRONG_PROMPT}\n` +
  `${TRUNG_THANH_VOI_Y_NGUOI_DUNG}\n` +
  `${KHI_BI_CHE_XAU}`;

