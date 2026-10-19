/**
 * account-knowledge-map.ts
 *
 * Bảng ánh xạ tập trung: account Zalo → tri thức chuyên ngành inject vào prompt.
 *
 * MỤC ĐÍCH:
 * - Một nguồn sự thật duy nhất cho việc "account nào nhận tri thức gì"
 * - Dễ bảo trì: thêm account/tri thức mới chỉ sửa file NÀY
 * - Tách biệt khỏi logic dựng prompt (persona-prompt.ts)
 *
 * KIẾN TRÚC:
 * Mỗi account có thể nhận NHIỀU khối tri thức (layers). Thứ tự trong mảng là
 * thứ tự inject vào system prompt — tri thức chung trước, chuyên ngành sau.
 *
 * KHI THÊM ACCOUNT MỚI:
 * 1. Thêm entry mới vào ACCOUNT_KNOWLEDGE_MAP
 * 2. Import khối tri thức tương ứng (nếu chưa có, tạo trong src/knowledge/)
 * 3. Chạy test: pnpm test
 */

import { LEGAL_WORKFLOW_PROMPT } from "../knowledge/noi-chinh-templates.js";
import { CONG_THUONG_KNOWLEDGE_PROMPT } from "../knowledge/cong-thuong-templates.js";
import { LEGALKIT_KNOWLEDGE_PROMPT } from "../knowledge/legalkit-templates.js";
import { FINANCE_KNOWLEDGE_PROMPT } from "../knowledge/finance-knowledge.js";

// ─── Account IDs ────────────────────────────────────────────────────────────
// Khai báo hằng số để tránh typo khi dùng nhiều chỗ

/** Sở Công Thương Phiên Bản Số */
export const ACC_CONG_THUONG = "acc-0818000827";

/** P-Bot — bot tiện ích chung */
export const ACC_P_BOT = "acc-0924343838";

/** Châu Phiên Bản Số — bot chính (Nội chính + đa năng) */
export const ACC_CHAU_PBS = "acc-0984310011";

// ─── Tri thức registry ──────────────────────────────────────────────────────

/**
 * Bảng ánh xạ account → danh sách prompt tri thức chuyên ngành.
 *
 * - Key: account ID (chuỗi "acc-...")
 * - Value: mảng string prompt — inject ĐÚNG THỨ TỰ vào system prompt
 *
 * Account KHÔNG có trong bảng: không nhận tri thức chuyên ngành nào
 * (vẫn nhận BASE_PERSONA + tool rules bình thường).
 */
export const ACCOUNT_KNOWLEDGE_MAP: ReadonlyMap<string, readonly string[]> = new Map([
  // ── Công Thương Phiên Bản Số ──────────────────────────────────────────
  // Sở Công Thương: nhận tri thức Nội chính (chung) + Công Thương (riêng) + LegalKit (hợp đồng, pháp luật) + Tài chính - Kế toán - Thuế
  [ACC_CONG_THUONG, [LEGAL_WORKFLOW_PROMPT, CONG_THUONG_KNOWLEDGE_PROMPT, LEGALKIT_KNOWLEDGE_PROMPT, FINANCE_KNOWLEDGE_PROMPT]],

  // ── Châu Phiên Bản Số ─────────────────────────────────────────────────
  // Bot chính: nhận Nội chính + Công Thương + LegalKit (tư vấn luật, án lệ, 20 mẫu hợp đồng) + Tài chính - Kế toán - Ngân hàng - Thuế
  [ACC_CHAU_PBS, [LEGAL_WORKFLOW_PROMPT, CONG_THUONG_KNOWLEDGE_PROMPT, LEGALKIT_KNOWLEDGE_PROMPT, FINANCE_KNOWLEDGE_PROMPT]],

  // ── P-Bot ─────────────────────────────────────────────────────────────
  // Bot tiện ích chung: không nhận tri thức chuyên ngành — chỉ BASE_PERSONA
  // Nếu sau này P-Bot cần tri thức riêng, thêm entry ở đây.
  // [ACC_P_BOT, []],
]);

