/**
 * Phát hiện sentiment tin nhắn bằng keyword matching.
 *
 * Module THUẦN: không log, không DB, không LLM — chỉ so sánh chuỗi.
 * Dùng ở system prompt builder để inject tone phù hợp khi user đang gấp/bức xúc.
 */

export type Sentiment = "neutral" | "urgent" | "negative";

/**
 * Từ khóa phát hiện URGENT (gấp, cần ngay, deadline).
 * Chỉ cần chứa MỘT trong danh sách là đủ — vì đây là tín hiệu,
 * không phải phán quyết cuối cùng, model sẽ tự quyết phong cách.
 */
const URGENT_KEYWORDS = [
  "gấp",
  "gấp lắm",
  "khẩn",
  "khẩn cấp",
  "cấp bách",
  "ngay bây giờ",
  "ngay lập tức",
  "sớm nhất",
  "trước ",    // "trước 5h", "trước ngày mai"
  "deadline",
  "hạn chót",
  "hết hạn",
  "sắp họp",
  "đang họp",
  "trình ký ngay",
  "cần gấp",
  "làm ngay",
  "nhanh giúp",
  "giúp gấp",
  "hỏa tốc",
];

/**
 * Từ khóa phát hiện NEGATIVE (bức xúc, không hài lòng, phàn nàn).
 * Cảnh báo model nên cẩn trọng, chính xác hơn.
 */
const NEGATIVE_KEYWORDS = [
  "tức quá",
  "bực quá",
  "thất vọng",
  "sao lại",
  "sao chưa",
  "vẫn chưa",
  "không được",
  "sai rồi",
  "trả lời sai",
  "trả lời bậy",
  "nhầm rồi",
  "bao nhiêu lần",
  "mấy lần rồi",
  "chán quá",
  "kém quá",
  "tệ quá",
  "dở quá",
  "phàn nàn",
  "khiếu nại",
  "không chấp nhận",
];

/**
 * Phát hiện sentiment bằng keyword matching.
 * Ưu tiên urgent > negative > neutral (urgent quan trọng hơn).
 *
 * @param text Nội dung tin nhắn gốc (chưa normalize)
 * @returns Sentiment phát hiện được
 */
export function detectSentiment(text?: string): Sentiment {
  if (!text || typeof text !== "string") return "neutral";
  const lower = text.toLowerCase();

  // Urgent check trước: gấp + bức xúc cùng lúc thì ưu tiên "gấp"
  if (URGENT_KEYWORDS.some((kw) => lower.includes(kw))) return "urgent";
  if (NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw))) return "negative";

  return "neutral";
}

/**
 * Tạo dòng inject vào system prompt theo sentiment.
 * Trả empty string nếu neutral (không cần inject gì).
 */
export function sentimentPromptLine(sentiment: Sentiment): string {
  switch (sentiment) {
    case "urgent":
      return "⚡ Người dùng có vẻ đang GẤP. Ưu tiên trả lời CHÍNH XÁC và NGẮN GỌN, đi thẳng vào vấn đề, không rào đón.";
    case "negative":
      return "⚠️ Người dùng có vẻ KHÔNG HÀI LÒNG. Cần đặc biệt cẩn trọng, chính xác. Xin lỗi nếu bot đã sai trước đó, không bào chữa.";
    case "neutral":
      return "";
  }
}
