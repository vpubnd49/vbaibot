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
  "phieu_trinh",
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
  phieu_trinh: "PHIẾU TRÌNH",
};

export const adminSectionSchema = z.preprocess((raw: any) => {
  if (typeof raw === "string") {
    return { paragraphs: [raw] };
  }
  if (raw && typeof raw === "object") {
    const s: any = { ...raw };
    if (!s.heading && typeof s.title === "string") s.heading = s.title;
    if (typeof s.paragraphs === "string") {
      s.paragraphs = s.paragraphs.split("\n").map((l: string) => l.trim()).filter(Boolean);
    }
    if (!Array.isArray(s.paragraphs)) {
      if (typeof s.text === "string" && s.text.trim()) s.paragraphs = [s.text.trim()];
      else if (typeof s.content === "string" && s.content.trim()) s.paragraphs = [s.content.trim()];
      else s.paragraphs = [];
    } else {
      s.paragraphs = s.paragraphs
        .map((p: any) => (typeof p === "string" ? p.trim() : String(p?.text ?? p?.content ?? p ?? "").trim()))
        .filter((p: string) => p.length > 0);
    }
    if (typeof s.items === "string") {
      s.items = s.items.split("\n").map((l: string) => l.trim()).filter(Boolean);
    } else if (Array.isArray(s.items)) {
      s.items = s.items
        .map((it: any) => (typeof it === "string" ? it.trim() : String(it?.text ?? it?.content ?? it ?? "").trim()))
        .filter((it: string) => it.length > 0);
    }
    // Nếu model chỉ truyền items hoặc table mà quên truyền paragraphs -> điền mảng rỗng hợp lệ hoặc dùng heading/items
    if (s.paragraphs.length === 0 && (!Array.isArray(s.items) || s.items.length === 0) && !s.table) {
      s.paragraphs = [s.heading || " "];
    }
    if (s.table && typeof s.table === "object") {
      const headers = Array.isArray(s.table.headers)
        ? s.table.headers.map((h: any) => String(h ?? ""))
        : Array.isArray(s.table.columns)
          ? s.table.columns.map((h: any) => String(h ?? ""))
          : ["Nội dung"];
      const rawRows = Array.isArray(s.table.rows) ? s.table.rows : Array.isArray(s.table.data) ? s.table.data : [];
      const rows = rawRows.map((r: any) =>
        Array.isArray(r) ? r.map((c: any) => String(c ?? "")) : [String(r ?? "")],
      );
      if (headers.length > 0 && rows.length > 0) {
        s.table = { headers, rows };
      } else {
        delete s.table;
      }
    }
    return s;
  }
  return raw;
}, z.object({
  heading: z.string().optional().describe("Tiêu đề mục, ví dụ: 'I. SỰ CẦN THIẾT', 'Điều 1. Phạm vi điều chỉnh'"),
  paragraphs: z
    .array(z.string())
    .default([])
    .describe(
      "Các đoạn văn xuôi trong mục (tự động thụt đầu dòng 1cm). " +
      "QUY TẮC BÔI ĐỎ KHI HIỆU ĐÍNH / SỬA LỖI: BẮT BUỘC dùng thẻ `<red>từ đã sửa</red>` (hoặc `~~từ sai~~ <red>từ đúng</red>`) " +
      "để bôi đỏ toàn bộ các từ/cụm từ đã được chỉnh sửa trong file Word cho người dùng dễ kiểm tra đối chiếu! " +
      "Hỗ trợ các thẻ inline: `<b>đậm</b>`, `<i>nghiêng</i>`, `<u>gạch chân</u>`, `~~gạch bỏ~~`, `<red>bôi đỏ</red>`."
    ),
  items: z
    .array(z.string().min(1))
    .optional()
    .describe("Các gạch đầu dòng hoặc điểm a, b, c liệt kê (hỗ trợ thẻ `<red>từ đã sửa</red>` để bôi đỏ)"),
  table: z
    .object({
      headers: z.array(z.string()).min(1),
      rows: z.array(z.array(z.string())).min(1),
    })
    .optional()
    .describe("Bảng biểu số liệu nếu có trong mục"),
}));

export type AdminSection = z.infer<typeof adminSectionSchema>;

