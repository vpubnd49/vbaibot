import { tool } from "ai";
import { z } from "zod";
import { getAdminDivisionData } from "./admin-division-data.js";
import { searchAdminDivisions } from "./admin-division-search.js";

export { getAdminDivisionData } from "./admin-division-data.js";
export type * from "./admin-division-data.js";
export { searchAdminDivisions } from "./admin-division-search.js";

/**
 * Tool tra cứu đơn vị hành chính theo mô hình 2 cấp (Luật 72/2025/QH15)
 */
export function createAdminDivisionLookupTool() {
  // Đảm bảo RAM Cache đã sẵn sàng
  getAdminDivisionData();

  return tool({
    description:
      "Tra cứu đơn vị hành chính 34 tỉnh/thành phố và các xã/phường/đặc khu theo mô hình 02 cấp (Luật Tổ chức chính quyền địa phương 72/2025/QH15). " +
      "BÃI BỎ HOÀN TOÀN CẤP HUYỆN/QUẬN/THỊ XÃ/THỊ TRẤN. Huyện đảo cũ nay chuyển thành Đặc khu trực thuộc tỉnh. " +
      "Hỗ trợ tìm kiếm mờ (Fuzzy search), tiếng Việt không dấu/có dấu, và tra cứu ngược từ tên huyện cũ/tỉnh cũ sang đơn vị hành chính mới.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Tên đơn vị hành chính cần tra cứu (tỉnh, thành phố, xã, phường, đặc khu, hoặc tên huyện cũ, quận cũ, tỉnh cũ trước sáp nhập để tra ngược)",
        ),
    }),
    execute: async ({ query }) => {
      const { provinces, communes } = searchAdminDivisions(query);

      let out = `### 🏛️ Kết quả tra cứu Đơn vị hành chính cho: "${query}"\n\n`;
      out += `> **Mô hình tổ chức:** Chính quyền địa phương 02 cấp (Tỉnh/Thành phố trực thuộc Trung ương ➔ Xã/Phường/Đặc khu). Cấp huyện/quận/thị xã/thị trấn đã chính thức được bãi bỏ theo Luật 72/2025/QH15.\n\n`;

      if (provinces.length === 0 && communes.length === 0) {
        out += `❌ Không tìm thấy đơn vị hành chính nào khớp với từ khóa "${query}".\n`;
        out += `*Gợi ý:* Hãy thử tìm với tên tỉnh mới (vd: Lâm Đồng, Tuyên Quang, Huế), tên xã/phường cụ thể hoặc tên huyện cũ (vd: Tánh Linh, Cát Hải, Vân Đồn, Buôn Đôn).`;
        return out;
      }

      if (provinces.length > 0) {
        out += `#### 🏢 Tỉnh / Thành phố (${provinces.length}):\n`;
        for (const p of provinces) {
          const loai = p.type === "thanh_pho_trung_uong" ? "Thành phố trực thuộc TW" : "Tỉnh";
          out += `- **${p.name}** (Mã: \`${p.code}\`) - *${loai}*\n`;
          if (p.oldNames && p.oldNames.length > 0) {
            out += `  - 🔄 **Sáp nhập từ:** ${p.oldNames.join(", ")}\n`;
          }
          if (p.matchReason && !p.matchReason.startsWith("Tên tỉnh")) {
            out += `  - 🎯 *Khớp theo:* ${p.matchReason}\n`;
          }
        }
        out += "\n";
      }

      const dacKhu = communes.filter((c) => c.type === "dac_khu");
      const xaPhuong = communes.filter((c) => c.type !== "dac_khu");

      if (dacKhu.length > 0) {
        out += `#### 🏝️ Đặc khu trực thuộc Tỉnh/Thành phố (${dacKhu.length}) *(Huyện đảo/Khu kinh tế đặc thù cũ)*:\n`;
        for (const c of dacKhu) {
          out += `- **${c.name}** (Mã: \`${c.code}\`) ➔ Trực thuộc: **${c.provinceName}**\n`;
          if (c.oldDistrict) {
            out += `  - 📍 *Trước sáp nhập:* ${c.oldDistrict}\n`;
          }
          if (c.oldNames && c.oldNames.length > 0) {
            out += `  - 🔄 *Tên cũ:* ${c.oldNames.join(", ")}\n`;
          }
          out += `  - 💡 *Pháp lý:* Nay là Đặc khu trực thuộc trực tiếp ${c.provinceName} (không qua cấp huyện).\n`;
        }
        out += "\n";
      }

      if (xaPhuong.length > 0) {
        out += `#### 🏡 Xã / Phường (${xaPhuong.length}):\n`;
        for (const c of xaPhuong) {
          const cap = c.type === "phuong" ? "Phường" : "Xã";
          out += `- **${c.name}** (Mã: \`${c.code}\`) - *${cap}* ➔ Trực thuộc trực tiếp: **${c.provinceName}**\n`;
          if (c.oldDistrict) {
            out += `  - 📍 *Trước đây thuộc:* ${c.oldDistrict}\n`;
          }
          if (c.oldNames && c.oldNames.length > 0) {
            out += `  - 🔄 *Tên cũ:* ${c.oldNames.join(", ")}\n`;
          }
        }
      }

      return out.trim();
    },
  });
}

// Re-export alias matching tool catalog naming
export const createAdminDivisionTool = createAdminDivisionLookupTool;
