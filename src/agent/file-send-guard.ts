/**
 * Lá chắn chống ảo giác "đã gửi file" của LLM.
 *
 * Vấn đề đo được trên thực tế:
 * Khi người dùng yêu cầu: "chuyển qua file excel giúp tôi" (kèm file PDF/ảnh),
 * hoặc "xuất file excel", một số model (như Gemma 4 hoặc model khi thiếu step)
 * tự sinh text:
 * "Dạ anh Tran, em đã chuyển nội dung bảng... sang file Excel... [đã gửi file: Danh_sach.xlsx]"
 * nhưng KHÔNG HỀ GỌI TOOL `create_excel_file`!
 *
 * Hậu quả: Zalo chỉ nhận tin nhắn chữ, hoàn toàn KHÔNG có file nào được gửi,
 * người dùng bị lừa dối và khó chịu.
 *
 * Module này cung cấp:
 * 1. `laTinNhanAoGiacGuiFile`: Phát hiện câu trả lời khẳng định đã gửi/chuyển file
 *    nhưng thực tế không có tool tạo/gửi file nào được gọi trong lượt.
 * 2. `taoTinNhanNhacGoiTool`: Lời nhắc hệ thống chấn chỉnh model, ép model phải
 *    gọi tool tạo file ngay lập tức.
 * 3. `xoaNhanAoGiacGuiFile`: Xóa bỏ nhãn giả lập [đã gửi file: ...] trong tin nhắn
 *    khi không có tool nào gửi file thật sự.
 */

export const FILE_SEND_TOOLS = new Set([
  "create_excel_file",
  "create_word_document",
  "create_admin_document",
  "create_text_document",
  "create_powerpoint",
  "send_file",
  "create_image",
  "create_music",
  "create_video",
]);

/** Nhãn giả mạo do model tự gõ nhại theo history */
const NHAN_GIA_MAO_RE = /\[(?:đang|đã)\s+(?:tạo|xuất|gửi)\s+file:[^\]]+\]/i;
const NHAN_MEDIA_GIA_MAO_RE = /\[đã\s+gửi\s+(?:ảnh|video|file\s+nhạc)[^\]]*\]/i;

/** Câu từ khẳng định đã chuyển/gửi file cho người dùng */
const CAU_KHANG_DINH_GUI_FILE_RE =
  /(?:đã|vừa|em)\s+(?:chuyển|xuất|tạo|lập)(?:\s+nội\s+dung)?\s+.*?\s+sang\s+file\s+(?:excel|word|docx|xlsx|pdf|pptx)/i;
const CAU_DA_GUI_FILE_RE =
  /(?:đã|vừa|em)\s+(?:gửi|xuất)\s+(?:anh|chị|bạn|thầy|cô|bác)?\s*(?:cho\s+(?:anh|chị|bạn|thầy|cô|bác))?\s*file\s+(?:excel|word|docx|xlsx|pdf|pptx|\b[a-zA-Z0-9_-]+\.(?:xlsx|docx|pdf|pptx)\b)/i;
const CAU_DANG_XUAT_CHO_RE =
  /(?:đang|đã)\s+(?:xuất|gửi|thực\s+hiện(?:\s+lệnh|\s+quá\s+trình)?\s+(?:xuất|tạo|gửi))\s+file\s+.*?(?:cho|đến|tới)\s+(?:anh|chị|bạn)(?:\s+\p{Lu}\p{Ll}+)?/iu;
/**
 * "đang thực hiện lệnh xuất file Excel" / "em đang thực hiện xuất file"
 * Pattern tách riêng vì không cần "cho anh/chị" ở cuối — câu kiểu tường thuật
 * mà model hay nói trước khi ngắt lượt mà CHƯA gọi tool.
 */
const CAU_THUC_HIEN_XUAT_RE =
  /(?:đang|đã)\s+(?:thực\s+hiện|tiến\s+hành)(?:\s+(?:lệnh|quá\s+trình|việc))?\s+(?:xuất|tạo|gửi)\s+file/i;

/** Người dùng có ý định rõ ràng muốn xuất/chuyển sang file */
const Y_DINH_XUAT_FILE_RE =
  /(?:chuyển|xuất|tạo|lập|tiến\s+hành\s+(?:xuất|tạo|lập))\s+(?:qua|sang|thành|ra)?\s*(?:file\s*)?(?:excel|word|powerpoint|pptx|xlsx|docx)/i;
