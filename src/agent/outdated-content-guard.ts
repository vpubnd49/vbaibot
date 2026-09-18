/**
 * Post-processing guard: phát hiện VÀ SỬA nội dung lỗi thời trong câu trả lời
 * của bot và nội dung file xuất ra.
 *
 * Đây là lớp phòng thủ CUỐI CÙNG trước khi gửi tin nhắn/file cho user. Dù
 * prompt đã dặn model "không dùng 3 cấp" và "không dùng tên Sở cũ", model vẫn
 * có xác suất bỏ qua rule — đặc biệt khi tự soạn kế hoạch/công văn từ training
 * data (case thực tế: bot soạn KH Festival Hoa dùng "Sở Lao động Thương binh").
 *
 * Hai chức năng chính:
 * 1. `guardOutdatedContent`: scan text → THAY THẾ tên Sở cũ → append cảnh báo ⚠️
 * 2. `replaceOutdatedOrgNames`: deep-replace tên Sở cũ trong struct (tool args)
 *    TRƯỚC khi render docx — chặn ngay tại nguồn, không chờ đến text reply.
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
  { pattern: /sở lao động[\s,–\-]*thương binh(?:\s+và\s+xã\s+hội)?/i, group: "so_cu_lamdong", label: "Sở LĐ-TB&XH (cũ)" },
  { pattern: /sở thông tin và truyền thông/i, group: "so_cu_lamdong", label: "Sở TT&TT (cũ)" },
  { pattern: /ban dân tộc(?:\s+tỉnh)?/i, group: "so_cu_lamdong", label: "Ban Dân tộc tỉnh (cũ)" },
];

// ───────── Bảng thay thế tên Sở cũ → mới ─────────

/**
 * Ánh xạ tên đầy đủ Sở cũ → Sở mới (Lâm Đồng, có hiệu lực từ 01/03/2025).
 *
 * QUAN TRỌNG: pattern phải dùng flag `gi` (global) để thay THẾ TẤT CẢ lần xuất
 * hiện, không chỉ lần đầu. Regex cần bao quát cả biến thể dấu gạch (–, -, ,).
 *
 * Thứ tự: regex dài (cụ thể) trước, ngắn (tổng quát) sau — tránh regex ngắn
 * ăn trước rồi regex dài không còn gì để khớp.
 */
type OrgReplacement = { pattern: RegExp; replacement: string };

const ORG_REPLACEMENTS: OrgReplacement[] = [
  // "Sở Nông nghiệp và Phát triển nông thôn" → "Sở Nông nghiệp và Môi trường"
  { pattern: /Sở Nông nghiệp và Phát triển nông thôn/gi, replacement: "Sở Nông nghiệp và Môi trường" },
  // "Sở Tài nguyên và Môi trường" → "Sở Nông nghiệp và Môi trường"
  { pattern: /Sở Tài nguyên và Môi trường/gi, replacement: "Sở Nông nghiệp và Môi trường" },
  // "Sở Kế hoạch và Đầu tư" → "Sở Tài chính"
  { pattern: /Sở Kế hoạch và Đầu tư/gi, replacement: "Sở Tài chính" },
  // "Sở Giao thông vận tải" → "Sở Xây dựng"
  { pattern: /Sở Giao thông [Vv]ận tải/gi, replacement: "Sở Xây dựng" },
  // "Sở Lao động - Thương binh và Xã hội" (các biến thể dấu gạch)
  { pattern: /Sở Lao động[\s,–\-]*Thương binh(?:\s+và\s+Xã\s+hội)?/gi, replacement: "Sở Nội vụ" },
  // "Sở Thông tin và Truyền thông" → "Sở Khoa học và Công nghệ"
  { pattern: /Sở Thông tin và Truyền thông/gi, replacement: "Sở Khoa học và Công nghệ" },
  // "Ban Dân tộc tỉnh" / "Ban Dân tộc" → "Sở Dân tộc và Tôn giáo"
  { pattern: /Ban Dân tộc(?:\s+tỉnh)?/gi, replacement: "Sở Dân tộc và Tôn giáo" },
];

// ───────── Ngoại lệ: context so sánh cũ/mới ─────────

/**
 * Khi text chứa các cụm từ gợi ý user yêu cầu SO SÁNH hoặc nói về TRƯỚC ĐÂY,
 * thì cụm từ lỗi thời được phép xuất hiện → KHÔNG thay thế, KHÔNG cảnh báo.
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

// ───────── Thay thế tên Sở cũ → mới ─────────

/**
 * Thay thế tên Sở cũ trong text → tên Sở mới.
 *
 * Dùng cho nội dung bot TỰ SOẠN (text reply, tool args). KHÔNG dùng cho văn
 * bản gốc user gửi — văn bản gốc chỉ cảnh báo, không sửa.
 *
 * Tôn trọng ngoại lệ so sánh cũ/mới: nếu context là so sánh thì giữ nguyên.
 */
export function replaceOutdatedOrgNamesInText(text: string): string {
  if (!text || text.length < 10) return text;
  if (isComparisonContext(text)) return text;

  let result = text;
  for (const { pattern, replacement } of ORG_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Deep-replace tên Sở cũ trong toàn bộ struct (AdminDocument, DocumentBlock[]).
 *
 * Dùng tại tool `create_admin_document` / `create_word_document` TRƯỚC khi
 * render docx — chặn tên Sở cũ ngay tại nguồn, không chờ đến text reply.
 *
 * Cơ chế: JSON.stringify → replace trên chuỗi → JSON.parse. An toàn vì
 * regex chỉ khớp tên tiếng Việt có dấu, không khớp key JSON hay cú pháp.
 */
export function replaceOutdatedOrgNames<T>(data: T): T {
  const json = JSON.stringify(data);
  const replaced = replaceOutdatedOrgNamesInText(json);
  if (replaced === json) return data; // Không đổi gì → trả lại ref gốc, tiết kiệm alloc
  return JSON.parse(replaced) as T;
}

// ───────── Phát hiện nội dung lỗi thời ─────────

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
  "\n\n⚠️ **Lưu ý:** Nội dung trên nhắc đến tên Sở cũ đã hợp nhất từ 01/03/2025 theo Nghị quyết HĐND tỉnh Lâm Đồng. Em đã tự động sửa sang tên Sở mới, anh/chị kiểm tra lại cho chính xác nhé.";

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
 * Guard chính: scan text → THAY THẾ tên Sở cũ → append cảnh báo nếu còn lỗi
 * thời không thay thế được (VD cấp huyện).
 *
 * Luồng xử lý:
 * 1. Thay thế tên Sở cũ → mới (nhóm so_cu_lamdong)
 * 2. Detect lại trên text đã thay — nếu vẫn còn (cấp huyện) thì append ⚠️
 * 3. Nếu bước 1 có thay đổi → append thêm ⚠️ nhẹ nhắc user kiểm tra
 */
export function guardOutdatedContent(text: string): string {
  if (isComparisonContext(text)) return text;

  // Bước 1: thay thế tên Sở cũ
  const replaced = replaceOutdatedOrgNamesInText(text);
  const didReplace = replaced !== text;

  // Bước 2: detect trên text đã thay thế (bắt cấp huyện + bất kỳ Sở cũ nào lọt lưới)
  const detection = detectOutdatedContent(replaced);

  const warnings: string[] = [];
  if (detection.found && detection.groups.has("cap_huyen")) {
    warnings.push(CANH_BAO_CAP_HUYEN);
  }
  if ((detection.found && detection.groups.has("so_cu_lamdong")) || didReplace) {
    warnings.push(CANH_BAO_SO_CU);
  }

  return replaced + warnings.join("");
}
