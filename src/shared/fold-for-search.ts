/**
 * Gấp chuỗi về dạng dễ so khớp: thường hóa + bỏ dấu tiếng Việt.
 * Dùng cho so khớp tìm kiếm và nhận diện gọi bot khi người dùng gõ không dấu / chữ thường / không có ký tự @.
 */

/** Dấu tổ hợp Unicode: đủ cho mọi thanh điệu và dấu mũ/móc tiếng Việt */
const DAU_TO_HOP = /[\u0300-\u036f]/g;

export function foldForSearch(input: string): string {
  return input
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(DAU_TO_HOP, "")
    .toLowerCase()
    .trim();
}

/**
 * Kiểm tra xem nội dung tin nhắn có đang gọi / nhắc đến bot hay không.
 * Hỗ trợ:
 * - Có @ hoặc không có @
 * - Có dấu hoặc không dấu ("ANH CHAU", "A CHAU", "a chau", "anh chau", "Châu Phiên Bản Số", "chau phien ban so")
 * - Các cách xưng hô tự nhiên ("anh chau", "a chau", "chi chau", "c chau", "ban chau", "chau oi", "nho chau", "@bot")
 */
export function isMentioningBot(text: string, label: string): boolean {
  if (!text || !label) return false;
  const foldedText = foldForSearch(text);
  const foldedLabel = foldForSearch(label);
  if (!foldedLabel) return false;

  // 1. Khớp trọn vẹn tên đầy đủ có @ hoặc không @ (ví dụ: "@chau phien ban so", "chau phien ban so")
  if (foldedText.includes(`@${foldedLabel}`) || foldedText.includes(foldedLabel)) {
    return true;
  }

  // 2. Khớp tên viết liền hoặc gạch dưới (ví dụ: "@chauphienbanso", "chauphienbanso", "@chau_phien_ban_so")
  const compactLabel = foldedLabel.replace(/\s+/g, "");
  if (compactLabel && (foldedText.includes(`@${compactLabel}`) || (compactLabel.length >= 6 && foldedText.includes(compactLabel)))) {
    return true;
  }
  const underscoreLabel = foldedLabel.replace(/\s+/g, "_");
  if (underscoreLabel && (foldedText.includes(`@${underscoreLabel}`) || foldedText.includes(underscoreLabel))) {
    return true;
  }

  // 3. Khớp theo từ đầu tiên (tên gọi chính, ví dụ: "chau" trong "Châu Phiên Bản Số")
  const firstWord = foldedLabel.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 2) {
    // Có @ đi kèm tên hoặc tiền tố xưng hô (ví dụ: "@chau", "@anh chau", "@a chau", "@Châu")
    const atRegex = new RegExp(`@(?:anh\\s+|a\\s+|chi\\s+|c\\s+|ban\\s+|em\\s+)?${firstWord}(?:\\b|\\s|[.,!?:;]|$)`, "i");
    if (atRegex.test(foldedText)) return true;

    // Không cần @ nhưng có xưng hô rõ ràng:
    // "anh chau", "a chau", "chi chau", "c chau", "ban chau", "em chau"
    const addressRegex = new RegExp(`(?:\\b|^)(?:anh|a|chi|c|ban|em)\\s+${firstWord}(?:\\b|$|[.,!?:;\\s])`, "i");
    if (addressRegex.test(foldedText)) return true;

    // Gọi trực tiếp kèm hành động: "chau oi", "chau xem", "chau doc", "chau giup", "chau cho y kien", "nho chau", "hoi chau"
    const actionRegex = new RegExp(
      `(?:\\b|^)(?:nho|hoi|bao|goi|nhap|tag)\\s+${firstWord}(?:\\b|$|[.,!?:;\\s])|` +
      `(?:\\b|^)${firstWord}\\s+(?:oi|xem|doc|giup|cho|tra|kiem|gui|nhan|nghe|tra loi|phan hoi|nhe|ạ|a)(?:\\b|$|[.,!?:;\\s])`,
      "i"
    );
    if (actionRegex.test(foldedText)) return true;

    // Nếu tin nhắn chỉ gồm đúng tên bot (ví dụ: "chau", "Châu", "CHAU")
    if (foldedText === firstWord) return true;
  }

  // 4. Khớp @bot (có ký tự @)
  if (/@bot(?:\b|\s|[.,!?:;]|$)/i.test(foldedText)) {
    return true;
  }

  return false;
}
