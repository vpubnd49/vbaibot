/**
 * Bảng định tuyến "việc này → tool nào" cho nhóm tool dễ chọn nhầm.
 *
 * Vì sao cần: các tool tạo file/đọc file chồng vai trò (create_admin_document vs
 * create_word_document vs create_text_document vs ocr_folder_to_file vs
 * convert_file...). Lỗi thật: người dùng gửi ảnh mẫu "DANH SÁCH" có bảng 8 cột,
 * bot gọi create_admin_document → bị ép khung công văn, mất bảng.
 *
 * Mỗi dòng gắn với ĐÚNG MỘT tool và chỉ hiện khi tool đó đang bật - giữ bất
 * biến của persona: không bao giờ nhắc tool mà model không nhận được.
 */
export type DongDinhTuyen = { tool: string; khi: string };

export const BANG_DINH_TUYEN: DongDinhTuyen[] = [
  {
    tool: "create_admin_document",
    khi: "Soạn VB hành chính/Đảng CHUẨN có số, loại VB, trích yếu, kính gửi (công văn, tờ trình, quyết định, giấy mời, kế hoạch, báo cáo, phiếu trình...).",
  },
  {
    tool: "create_word_document",
    khi: "Biểu mẫu/danh sách/bảng có BỐ CỤC RIÊNG (người dùng gửi mẫu, ảnh mẫu), bài viết, tham luận, tài liệu tự do. Dựng bằng block two_columns/heading/table/paragraph; bảng phải là block table thật.",
  },
  { tool: "create_excel_file", khi: "Bảng số liệu, danh sách cần tính toán/lọc, checklist dạng bảng (.xlsx)." },
  { tool: "create_powerpoint", khi: "Slide trình chiếu (.pptx)." },
  { tool: "create_text_document", khi: "Xuất nội dung MỚI ra MD/TXT/CSV/HTML/PDF." },
  {
    tool: "convert_file",
    khi: "Đổi định dạng file NGƯỜI DÙNG ĐÃ GỬI (Word↔PDF, PDF→ảnh, ảnh→PDF, âm thanh/video, RAR/TAR→ZIP) - không soạn lại nội dung.",
  },
  {
    tool: "ocr_folder_to_file",
    khi: "Đọc HÀNG LOẠT nhiều ảnh/file/ZIP rồi tổng hợp ra một file kết quả.",
  },
  { tool: "read_document", khi: "Đọc MỘT file tài liệu (PDF/Word/Excel/ZIP/RAR) để trả lời hoặc làm mẫu - chọn bằng fileName khi có nhiều file." },
  { tool: "read_image", khi: "Soi chi tiết ảnh: đọc chữ nhỏ, chép đúng từng chữ ảnh mẫu, đếm, mô tả." },
  { tool: "transcribe_audio", khi: "Bóc băng file ghi âm thành chữ." },
  { tool: "video_workshop", khi: "Cắt/nén/tạo GIF/chèn chữ cho video đã có." },
  { tool: "download_video", khi: "Tải video/nhạc từ link YouTube/TikTok/Facebook/Instagram." },
  { tool: "national_legal", khi: "Tra cứu/tải VB pháp luật cấp Trung ương (Luật, NĐ, TT, QĐ-TTg)." },
  { tool: "qppl_lamdong", khi: "Tra cứu/tải VB của UBND/HĐND tỉnh Lâm Đồng và các sở, địa phương." },
  { tool: "legal_search", khi: "Hỏi hiệu lực, điều khoản, VB thay thế (không cần tải file)." },
  { tool: "thanhtra_lamdong", khi: "Kết luận thanh tra tỉnh Lâm Đồng." },
  { tool: "search_noi_chinh", khi: "Tìm mẫu VB Nội chính thật để tham khảo trước khi soạn." },
];

/** Khối định tuyến chỉ gồm tool đang bật; cần ≥2 dòng mới có ý nghĩa "chọn giữa". */
export function khoiDinhTuyen(available: Set<string>): string | null {
  const dong = BANG_DINH_TUYEN.filter((d) => available.has(d.tool));
  if (dong.length < 2) return null;
  return (
    "Bảng chọn công cụ (chọn ĐÚNG một tool theo việc, đừng gọi tool khác làm thay):\n" +
    dong.map((d) => `- ${d.tool}: ${d.khi}`).join("\n")
  );
}
