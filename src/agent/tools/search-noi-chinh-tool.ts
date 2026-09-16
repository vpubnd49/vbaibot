import { tool } from "ai";
import { z } from "zod";
import { searchCorpus, corpusStats } from "../../knowledge/noi-chinh-corpus-search.js";

/**
 * Tool tra cứu kho 3.327 văn bản NỘI CHÍNH thật đã ban hành.
 * Agent gọi tool này khi cần tìm mẫu tham khảo để soạn thảo.
 */
export function createSearchNoiChinhTool() {
  return tool({
    description:
      "Tra cứu kho 3.327 mẫu văn bản Nội chính thật (ủy quyền, tờ trình, công văn, quyết định, " +
      "kế hoạch, báo cáo, đơn xin vắng mặt, kiện toàn BCĐ, nghỉ hưu...) để tham khảo cấu trúc " +
      "và nội dung khi soạn thảo văn bản mới. GỌI TOOL NÀY TRƯỚC khi tạo file, để lấy mẫu chính xác.",
    inputSchema: z.object({
      keywords: z
        .string()
        .min(2)
        .describe(
          "Từ khóa tìm kiếm, ví dụ: 'ủy quyền vụ án hành chính', 'kiện toàn ban chỉ đạo', " +
          "'cung cấp hồ sơ tòa án', 'nghỉ hưu trước tuổi', 'phê duyệt điều lệ hội', " +
          "'đơn xin vắng mặt', 'chuyển công văn bộ nội vụ'",
        ),
      category: z
        .string()
        .optional()
        .describe(
          "Lọc theo thư mục (tùy chọn): 'Tòa án, Tố tụng', 'CÁC HỘI', 'THANH TRA', 'TƯ PHÁP', " +
          "'CẢI CÁCH THỦ TỤC HÀNH CHÍNH', 'QUYẾT ĐỊNH TỔ CHỨC BỘ MÁY', 'GIAO', 'CHUYỂN', " +
          "'Công an tỉnh', 'Nghỉ hưu', 'Phụ cấp nâng lương', 'BCS', 'Đảng ủy Ủy ban'",
        ),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(3)
        .describe("Số kết quả tối đa (1-10, mặc định 3)"),
    }),
    execute: async ({ keywords, category, maxResults }) => {
      const results = searchCorpus(keywords, {
        category,
        maxResults: maxResults ?? 3,
      });

      if (results.length === 0) {
        const stats = corpusStats();
        const catList = stats
          .slice(0, 15)
          .map((s) => `  - ${s.category} (${s.count} file)`)
          .join("\n");
        return `Không tìm thấy mẫu nào khớp "${keywords}".\n\nCác thư mục có sẵn:\n${catList}`;
      }

      const parts: string[] = [];
      parts.push(`Tìm thấy ${results.length} mẫu văn bản khớp "${keywords}":\n`);

      for (let i = 0; i < results.length; i++) {
        const r = results[i]!;
        parts.push(`===== MẪU ${i + 1}/${results.length} =====`);
        parts.push(`📁 Thư mục: ${r.category}`);
        parts.push(`📄 File: ${r.filename}`);
        parts.push(`📍 Đường dẫn: ${r.path}`);
        parts.push(`\n--- NỘI DUNG ---\n${r.text}\n`);
      }

      parts.push(
        "\n💡 Sử dụng nội dung trên làm mẫu tham khảo để soạn thảo văn bản mới " +
        "bằng tool create_admin_document. Giữ đúng cấu trúc, thay thế thông tin cụ thể.",
      );

      return parts.join("\n");
    },
  });
}