const NOI_CHINH_TRIGGER_RE =
  /(?:công\s+văn|tờ\s+trình|quyết\s+định|nghị\s+quyết|báo\s+cáo|kế\s+hoạch|thông\s+báo|giấy\s+mời|biên\s+bản|quy\s+chế|quy\s+định|hướng\s+dẫn|chương\s+trình|chỉ\s+thị|kết\s+luận|thông\s+tri|văn\s+bản|soạn|dự\s+thảo|trình\s+ký|rà\s+soát|nghị\s+định\s*30|nđ\s*30|hd\s*05|hướng\s+dẫn\s*05|nội\s+chính|ubnd|hđnd|tỉnh\s+ủy|đảng\s+ủy|thanh\s+tra|khiếu\s+nại|tố\s+cáo|tiếp\s+công\s+dân|phòng\s+chống\s+tham\s+nhũng|cải\s+cách\s+hành\s+chính|cchc|par\s*index|sipas|papi|pci)/i;

const CONG_THUONG_TRIGGER_RE =
  /(?:công\s+thương|sct|sở\s+công\s+thương|thương\s+mại|công\s+nghiệp|năng\s+lượng|điện\s+lực|thủy\s+điện|điện\s+mặt\s+trời|xăng\s+dầu|hóa\s+chất|vật\s+liệu\s+nổ|khuyến\s+công|xúc\s+tiến|thị\s+trường|quản\s+lý\s+thị\s+trường|xuất\s+nhập\s+khẩu|xnk|hải\s+quan|thông\s+quan|mã\s+hs|c\/o|xuất\s+xứ|biên\s+mậu|an\s+toàn\s+thực\s+phẩm|cụm\s+công\s+nghiệp)/i;

const LEGALKIT_TRIGGER_RE =
  /(?:hợp\s+đồng|thỏa\s+thuận|biên\s+bản\s+ghi\s+nhớ|mou|nda|bảo\s+mật|ủy\s+quyền|đặt\s+cọc|thuê\s+nhà|thuê\s+mặt\s+bằng|mua\s+bán|dịch\s+vụ|lao\s+động|thử\s+việc|vay\s+tiền|tranh\s+chấp|khởi\s+kiện|bị\s+kiện|bồi\s+thường|phạt\s+vi\s+phạm|bộ\s+luật\s+dân\s+sự|blds|luật\s+thương\s+mại|án\s+lệ|tư\s+vấn\s+luật|điều\s+khoản)/i;

const FINANCE_TRIGGER_RE =
  /(?:thuế|vat|gtgt|tndn|tncn|giảm\s+trừ|gia\s+cảnh|người\s+phụ\s+thuộc|lương\s+gross|lương\s+net|quyết\s+toán|hóa\s+đơn|hđđt|kế\s+toán|hạch\s+toán|định\s+khoản|nợ\s+có|bút\s+toán|bảng\s+cân\s+đối|báo\s+cáo\s+tài\s+chính|bctc|sổ\s+cái|khấu\s+hao|thông\s+tư\s*99|thông\s+tư\s*200|thông\s+tư\s*133|ngân\s+hàng|tín\s+dụng|lãi\s+vay|lãi\s+suất|sao\s+kê|rửa\s+tiền|aml|dscr|dòng\s+tiền|vốn\s+lưu\s+động|npv|irr|wacc|dcf|ebitda|ngân\s+sách)/i;

