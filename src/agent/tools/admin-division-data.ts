/** Kiểu dữ liệu + nạp danh mục ĐVHC 34 tỉnh vào RAM (tách từ admin_division_lookup.ts cũ). */
import fs from "node:fs";
import path from "node:path";
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
      // Ràng buộc nghiệp vụ cấp tỉnh hiện hành: Lâm Đồng mới chỉ nhận
      // Lâm Đồng cũ, Bình Thuận và Đắk Nông. Đắk Lắk là tỉnh độc lập (mã 31),
      // không được để một bản dữ liệu cũ/nhập tay gán nhầm vào mã 34.
      const lamDong = cachedAdminData.provinces?.find(
        (p) => normalizeVietnamese(p.name) === normalizeVietnamese("Tỉnh Lâm Đồng"),
      );
      if (lamDong) {
        lamDong.oldNames = (lamDong.oldNames ?? []).filter(
          (name) => normalizeVietnamese(name) !== normalizeVietnamese("Tỉnh Đắk Lắk"),
        );
      }
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
