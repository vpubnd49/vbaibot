import { z } from "zod";

/**
 * Danh sách 24 loại văn bản hành chính theo Nghị định 30/2020/NĐ-CP
 */
export const LOAI_VAN_BAN_HC = [
  "nghi_quyet",
  "quyet_dinh",
  "chi_thi",
  "quy_che",
  "quy_dinh",
  "thong_bao",
  "huong_dan",
  "chuong_trinh",
  "ke_hoach",
  "phuong_an",
  "de_an",
  "du_an",
  "bao_cao",
  "to_trinh",
  "thong_cao",
  "bien_ban",
  "giay_moi",
  "giay_gioi_thieu",
  "giay_nghi_phep",
  "giay_uy_quyen",
  "hop_dong",
  "cong_dien",
  "ban_ghi_nho",
  "cong_van",
] as const;

export type LoaiVanBanHC = (typeof LOAI_VAN_BAN_HC)[number];

export const TEN_LOAI_TIENG_VIET: Record<LoaiVanBanHC, string> = {
  nghi_quyet: "NGHỊ QUYẾT",
  quyet_dinh: "QUYẾT ĐỊNH",
  chi_thi: "CHỈ THỊ",
  quy_che: "QUY CHẾ",
  quy_dinh: "QUY ĐỊNH",
  thong_bao: "THÔNG BÁO",
  huong_dan: "HƯỚNG DẪN",
  chuong_trinh: "CHƯƠNG TRÌNH",
  ke_hoach: "KẾ HOẠCH",
  phuong_an: "PHƯƠNG ÁN",
  de_an: "ĐỀ ÁN",
  du_an: "DỰ ÁN",
  bao_cao: "BÁO CÁO",
  to_trinh: "TỜ TRÌNH",
  thong_cao: "THÔNG CÁO",
  bien_ban: "BIÊN BẢN",
  giay_moi: "GIẤY MỜI",
  giay_gioi_thieu: "GIẤY GIỚI THIỆU",
  giay_nghi_phep: "GIẤY NGHỈ PHÉP",
  giay_uy_quyen: "GIẤY ỦY QUYỀN",
  hop_dong: "HỢP ĐỒNG",
  cong_dien: "CÔNG ĐIỆN",
  ban_ghi_nho: "BẢN GHI NHỚ",
  cong_van: "", // Công văn không có tiêu đề tên loại
};

export const adminSectionSchema = z.object({
  heading: z.string().optional().describe("Tiêu đề mục, ví dụ: 'I. SỰ CẦN THIẾT', 'Điều 1. Phạm vi điều chỉnh'"),
  paragraphs: z.array(z.string().min(1)).min(1).describe("Các đoạn văn xuôi trong mục, tự động thụt đầu dòng 1cm"),
  items: z.array(z.string().min(1)).optional().describe("Các gạch đầu dòng hoặc điểm a, b, c liệt kê"),
  table: z
    .object({
      headers: z.array(z.string()).min(1),
      rows: z.array(z.array(z.string())).min(1),
    })
    .optional()
    .describe("Bảng biểu số liệu nếu có trong mục"),
});

export type AdminSection = z.infer<typeof adminSectionSchema>;

export const adminDocumentSchema = z.object({
  heThong: z
    .enum(["nha_nuoc_nd30", "dang_hd05"])
    .default("nha_nuoc_nd30")
    .describe("Hệ thống thể thức: nha_nuoc_nd30 (Nghị định 30) hoặc dang_hd05 (Hướng dẫn 05 Đảng)"),
  loaiVanBan: z
    .enum(LOAI_VAN_BAN_HC)
    .default("to_trinh")
    .describe("Loại văn bản hành chính (to_trinh, quyet_dinh, cong_van, giay_moi, ke_hoach, bao_cao, thong_bao...)"),
  coQuanCapTren: z
    .string()
    .optional()
    .describe("Tên cơ quan cấp trên trực tiếp, ví dụ: 'UBND TỈNH LÂM ĐỒNG', 'BỘ TÀI CHÍNH'"),
  coQuanBanHanh: z
    .string()
    .min(1)
    .default("ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG")
    .describe("Tên cơ quan, tổ chức ban hành văn bản (IN HOA ĐẬM), ví dụ: 'SỞ NỘI VỤ', 'UBND TỈNH LÂM ĐỒNG'"),
  soKyHieu: z
    .string()
    .optional()
    .describe("Số và ký hiệu văn bản, ví dụ: 'Số: 123/TTr-SNV' hoặc 'Số:    /QĐ-UBND'"),
  diaDanh: z.string().default("Lâm Đồng").describe("Địa danh ban hành văn bản, ví dụ: 'Lâm Đồng', 'Hà Nội'"),
  ngay: z.string().optional().describe("Ngày ban hành (để trống nếu dự thảo)"),
  thang: z.string().optional().describe("Tháng ban hành (để trống nếu dự thảo)"),
  nam: z.string().default("2026").describe("Năm ban hành"),
  trichYeu: z
    .string()
    .min(1)
    .describe("Trích yếu nội dung văn bản (V/v phê duyệt..., Về việc quy định chức năng nhiệm vụ...)"),
  kinhGui: z
    .array(z.string().min(1))
    .optional()
    .describe("Nơi nhận phần đầu văn bản đối với Công văn/Tờ trình/Giấy mời, ví dụ: ['Ủy ban nhân dân tỉnh Lâm Đồng']"),
  canCuPhapLy: z
    .array(z.string().min(1))
    .optional()
    .describe("Hệ thống căn cứ pháp lý (Căn cứ Luật..., Căn cứ Nghị định...), tự động in nghiêng và chấm phẩy chuẩn"),
  sections: z.array(adminSectionSchema).min(1).describe("Các phần nội dung chính của văn bản"),
  chucVuNguoiKy: z
    .string()
    .min(1)
    .default("GIÁM ĐỐC")
    .describe("Chức vụ người ký, ví dụ: 'GIÁM ĐỐC', 'TM. ỦY BAN NHÂN DÂN\\nCHỦ TỊCH', 'KT. CHỦ TỊCH\\nPHÓ CHỦ TỊCH'"),
  hoTenNguoiKy: z.string().optional().describe("Họ và tên người ký (in đậm cuối khối chữ ký)"),
  noiNhan: z
    .array(z.string().min(1))
    .default(["Như trên", "Lưu: VT"])
    .describe("Nơi nhận phía cuối văn bản, ví dụ: ['Như trên', 'Thường trực Tỉnh ủy', 'Lưu: VT, NC']"),
});

export type AdminDocument = z.infer<typeof adminDocumentSchema>;
