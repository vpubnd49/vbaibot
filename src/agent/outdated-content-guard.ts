/**
 * Post-processing guard: phát hiện nội dung lỗi thời trong câu trả lời của bot.
 *
 * Đây là lớp phòng thủ CUỐI CÙNG trước khi gửi tin nhắn cho user. Dù prompt
 * đã dặn model "không dùng 3 cấp", model vẫn có xác suất bỏ qua rule — đặc
 * biệt khi câu hỏi là bài tập thi và model tự tin từ training data.
 *
 * Khi phát hiện cụm từ lỗi thời → append cảnh báo ⚠️ cuối tin nhắn.
 *
 * Module THUẦN: không env, không DB, không side-effect.
 */

// ───────── Danh sách cụm từ lỗi thời ─────────

/**
 * Mỗi entry gồm pattern (regex hoặc string) và nhóm (để log/debug).
 * Regex dùng word boundary `\b` khi cần tránh false positive.
 */
type OutdatedPattern = {
  /** Regex khớp cụm từ lỗi thời. Flag `i` để case-insensitive. */
  pattern: RegExp;
  /** Nhóm phân loại để log */
  group: "cap_huyen" | "so_cu_lamdong";
  /** Mô tả ngắn */
  label: string;
};

const PATTERNS: OutdatedPattern[] = [
  // ── Chính quyền 3 cấp / cấp huyện ──
  { pattern: /chi cục (?:thi hành án dân sự|thads) cấp huyện/i, group: "cap_huyen", label: "Chi cục THADS cấp huyện" },
  { pattern: /phòng tư pháp (?:cấp )?huyện/i, group: "cap_huyen", label: "Phòng Tư pháp cấp huyện" },
  { pattern: /công an (?:cấp )?huyện/i, group: "cap_huyen", label: "Công an cấp huyện" },
  { pattern: /(?:ubnd|ủy ban nhân dân) (?:cấp )?huyện/i, group: "cap_huyen", label: "UBND cấp huyện" },
  { pattern: /(?:ubnd|ủy ban nhân dân) (?:cấp )?quận/i, group: "cap_huyen", label: "UBND cấp quận" },
  { pattern: /chính quyền (?:03|3|ba) cấp/i, group: "cap_huyen", label: "chính quyền 3 cấp" },
  { pattern: /(?:03|3|ba) cấp chính quyền/i, group: "cap_huyen", label: "3 cấp chính quyền" },
  { pattern: /tỉnh[\s–\-]+huyện[\s–\-]+xã/i, group: "cap_huyen", label: "tỉnh-huyện-xã" },
  // ── Sở cũ Lâm Đồng (đã hợp nhất từ 01/03/2025) ──
  { pattern: /sở nông nghiệp và phát triển nông thôn/i, group: "so_cu_lamdong", label: "Sở NN&PTNT (cũ)" },
  { pattern: /sở tài nguyên và môi trường/i, group: "so_cu_lamdong", label: "Sở TN&MT (cũ)" },
  { pattern: /sở kế hoạch và đầu tư/i, group: "so_cu_lamdong", label: "Sở KH&ĐT (cũ)" },
  { pattern: /sở giao thông vận tải/i, group: "so_cu_lamdong", label: "Sở GTVT (cũ)" },
  { pattern: /sở lao động[\s–\-]*thương binh/i, group: "so_cu_lamdong", label: "Sở LĐ-TB&XH (cũ)" },
  { pattern: /sở thông tin và truyền thông/i, group: "so_cu_lamdong", label: "Sở TT&TT (cũ)" },
  { pattern: /ban dân tộc tỉnh/i, group: "so_cu_lamdong", label: "Ban Dân tộc tỉnh (cũ)" },
];

// ───────── Ngoại lệ: context so sánh cũ/mới ─────────

/**
 * Khi text chứa các cụm từ gợi ý user yêu cầu SO SÁNH hoặc nói về TRƯỚC ĐÂY,
 * thì cụm từ lỗi thời được phép xuất hiện → KHÔNG append cảnh báo.
 */
const EXCEPTION_PATTERNS = [
  /so sánh.{0,30}(?:cũ|mới|trước|sau)/i,
  /trước (?:đây|kia|khi)/i,
  /(?:trước|cũ) là/i,
  /(?:đã|được) (?:thay thế|hợp nhất|sáp nhập|bãi bỏ|xóa bỏ)/i,
  /(?:theo|trước).{0,20}(?:luật cũ|quy định cũ)/i,
  /mô hình cũ/i,
];

function isComparisonContext(text: string): boolean {
  return EXCEPTION_PATTERNS.some((re) => re.test(text));
}

// ───────── Hàm chính ─────────

export type OutdatedDetection = {
  /** Có phát hiện nội dung lỗi thời không */
  found: boolean;
  /** Danh sách cụm từ phát hiện (để log) */
  matches: string[];
  /** Nhóm phát hiện */
  groups: Set<string>;
};

const CANH_BAO_CAP_HUYEN =
  "\n\n⚠️ **Lưu ý:** Nội dung trên có thể chưa cập nhật. Hiện nay cả nước áp dụng mô hình chính quyền **02 cấp** (Luật 72/2025/QH15) — không còn cấp huyện/quận. Anh/chị nên kiểm tra lại với quy định hiện hành.";

const CANH_BAO_SO_CU =
  "\n\n⚠️ **Lưu ý:** Nội dung trên nhắc đến tên Sở cũ đã hợp nhất từ 01/03/2025 theo Nghị quyết HĐND tỉnh Lâm Đồng. Anh/chị nên dùng tên Sở mới cho chính xác.";

/**
 * Scan text tìm cụm từ lỗi thời.
 */
export function detectOutdatedContent(text: string): OutdatedDetection {
  if (!text || text.length < 10) return { found: false, matches: [], groups: new Set() };

  // Ngoại lệ: context so sánh cũ/mới → cho phép
  if (isComparisonContext(text)) return { found: false, matches: [], groups: new Set() };

  const matches: string[] = [];
  const groups = new Set<string>();

  for (const { pattern, group, label } of PATTERNS) {
    if (pattern.test(text)) {
      matches.push(label);
      groups.add(group);
    }
  }

  return { found: matches.length > 0, matches, groups };
}

/**
 * Guard chính: scan text → append cảnh báo nếu phát hiện nội dung lỗi thời.
 * Trả về text đã xử lý (có hoặc không có cảnh báo).
 */
export function guardOutdatedContent(text: string): string {
  const detection = detectOutdatedContent(text);
  if (!detection.found) return text;

  const warnings: string[] = [];
  if (detection.groups.has("cap_huyen")) warnings.push(CANH_BAO_CAP_HUYEN);
  if (detection.groups.has("so_cu_lamdong")) warnings.push(CANH_BAO_SO_CU);

  return text + warnings.join("");
}
