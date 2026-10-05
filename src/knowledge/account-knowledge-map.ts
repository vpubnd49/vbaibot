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
  // Sở Công Thương: nhận cả tri thức Nội chính (chung) + Công Thương (riêng)
  [ACC_CONG_THUONG, [LEGAL_WORKFLOW_PROMPT, CONG_THUONG_KNOWLEDGE_PROMPT]],

  // ── Châu Phiên Bản Số ─────────────────────────────────────────────────
  // Bot chính: nhận Nội chính + Công Thương (đọc được tri thức cả hai ngành)
  [ACC_CHAU_PBS, [LEGAL_WORKFLOW_PROMPT, CONG_THUONG_KNOWLEDGE_PROMPT]],

  // ── P-Bot ─────────────────────────────────────────────────────────────
  // Bot tiện ích chung: không nhận tri thức chuyên ngành — chỉ BASE_PERSONA
  // Nếu sau này P-Bot cần tri thức riêng, thêm entry ở đây.
  // [ACC_P_BOT, []],
]);

/**
 * Trả về danh sách prompt tri thức cần inject cho account.
 * Trả mảng rỗng nếu account không có mapping hoặc tool tạo VB không bật.
 *
 * @param accountId - ID account Zalo
 * @param hasAdminDocTool - true nếu account có tool create_admin_document bật
 */
export function getAccountKnowledge(accountId: string, hasAdminDocTool: boolean): readonly string[] {
  // Tri thức chuyên ngành chỉ có ý nghĩa khi account có tool soạn VB hành chính.
  // Inject vào account không có tool = dạy model kiến thức nó không dùng được,
  // lãng phí token và gây nhiễu.
  if (!hasAdminDocTool) return [];
  return ACCOUNT_KNOWLEDGE_MAP.get(accountId) ?? [];
}