const CORE_DOMAIN_INDEX_PROMPT = `
## TÓM TẮT NĂNG LỰC CHUYÊN NGÀNH CỦA HỆ THỐNG (KÍCH HOẠT TỰ ĐỘNG THEO YÊU CẦU)
- **Hành chính & Nội chính (NĐ 30/2020/NĐ-CP & HD 05-HD/VPTW)**: Soạn thảo và rà soát chuyên sâu tất cả các loại văn bản hành chính nhà nước và văn bản Đảng bằng công cụ \`create_admin_document\` và \`review_admin_document\`.
- **Công Thương & Hải quan**: Nắm vững 8 phòng chuyên môn Sở Công Thương tỉnh Lâm Đồng và kho 580+ văn bản hướng dẫn nghiệp vụ Hải quan / Xuất nhập khẩu (2025–2026).
- **Pháp lý & Hợp đồng (LegalKit VN)**: Tra cứu VBQPPL Trung ương (\`national_legal\`) & Lâm Đồng (\`qppl_lamdong\`, \`thanhtra_lamdong\`), tư vấn giải quyết tranh chấp và soạn thảo 20 mẫu hợp đồng chuẩn bằng \`create_word_document\`.
- **Tài chính - Kế toán - Ngân hàng - Thuế (Khung 2026)**: Tính thuế TNCN theo Luật 109/2025/QH15 (giảm trừ 15,5 tr / 6,2 tr, biểu 5 bậc), miễn/giảm thuế TNDN (NĐ 141/2026, NQ 43/2026), khấu trừ VAT trả chậm (NĐ 144/2026), hóa đơn điện tử (NĐ 254/2026), kế toán doanh nghiệp (TT 99/2025/TT-BTC thay thế TT 200), tín dụng ngân hàng (TT 29/2026/TT-NHNN) bằng công cụ \`tax_accounting_lookup\`.
`.trim();

/**
 * Trả về danh sách prompt tri thức cần inject cho account.
 * Trả mảng rỗng nếu account không có mapping hoặc tool tạo VB không bật.
 *
 * Khi `contextText` được truyền vào (từ `buildSystemPrompt`), hàm chỉ nạp các khối
 * tri thức khổng lồ (61 KB / 53 KB / 17 KB / 9.5 KB) khớp với ngữ cảnh câu hỏi,
 * giúp tiết kiệm ~75-85% token System Prompt ở các lượt trò chuyện thông thường.
 * Khi không truyền `contextText`, hàm trả về đầy đủ mảng trong `ACCOUNT_KNOWLEDGE_MAP`.
 *
 * @param accountId - ID account Zalo
 * @param hasAdminDocTool - true nếu account có tool create_admin_document bật
 * @param contextText - Nội dung tin nhắn/ngữ cảnh hiện tại để lọc tri thức động (tùy chọn)
 */
export function getAccountKnowledge(
  accountId: string,
  hasAdminDocTool: boolean,
  contextText?: string,
): readonly string[] {
  if (!hasAdminDocTool) return [];
  const allLayers = ACCOUNT_KNOWLEDGE_MAP.get(accountId);
  if (!allLayers || allLayers.length === 0) return [];

  // Giữ tương thích ngược 100% khi gọi không kèm contextText
  if (contextText === undefined) {
    return allLayers;
  }

  const q = contextText.trim();
  if (!q) {
    return [CORE_DOMAIN_INDEX_PROMPT];
  }

  const selected: string[] = [];
  const needNoiChinh = NOI_CHINH_TRIGGER_RE.test(q);
  const needCongThuong =
    CONG_THUONG_TRIGGER_RE.test(q) || (accountId === ACC_CONG_THUONG && needNoiChinh);
  const needLegalKit = LEGALKIT_TRIGGER_RE.test(q);
  const needFinance = FINANCE_TRIGGER_RE.test(q);

  for (const layer of allLayers) {
    if (layer === LEGAL_WORKFLOW_PROMPT && needNoiChinh) {
      selected.push(layer);
    } else if (layer === CONG_THUONG_KNOWLEDGE_PROMPT && needCongThuong) {
      selected.push(layer);
    } else if (layer === LEGALKIT_KNOWLEDGE_PROMPT && needLegalKit) {
      selected.push(layer);
    } else if (layer === FINANCE_KNOWLEDGE_PROMPT && needFinance) {
      selected.push(layer);
    }
  }

  if (selected.length === 0) {
    return [CORE_DOMAIN_INDEX_PROMPT];
  }

  return selected;
}
