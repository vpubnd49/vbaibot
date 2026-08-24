import fs from "node:fs";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { normalizeVietnamese } from "../../domain/normalize-vietnamese.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("admin-division-lookup");

export type Commune = {
  code: string;
  name: string;
  type: "xa" | "phuong" | "dac_khu" | string;
  oldDistrict?: string;
  oldNames?: string[];
};

export type Province = {
  code: string;
  name: string;
  type: "thanh_pho_trung_uong" | "tinh" | string;
  oldNames?: string[];
  communes: Commune[];
};

export type AdministrativeData = {
  metadata: {
    source?: string;
    updated?: string;
    totalProvinces?: number;
    totalCommunes?: number;
    model?: string;
    legalBasis?: string[];
  };
  provinces: Province[];
};

export type SearchResultCommune = Commune & {
  provinceName: string;
  provinceCode: string;
  matchScore: number;
  matchReason: string;
};

export type SearchResultProvince = Province & {
  matchScore: number;
  matchReason: string;
};

export type AdminSearchResult = {
  provinces: SearchResultProvince[];
  communes: SearchResultCommune[];
};

/**
 * Bộ nhớ tạm (RAM Cache) lưu toàn bộ danh mục đơn vị hành chính sau khi nạp từ JSON.
 */
let cachedAdminData: AdministrativeData | null = null;

function resolveDataFilePath(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), "data/administrative_divisions.json"),
    path.resolve(process.cwd(), "src/legal/data/administrative-divisions-2025.json"),
    path.resolve(import.meta.dirname, "../../../data/administrative_divisions.json"),
    path.resolve(import.meta.dirname, "../../legal/data/administrative-divisions-2025.json"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return possiblePaths[0]!;
}

/**
 * Nạp dữ liệu vào RAM Cache khi khởi động hoặc truy cập lần đầu.
 */
export function getAdminDivisionData(): AdministrativeData {
  if (cachedAdminData) {
    return cachedAdminData;
  }

  const filePath = resolveDataFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      cachedAdminData = JSON.parse(raw) as AdministrativeData;
      log.info(
        {
          filePath,
          totalProvinces: cachedAdminData.provinces?.length ?? 0,
        },
        "Đã nạp danh mục đơn vị hành chính 34 tỉnh vào RAM Cache thành công",
      );
      return cachedAdminData;
    }
  } catch (error) {
    log.error({ error, filePath }, "Lỗi khi đọc file administrative_divisions.json");
  }

  cachedAdminData = { metadata: {}, provinces: [] };
  return cachedAdminData;
}

/**
 * Tính điểm khớp tương đồng (Fuzzy / Token matching)
 */
function calculateMatchScore(queryNorm: string, targetNorm: string): number {
  if (!queryNorm || !targetNorm) return 0;
  if (queryNorm === targetNorm) return 100;
  if (targetNorm.includes(queryNorm)) return 80;
  if (queryNorm.includes(targetNorm)) return 70;

  const queryTokens = queryNorm.split(/\s+/).filter(Boolean);
  const targetTokens = targetNorm.split(/\s+/).filter(Boolean);

  let matchedTokens = 0;
  for (const qt of queryTokens) {
    if (targetTokens.some((tt) => tt === qt || tt.includes(qt) || qt.includes(tt))) {
      matchedTokens++;
    }
  }

  if (queryTokens.length > 0) {
    const tokenScore = (matchedTokens / queryTokens.length) * 60;
    return tokenScore >= 30 ? tokenScore : 0;
  }

  return 0;
}

/**
 * Tìm kiếm mờ (Fuzzy search) đơn vị hành chính với chuẩn hóa tiếng Việt có dấu và không dấu.
 */
export function searchAdminDivisions(query: string): AdminSearchResult {
  const data = getAdminDivisionData();
  if (!query || !data.provinces) {
    return { provinces: [], communes: [] };
  }

  const queryRaw = query.trim().toLowerCase();
  const queryNorm = normalizeVietnamese(queryRaw);

  const matchedProvinces: SearchResultProvince[] = [];
  const matchedCommunes: SearchResultCommune[] = [];

  for (const province of data.provinces) {
    const provNameRaw = province.name.toLowerCase();
    const provNameNorm = normalizeVietnamese(province.name);

    let provScore = Math.max(
      calculateMatchScore(queryRaw, provNameRaw),
      calculateMatchScore(queryNorm, provNameNorm),
    );
    let provReason = "Tên tỉnh/thành phố";

    // Kiểm tra tên cũ của tỉnh (sáp nhập tỉnh)
    if (province.oldNames && province.oldNames.length > 0) {
      for (const old of province.oldNames) {
        const oldRaw = old.toLowerCase();
        const oldNorm = normalizeVietnamese(old);
        const score = Math.max(
          calculateMatchScore(queryRaw, oldRaw),
          calculateMatchScore(queryNorm, oldNorm),
        );
        if (score > provScore) {
          provScore = score;
          provReason = `Tên tỉnh cũ sáp nhập (${old})`;
        }
      }
    }

    if (provScore >= 40) {
      matchedProvinces.push({
        ...province,
        matchScore: provScore,
        matchReason: provReason,
      });
    }

    // Duyệt danh sách xã/phường/đặc khu thuộc tỉnh
    if (province.communes && province.communes.length > 0) {
      for (const commune of province.communes) {
        const commNameRaw = commune.name.toLowerCase();
        const commNameNorm = normalizeVietnamese(commune.name);

        let commScore = Math.max(
          calculateMatchScore(queryRaw, commNameRaw),
          calculateMatchScore(queryNorm, commNameNorm),
        );
        let commReason = "Tên xã/phường/đặc khu";

        // Kiểm tra tên huyện/quận cũ
        if (commune.oldDistrict) {
          const distRaw = commune.oldDistrict.toLowerCase();
          const distNorm = normalizeVietnamese(commune.oldDistrict);
          const score = Math.max(
            calculateMatchScore(queryRaw, distRaw),
            calculateMatchScore(queryNorm, distNorm),
          );
          if (score > commScore) {
            commScore = score;
            commReason = `Huyện/Quận cũ trước đây (${commune.oldDistrict})`;
          }
        }

        // Kiểm tra tên xã cũ trước sáp nhập
        if (commune.oldNames && commune.oldNames.length > 0) {
          for (const old of commune.oldNames) {
            const oldRaw = old.toLowerCase();
            const oldNorm = normalizeVietnamese(old);
            const score = Math.max(
              calculateMatchScore(queryRaw, oldRaw),
              calculateMatchScore(queryNorm, oldNorm),
            );
            if (score > commScore) {
              commScore = score;
              commReason = `Tên cũ trước sáp nhập (${old})`;
            }
          }
        }

        if (commScore >= 40) {
          matchedCommunes.push({
            ...commune,
            provinceName: province.name,
            provinceCode: province.code,
            matchScore: commScore,
            matchReason: commReason,
          });
        }
      }
    }
  }

  // Sắp xếp theo điểm trùng khớp giảm dần
  matchedProvinces.sort((a, b) => b.matchScore - a.matchScore);
  matchedCommunes.sort((a, b) => b.matchScore - a.matchScore);

  return {
    provinces: matchedProvinces.slice(0, 10),
    communes: matchedCommunes.slice(0, 20),
  };
}

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
