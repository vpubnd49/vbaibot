import { normalizeVietnamese } from "../domain/normalize-vietnamese.js";

export type AdminDeptRecord = {
  canonical_name: string;
  short_name: string;
  resolution_number: string;
  resolution_date: string;
  change_type: string;
  old_entities?: string[];
  note: string;
};

const LAM_DONG_DEPTS: AdminDeptRecord[] = [
  {
    canonical_name: "Sở Xây dựng tỉnh Lâm Đồng",
    short_name: "Sở Xây dựng",
    resolution_number: "390/NQ-HĐND",
    resolution_date: "18/02/2025",
    change_type: "Hợp nhất",
    old_entities: ["Sở Xây dựng", "Sở Giao thông vận tải"],
    note: "Hợp nhất Sở Xây dựng và Sở Giao thông vận tải thành Sở Xây dựng (hoạt động chính thức từ 01/03/2025).",
  },
  {
    canonical_name: "Sở Nội vụ tỉnh Lâm Đồng",
    short_name: "Sở Nội vụ",
    resolution_number: "391/NQ-HĐND",
    resolution_date: "18/02/2025",
    change_type: "Tiếp nhận chức năng",
    old_entities: ["Sở Nội vụ", "Sở Lao động - Thương binh và Xã hội"],
    note: "Tiếp nhận các chức năng quản lý nhà nước về lao động, việc làm, tiền lương, BHXH từ Sở LĐ-TB&XH.",
  },
  {
    canonical_name: "Sở Dân tộc và Tôn giáo tỉnh Lâm Đồng",
    short_name: "Sở Dân tộc và Tôn giáo",
    resolution_number: "392/NQ-HĐND",
    resolution_date: "18/02/2025",
    change_type: "Thành lập mới trên cơ sở tổ chức lại",
    old_entities: ["Ban Dân tộc", "Sở Nội vụ (phần Tôn giáo)"],
    note: "Thành lập Sở Dân tộc và Tôn giáo trên cơ sở Ban Dân tộc và tiếp nhận chức năng quản lý nhà nước về tôn giáo từ Sở Nội vụ.",
  },
];

const TWO_TIER_GOVERNMENT_PRINCIPLE = `
=== NGUYÊN TẮC TỔ CHỨC CHÍNH QUYỀN ĐỊA PHƯƠNG 02 CẤP (LUẬT 72/2025/QH15) ===
- Toàn quốc tổ chức chính quyền địa phương theo mô hình 02 cấp:
  1. Cấp Tỉnh: Gồm 34 tỉnh, thành phố trực thuộc Trung ương.
  2. Cấp Xã / Cơ sở: Gồm xã, phường, thị trấn (đơn vị hành chính cấp cơ sở trực tiếp thuộc tỉnh).
- KHÔNG CÒN CẤP TRUNG GIAN: Toàn quốc đã bỏ hoàn toàn cấp huyện, thị xã, thành phố thuộc tỉnh, quận.
- VÍ DỤ THỰC TẾ TẠI LÂM ĐỒNG:
  + Không còn cấp hành chính "Thành phố Đà Lạt", "Huyện Đơn Dương", "Huyện Lạc Dương"... làm cấp trung gian.
  + Các đơn vị hành chính cấp cơ sở trực thuộc trực tiếp Tỉnh Lâm Đồng (ví dụ: Phường Xuân Hương - Đà Lạt, Phường Cam Ly - Đà Lạt, Phường Lâm Viên - Đà Lạt, Xã Đơn Dương...).
- Thẩm quyền quản lý, giải quyết thủ tục hành chính, phân cấp, phân quyền được chuyển giao trực tiếp giữa Cấp Tỉnh và Cấp Cơ sở (Xã/Phường).
`;

export function detectAdminContext(query = ""): string | null {
  if (!query) return null;
  const norm = normalizeVietnamese(query);

  const isTwoTier =
    norm.includes("2 cap") ||
    norm.includes("hai cap") ||
    norm.includes("chinh quyen dia phuong") ||
    norm.includes("cap huyen") ||
    norm.includes("bo cap huyen") ||
    norm.includes("34 tinh");

  const isLamDong = norm.includes("lam dong") || norm.includes("da lat") || norm.includes("dalat");
  const isDept = /(?:sở|so|ban|hợp nhất|sắp xếp|tôn giáo|nghị quyết 39)/i.test(query);

  if (isTwoTier || isLamDong || isDept) {
    const lines: string[] = [];

    if (isTwoTier || /(?:chính quyền|cơ cấu|hành chính|bộ máy|cấp huyện|cấp xã|cấp tỉnh)/i.test(query)) {
      lines.push(TWO_TIER_GOVERNMENT_PRINCIPLE.trim());
    }

    const matched = LAM_DONG_DEPTS.filter(
      (d) =>
        norm.includes(normalizeVietnamese(d.short_name)) ||
        norm.includes(normalizeVietnamese(d.canonical_name)) ||
        (d.old_entities && d.old_entities.some((old) => norm.includes(normalizeVietnamese(old)))),
    );

    if (matched.length > 0 || (isLamDong && isDept)) {
      const depts = matched.length > 0 ? matched : LAM_DONG_DEPTS;
      lines.push("\n=== THÔNG TIN CƠ CẤU HÀNH CHÍNH LÂM ĐỒNG (Nghị quyết HĐND tháng 02/2025) ===");
      for (const d of depts) {
        lines.push(`- ${d.canonical_name} (${d.short_name}): ${d.note}`);
        lines.push(`  + Căn cứ: Nghị quyết ${d.resolution_number} ngày ${d.resolution_date}`);
      }
    }

    if (lines.length > 0) {
      return lines.join("\n");
    }
  }

  return null;
}