export const adminDocumentSchema = z.preprocess((raw: any) => {
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch {}
  }
  if (raw && typeof raw === "object") {
    const d: any = { ...raw };
    if (typeof d.kinhGui === "string") {
      d.kinhGui = d.kinhGui.split(/;|\n/).map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(d.kinhGui)) {
      d.kinhGui = d.kinhGui.map((s: any) => String(s ?? "").trim()).filter(Boolean);
    }
    if (typeof d.canCuPhapLy === "string") {
      d.canCuPhapLy = d.canCuPhapLy.split("\n").map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(d.canCuPhapLy)) {
      d.canCuPhapLy = d.canCuPhapLy.map((s: any) => String(s ?? "").trim()).filter(Boolean);
    }
    if (typeof d.noiNhan === "string") {
      d.noiNhan = d.noiNhan.split(/;|\n/).map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(d.noiNhan)) {
      const cleaned = d.noiNhan.map((s: any) => String(s ?? "").trim()).filter(Boolean);
      d.noiNhan = cleaned.length > 0 ? cleaned : ["Như trên", "Lưu: VT"];
    }
    if (typeof d.ngay === "number") d.ngay = String(d.ngay);
    if (typeof d.thang === "number") d.thang = String(d.thang);
    if (typeof d.nam === "number") d.nam = String(d.nam);
    if (!d.trichYeu || typeof d.trichYeu !== "string" || !d.trichYeu.trim()) {
      d.trichYeu =
        d.title ||
        d.subject ||
        (Array.isArray(d.sections) && d.sections[0]?.heading) ||
        "Về việc thực hiện nhiệm vụ công tác";
    }
    if (!d.coQuanBanHanh || typeof d.coQuanBanHanh !== "string" || !d.coQuanBanHanh.trim()) {
      d.coQuanBanHanh = "ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG";
    }
    if (!d.chucVuNguoiKy || typeof d.chucVuNguoiKy !== "string" || !d.chucVuNguoiKy.trim()) {
      d.chucVuNguoiKy = "GIÁM ĐỐC";
    }
    return d;
  }
  return raw;
}, z.object({
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
    .default("Về việc thực hiện nhiệm vụ công tác")
    .describe("Trích yếu nội dung văn bản (V/v phê duyệt..., Về việc quy định chức năng nhiệm vụ...)"),
  kinhGui: z
    .array(z.string().min(1))
    .optional()
    .describe("Nơi nhận phần đầu văn bản đối với Công văn/Tờ trình/Giấy mời, ví dụ: ['Ủy ban nhân dân tỉnh Lâm Đồng']"),
  canCuPhapLy: z
    .array(z.string().min(1))
    .optional()
    .describe("Hệ thống căn cứ pháp lý (Căn cứ Luật..., Căn cứ Nghị định...), tự động in nghiêng và chấm phẩy chuẩn"),
  sections: z.array(adminSectionSchema).min(1).describe("Các phần nội dung chính của văn bản. PHẢI chứa NỘI DUNG THỰC CHẤT đầy đủ — CẤM bỏ trống hoặc chỉ viết câu mở đầu. Công văn giao việc: phải ghi rõ giao đơn vị nào, làm gì, phối hợp ai, thời hạn. Tờ trình: phải có sự cần thiết + đề xuất cụ thể."),
  chucVuNguoiKy: z
    .string()
    .min(1)
    .default("GIÁM ĐỐC")
    .describe("Chức vụ người ký (IN HOA ĐẬM). Nhiều dòng cách nhau bằng ký tự xuống dòng \\n. Ví dụ 1 dòng: 'GIÁM ĐỐC'. Ví dụ 2 dòng: 'TM. ỦY BAN NHÂN DÂN\\nCHỦ TỊCH'. Ví dụ 3 dòng: 'TL. CHỦ TỊCH\\nKT. CHÁNH VĂN PHÒNG\\nPHÓ CHÁNH VĂN PHÒNG'"),
  hoTenNguoiKy: z.string().optional().describe("Họ và tên người ký (in đậm cuối khối chữ ký)"),
  noiNhan: z
    .array(z.string().min(1))
    .default(["Như trên", "Lưu: VT"])
    .describe("Nơi nhận phía cuối văn bản, ví dụ: ['Như trên', 'Thường trực Tỉnh ủy', 'Lưu: VT, NC']. BẮT BUỘC: mục đầu tiên gửi các cơ quan tại phần kính gửi phải ghi là 'Như trên', TUYỆT ĐỐI KHÔNG ghi 'Như kính gửi'."),
}));

export type AdminDocument = z.infer<typeof adminDocumentSchema>;
