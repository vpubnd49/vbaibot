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
  "qppl_lamdong",
  "thanhtra_lamdong",
]);

/** Nhãn giả mạo do model tự gõ nhại theo history */
const NHAN_GIA_MAO_RE = /\[(?:đang|đã)\s+(?:tạo|xuất|gửi)\s+file:[^\]]+\]/i;
const NHAN_MEDIA_GIA_MAO_RE = /\[đã\s+gửi\s+(?:ảnh|video|file\s+nhạc)[^\]]*\]/i;

/** Câu từ khẳng định đã chuyển/gửi file cho người dùng */
const CAU_KHANG_DINH_GUI_FILE_RE =
  /(?:đã|vừa|em|sẽ|em\s+sẽ)\s+(?:chuyển|xuất|tạo|lập)(?:\s+nội\s+dung)?\s+.*?\s+sang\s+file\s+(?:excel|word|docx|xlsx|pdf|pptx)/i;
const CAU_DA_GUI_FILE_RE =
  /(?:đã|vừa|em|sẽ|em\s+sẽ)\s+(?:gửi|xuất)\s+(?:anh|chị|bạn|thầy|cô|bác)?\s*(?:cho\s+(?:anh|chị|bạn|thầy|cô|bác))?\s*(?:một\s+|các\s+|cả\s+|bộ\s+|[0-9]+\s+)?file\s+(?:excel|word|docx|xlsx|pdf|pptx|\b[a-zA-Z0-9_-]+\.(?:xlsx|docx|pdf|pptx)\b)/i;
const CAU_DANG_XUAT_CHO_RE =
  /(?:đang|đã|sẽ|em\s+(?:đang|đã|sẽ))\s+(?:xuất|gửi|thực\s+hiện(?:\s+lệnh|\s+quá\s+trình)?\s+(?:xuất|tạo|gửi))\s+(?:một\s+|các\s+|cả\s+|bộ\s+|[0-9]+\s+)?file\s+.*?(?:cho|đến|tới)\s+(?:anh|chị|bạn)(?:\s+\p{Lu}\p{Ll}+)?/iu;
/**
 * "đang thực hiện lệnh xuất file Excel" / "em đang thực hiện xuất file" / "em tiến hành xuất file"
 * "em tiến hành gọi tool xuất file" / "gọi tool xuất file" / "tiến hành gọi tool"
 */
const CAU_THUC_HIEN_XUAT_RE =
  /(?:đang|đã|sẽ|em\s+(?:đang|đã|sẽ|tiến\s+hành|thực\s+hiện))\s+(?:thực\s+hiện|tiến\s+hành)?(?:\s+(?:lệnh|quá\s+trình|việc|bước))?\s*(?:gọi\s+tool\s+)?(?:xuất|tạo|gửi|lập)\s+(?:một\s+|các\s+|cả\s+|bộ\s+|[0-9]+\s+)?file/i;

const CAU_SE_XUAT_FILE_RE =
  /(?:em\s+)?(?:sẽ|đang|tiến\s+hành)\s*(?:gọi\s+tool\s+)?(?:xuất|tạo|gửi|lập)\s+(?:một\s+|các\s+|cả\s+|bộ\s+|[0-9]+\s+)?file\s+(?:excel|word|docx|xlsx|pdf|pptx)/i;

/** Model nói trực tiếp "gọi tool" hoặc "tiến hành gọi tool" tạo/xuất */
const CAU_GOI_TOOL_XUAT_RE =
  /(?:gọi|kích\s+hoạt)\s+tool\s+(?:xuất|tạo|gửi|lập)/i;

/** Người dùng có ý định rõ ràng muốn xuất/chuyển sang file */
const Y_DINH_XUAT_FILE_RE =
  /(?:chuyển|xuất|tạo|lập|làm|làm\s+lại|lập\s+lại|chỉnh\s+sửa|soạn|viết|dựng|tiến\s+hành\s+(?:xuất|tạo|lập|làm))\s+(?:qua|sang|thành|ra)?\s*(?:file\s*)?(?:excel|word|powerpoint|pptx|xlsx|docx|pdf|bảng\s+biểu|bảng\s+tính|biểu\s+mẫu)/i;
const Y_DINH_XUAT_EXCEL_RE =
  /(?:tổng\s+hợp\s+)?(?:xuất|chuyển|làm|làm\s+lại|lập|tạo|soạn)\s+(?:sang\s+|lại\s+)?(?:file\s+)?(?:excel|xlsx|bảng\s+tính|bảng\s+biểu|biểu\s+mẫu|bảng\s+theo\s+dõi)/i;
/** "tiến hành xuất", "xuất cho tôi", "gửi file cho tôi", "tổng hợp xuất" — không kèm tên định dạng */
const Y_DINH_XUAT_CHUNG_RE =
  /(?:tiến\s+hành|hãy|vui\s+lòng|nhờ\s+bạn|tổng\s+hợp)\s+(?:xuất|tạo|gửi)(?:\s+file)?(?:\s+cho\s+(?:tôi|em|anh|chị))?/i;