const Y_DINH_XUAT_EXCEL_RE = /(?:xuất|chuyển)\s+(?:sang\s+)?excel/i;
/** "tiến hành xuất", "xuất cho tôi", "gửi file cho tôi" — không kèm tên định dạng */
const Y_DINH_XUAT_CHUNG_RE =
  /(?:tiến\s+hành|hãy)\s+(?:xuất|tạo|gửi)(?:\s+file)?(?:\s+cho\s+(?:tôi|em|anh|chị))?/i;
const MO_TA_FILE_CUA_BOT_RE =
  /(?:em\s+(?:đã|đang|vừa)\s+(?:thiết\s+lập|tạo|chuyển|chia|sắp\s+xếp|xuất|hoàn\s+tất)|file\s+excel\s+(?:gồm|được|với)|bảng\s+tính\s+(?:gồm|với)|nội\s+dung\s+(?:bảng|file|tài\s+liệu))/i;

/**
 * Kiểm tra xem lượt trả lời có phải là ảo giác "đã gửi file" hay không.
 *
 * @param text Văn bản trả lời của model
 * @param toolCalls Danh sách tên các tool đã được gọi trong lượt
 * @param userPrompt Câu yêu cầu của người dùng (tùy chọn)
 */
export function laTinNhanAoGiacGuiFile(
  text: string,
  toolCalls: string[],
  userPrompt?: string,
): boolean {
  // Nếu đã gọi bất kỳ tool gửi file nào -> không phải ảo giác
  if (toolCalls.some((t) => FILE_SEND_TOOLS.has(t))) {
    return false;
  }

  // 1. Model tự gõ nhãn giả mạo [đã gửi file: ...] hoặc [đã gửi ảnh...]
  if (NHAN_GIA_MAO_RE.test(text) || NHAN_MEDIA_GIA_MAO_RE.test(text)) {
    return true;
  }

  // 2. Model nói bằng lời "em đã chuyển ... sang file Excel", "em gửi anh file..."
  if (
    CAU_KHANG_DINH_GUI_FILE_RE.test(text) ||
    CAU_DA_GUI_FILE_RE.test(text) ||
    CAU_DANG_XUAT_CHO_RE.test(text) ||
    CAU_THUC_HIEN_XUAT_RE.test(text)
  ) {
    return true;
  }

  // 3. Người dùng yêu cầu xuất file, model nói kiểu "em đã thiết lập file..." nhưng không gọi tool
  if (userPrompt) {
    const coYChuyenFile =
      Y_DINH_XUAT_FILE_RE.test(userPrompt) ||
      Y_DINH_XUAT_EXCEL_RE.test(userPrompt) ||
      Y_DINH_XUAT_CHUNG_RE.test(userPrompt);
    if (coYChuyenFile && MO_TA_FILE_CUA_BOT_RE.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Tạo lời nhắc hệ thống yêu cầu model phải gọi tool tạo file.
 */
export function taoTinNhanNhacGoiTool(): string {
  return (
    "CẢNH BÁO HỆ THỐNG: Bạn vừa trả lời người dùng rằng đã chuyển/tạo/gửi file hoặc có nhãn [đã gửi file:...], " +
    "nhưng trong suốt lượt này bạn CHƯA HỀ GỌI BẤT KỲ CÔNG CỤ TẠO FILE NÀO (create_excel_file, create_word_document...). " +
    "Trên Zalo HOÀN TOÀN KHÔNG CÓ FILE NÀO ĐƯỢC GỬI ĐẾN NGƯỜI DÙNG — người dùng chỉ thấy tin nhắn chữ và không nhận được tài liệu! " +
    "BẮT BUỘC: Bạn phải gọi ngay công cụ create_excel_file (hoặc create_word_document / create_admin_document...) " +
    "với đầy đủ dữ liệu bảng biểu, cột, dòng để hệ thống tạo và gửi file thật cho người dùng. " +
    "TUYỆT ĐỐI KHÔNG trả lời bằng văn bản suông mà không gọi tool!"
  );
}

/**
 * Xóa bỏ các nhãn giả mạo `[đã gửi file: ...]` khỏi văn bản khi không có tool nào chạy.
 */
export function xoaNhanAoGiacGuiFile(text: string): string {
  return text
    .replace(/\[(?:đang|đã)\s+(?:tạo|xuất|gửi)\s+file:[^\]]+\]/gi, "")
    .replace(/\[đã\s+gửi\s+(?:ảnh|video|file\s+nhạc)[^\]]*\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
