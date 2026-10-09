/** Tìm kiếm mờ ĐVHC có dấu/không dấu, tra ngược tên cũ (tách từ admin_division_lookup.ts cũ). */
import { normalizeVietnamese } from "../../domain/normalize-vietnamese.js";
import {
  getAdminDivisionData,
  type AdminSearchResult,
  type SearchResultCommune,
  type SearchResultProvince,
} from "./admin-division-data.js";

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