const MO_TA_FILE_CUA_BOT_RE =
  /(?:em\s+(?:đã|đang|vừa|sẽ)\s+(?:thiết\s+lập|tạo|chuyển|chia|sắp\s+xếp|xuất|hoàn\s+tất|triển\s+khai)|file\s+excel\s+(?:gồm|được|với|chi\s+tiết)|bảng\s+tính\s+(?:gồm|với)|nội\s+dung\s+(?:bảng|file|tài\s+liệu)|sheet\s+["“]?[\w\s]+["”]?)/i;

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

  // Loại bỏ định dạng markdown (bold, italic, code, quotes) để regex không bị đứt đoạn
  const textChuan = text.replace(/[*_`"“”]/g, " ");

  // 1. Model tự gõ nhãn giả mạo [đã gửi file: ...] hoặc [đã gửi ảnh...]
  if (NHAN_GIA_MAO_RE.test(text) || NHAN_MEDIA_GIA_MAO_RE.test(text)) {
    return true;
  }

  // 2. Model nói bằng lời "em đã chuyển ... sang file Excel", "em gửi anh file...", "em tiến hành gọi tool xuất file..."
  if (
    CAU_KHANG_DINH_GUI_FILE_RE.test(textChuan) ||
    CAU_DA_GUI_FILE_RE.test(textChuan) ||
    CAU_DANG_XUAT_CHO_RE.test(textChuan) ||
    CAU_THUC_HIEN_XUAT_RE.test(textChuan) ||
    CAU_SE_XUAT_FILE_RE.test(textChuan) ||
    CAU_GOI_TOOL_XUAT_RE.test(textChuan)
  ) {
    return true;
  }

  // 3. Người dùng yêu cầu xuất file/bảng biểu, model nói kiểu "em đã thiết lập file...", cấu trúc sheet nhưng không gọi tool
  if (userPrompt) {
    const coYChuyenFile =
      Y_DINH_XUAT_FILE_RE.test(userPrompt) ||
      Y_DINH_XUAT_EXCEL_RE.test(userPrompt) ||
      Y_DINH_XUAT_CHUNG_RE.test(userPrompt);
    if (coYChuyenFile && MO_TA_FILE_CUA_BOT_RE.test(textChuan)) {
      return true;
    }
  }

  return false;
}

/**
 * Tạo lời nhắc hệ thống yêu cầu model phải gọi tool tạo file hoặc tải file.
 */
export function taoTinNhanNhacGoiTool(userPrompt?: string): string {
  const p = userPrompt?.toLowerCase() || "";
  const laYeuCauTaiVB =
    p.includes("tải") ||
    p.includes("quyết định") ||
    p.includes("công văn") ||
    p.includes("kế hoạch") ||
    p.includes("thông báo") ||
    p.includes("văn bản") ||
    p.includes("qđ") ||
    p.includes("ubnd");

  if (laYeuCauTaiVB) {
    return (
      "CẢNH BÁO HỆ THỐNG: Bạn vừa trả lời nhận là 'đã gửi file' nhưng HOÀN TOÀN CHƯA GỌI CÔNG CỤ NÀO! Người dùng CHƯA nhận được file! " +
      "Người dùng đang yêu cầu TẢI VĂN BẢN TỈNH LÂM ĐỒNG (Quyết định, Công văn, Kế hoạch, Văn bản chỉ đạo). " +
      "Bạn BẮT BUỘC PHẢI GỌI CÔNG CỤ `qppl_lamdong` NGAY BÂY GIỜ với tham số `sendFileToChat: true` và `keyword` là số hiệu văn bản (hoặc từ khóa)! " +
      "TUYỆT ĐỐI KHÔNG ĐƯỢC trả lời bằng văn bản suông hay hứa hẹn mà không gọi công cụ `qppl_lamdong`!"
    );
  }

  return (
    "CẢNH BÁO HỆ THỐNG: Người dùng đang yêu cầu tạo/xuất tài liệu (file Excel / Word / tài liệu). " +
    "Bạn BẮT BUỘC phải gọi ngay công cụ tạo file tương ứng (create_excel_file, create_word_document, create_admin_document...) " +
    "với đầy đủ dữ liệu, bảng tính, các sheet, tiêu đề và số liệu để hệ thống sinh file gửi trực tiếp cho người dùng. " +
    "TUYỆT ĐỐI KHÔNG trả lời bằng văn bản suông hay chỉ hứa hẹn mà không gọi công cụ tạo file!"
  );
}

/**
 * Xóa bỏ các nhãn giả mạo `[đã gửi file: ...]` khỏi văn bản khi không có tool nào chạy.
 */
export function xoaNhanAoGiacGuiFile(text: string): string {
  let cleaned = text
    .replace(/\[(?:đang|đã)\s+(?:tạo|xuất|gửi)\s+file:[^\]]+\]/gi, "")
    .replace(/\[đã\s+gửi\s+(?:ảnh|video|file\s+nhạc)[^\]]*\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Nếu text vẫn chứa câu khẳng định/hứa hẹn đã/sẽ xuất/gửi file trong khi không có tool gửi file nào chạy:
  const textChuan = cleaned.replace(/[*_`"“”]/g, " ");
  if (
    CAU_DA_GUI_FILE_RE.test(textChuan) ||
    CAU_KHANG_DINH_GUI_FILE_RE.test(textChuan) ||
    CAU_THUC_HIEN_XUAT_RE.test(textChuan) ||
    CAU_SE_XUAT_FILE_RE.test(textChuan) ||
    CAU_GOI_TOOL_XUAT_RE.test(textChuan)
  ) {
    cleaned += "\n\n*(⚠️ Lưu ý: Hệ thống chưa hoàn tất lệnh xuất/gửi file đính kèm tự động. Vui lòng nhắn lại: 'xuất file excel' hoặc 'xuất file word' để em kích hoạt tạo và gửi file cho anh nhé!)*";
  }

  return cleaned;
}
