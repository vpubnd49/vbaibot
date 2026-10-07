import {
  AlignmentType,
  BorderStyle,
  Document,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { AdminDocument } from "./admin-document-schema.js";

const FONT = "Times New Roman";

const BORDERS_NONE = {
  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
};

const BORDER_SOLID_BLACK = {
  style: BorderStyle.SINGLE,
  size: 6, // 0.75 pt
  color: "000000",
};

const CELL_BORDER_ALL = {
  top: BORDER_SOLID_BLACK,
  bottom: BORDER_SOLID_BLACK,
  left: BORDER_SOLID_BLACK,
  right: BORDER_SOLID_BLACK,
};

const SPACING_COMPACT = {
  before: 40,
  after: 40,
  line: 260,
  lineRule: LineRuleType.AT_LEAST,
};

/**
 * Kiểm tra xem một AdminDocument có phải là Phiếu trình cần đóng khung hay không
 */
export function isPhieuTrinh(doc: AdminDocument): boolean {
  if (doc.loaiVanBan === "phieu_trinh") return true;
  const ty = (doc.trichYeu ?? "").toLowerCase();
  if (ty.includes("phiếu trình")) return true;
  for (const s of doc.sections ?? []) {
    const h = (s.heading ?? "").toLowerCase();
    if (h.includes("nội dung trình/chỉ đạo") || h.includes("phòng chuyên môn thuộc văn phòng") || h.includes("phiếu trình")) {
      return true;
    }
  }
  return false;
}

export interface PhieuTrinhData {
  so_ky_hieu: string;
  co_quan_cap_tren: string;
  co_quan_ban_hanh: string;
  kinh_gui: string[];
  van_ban_trinh: string;
  trich_yeu: string;
  check_van_ban_trinh: boolean;
  check_trung_uong: boolean;
  check_tinh_uy: boolean;
  check_hdnd: boolean;
  check_dang_uy: boolean;
  check_khac: boolean;
  check_ubnd: boolean;
  cac_co_quan_trinh: string;
  tham_quyen: string;
  de_xuat_phuong_an: string;
  y_kien_lua_chon: number;
  y_kien_sua: string;
  y_kien_ly_do: string;
  do_mat: string;
  phong_xu_ly: string;
  chuyen_vien: string;
  ngay_chuyen_vien: string;
  lanh_dao_phong: string;
  ngay_lanh_dao_phong: string;
  lanh_dao_vp: string;
  ngay_lanh_dao_vp: string;
  lanh_dao_tinh: string;
  ngay_lanh_dao_tinh: string;
}

/**
 * Phân tích và bóc tách dữ liệu từ AdminDocument sang cấu trúc chuẩn của Phiếu trình
 */
export function parseAdminDocumentToPhieuTrinhData(doc: AdminDocument): PhieuTrinhData {
  const allParagraphs: string[] = [];
  for (const s of doc.sections ?? []) {
    if (s.heading) allParagraphs.push(s.heading);
    for (const p of s.paragraphs ?? []) allParagraphs.push(p);
    for (const it of s.items ?? []) allParagraphs.push(it);
  }

  const findAfterPrefix = (prefixes: string[]): string => {
    for (const p of allParagraphs) {
      for (const prefix of prefixes) {
        const idx = p.indexOf(prefix);
        if (idx !== -1) {
          return p.substring(idx + prefix.length).trim();
        }
      }
    }
    return "";
  };

  const isChecked = (pattern: RegExp): boolean => {
    for (const p of allParagraphs) {
      if (pattern.test(p)) {
        // Kiểm tra xem trước pattern có dấu tích [X], [x], ☑ không
        const match = p.match(pattern);
        if (match) {
          const start = Math.max(0, match.index! - 15);
          const end = Math.min(p.length, match.index! + match[0].length + 15);
          const snippet = p.substring(start, end);
          if (/\[[xX]\]|☑|☒/.test(snippet)) return true;
        }
      }
    }
    return false;
  };

  // 1. Số ký hiệu
  let soKyHieu = doc.soKyHieu || findAfterPrefix(["Số:", "Số "]);
  soKyHieu = soKyHieu.replace(/^Số:\s*/i, "").trim() || "25-9/26/PT-NC";

  // 2. Cơ quan
  const coQuanCapTren = doc.coQuanCapTren || "UBND TỈNH LÂM ĐỒNG";
  const coQuanBanHanh = doc.coQuanBanHanh || "VĂN PHÒNG";

  // 3. Kính gửi
  let kinhGui = doc.kinhGui && doc.kinhGui.length > 0
    ? doc.kinhGui
    : ["Lãnh đạo UBND tỉnh;", "Lãnh đạo Văn phòng UBND tỉnh."];

  // 4. Văn bản trình & Trích yếu
  let vanBanTrinh = findAfterPrefix([
    "1. Văn bản/cơ quan, đơn vị:",
    "1. Văn bản/cơ quan trình:",
    "Văn bản/cơ quan, đơn vị:",
  ]);
  let trichYeu = findAfterPrefix(["2. Trích yếu:", "Trích yếu:"]) || doc.trichYeu;

  // 5. Checkboxes
  const check_van_ban_trinh = isChecked(/Văn bản của cơ quan trình/i);
  const check_trung_uong = isChecked(/Bộ,?\s*ngành Trung ương/i);
  const check_tinh_uy = isChecked(/Quy chế làm việc của Tỉnh ủy/i);
  const check_hdnd = isChecked(/HĐND tỉnh/i);
  const check_dang_uy = isChecked(/Quy chế làm việc của Đảng ủy/i);
  const check_khac = isChecked(/Cơ quan khác/i);
  const check_ubnd = isChecked(/Quy chế làm việc của UBND tỉnh/i);

  // 6. Cơ quan trình & Thẩm quyền
  const cacCoQuanTrinh = findAfterPrefix([
    "2. Các sở, ban, ngành, đơn vị, địa phương trình (kết quả đề nghị):",
    "2. Các sở, ban, ngành, đơn vị, địa phương trình (kết quả đề nghị):",
    "2. Các sở, ban, ngành",
    "2. Các sở, ban, ngành",
  ]) || "Văn phòng UBND tỉnh thừa lệnh tham mưu.";

  const thamQuyen = findAfterPrefix([
    "3. Thẩm quyền (Chọn ghi thẩm quyền tương ứng):",
    "3. Thẩm quyền:",
    "Thẩm quyền:",
  ]) || "Chủ tịch Ủy ban nhân dân tỉnh.";

  // 7. Đề xuất phương án
  let deXuat = findAfterPrefix([
    "4. Phòng chuyên môn của Văn phòng UBND tỉnh đề xuất phương án:",
    "4. Phòng chuyên môn của Văn phòng UBND tỉnh đề xuất phương án:",
    "đề xuất phương án:",
  ]);

  if (!deXuat) {
    // Tìm các đoạn văn từ mục 4 đến trước mục 5
    const collected: string[] = [];
    let collecting = false;
    for (const p of allParagraphs) {
      if (/4\.\s*Ph[oò]ng chuy[eê]n m[oô]n/i.test(p)) {
        collecting = true;
        const remaining = p.replace(/^4\.[^:]*:\s*/i, "").trim();
        if (remaining) collected.push(remaining);
        continue;
      }
      if (/4\.[123]|5\.\s*Độ mật/i.test(p)) {
        collecting = false;
      }
      if (collecting && p.trim()) {
        collected.push(p.trim());
      }
    }
    deXuat = collected.join("\n\n");
  }

  // 8. Ý kiến lựa chọn 4.1, 4.2, 4.3
  let yKienLuaChon = 1;
  if (isChecked(/4\.2/i) || isChecked(/Thống nhất\s+Sửa/i)) yKienLuaChon = 2;
  else if (isChecked(/4\.3/i) || isChecked(/Không thống nhất/i)) yKienLuaChon = 3;

  const yKienSua = findAfterPrefix(["Sửa:"]);
  const yKienLyDo = findAfterPrefix(["Lý do:"]);
  const doMat = findAfterPrefix(["5. Độ mật:", "Độ mật:"]) || "Không";

  // 9. Khối ký
  let phongXuLy = "PHÒNG NỘI CHÍNH";
  for (const p of allParagraphs) {
    const m = p.match(/PHÒNG XỬ LÝ CHÍNH:\s*([^\n\r]+)/i);
    if (m) {
      phongXuLy = m[1].trim();
      break;
    }
  }

  let chuyenVien = doc.hoTenNguoiKy || "Trương Hải Châu";
  let lanhDaoPhong = "Lương Thị Nguyệt Thanh";
  let lanhDaoVp = "Trần Thanh Toàn";
  let lanhDaoTinh = "Đinh Văn Tuấn";
  let ngayThang = doc.ngay && doc.thang
    ? `Ngày ${doc.ngay} tháng ${doc.thang} năm ${doc.nam || 2026}`
    : "Ngày 25 tháng 9 năm 2026";

  // Quét tìm tên trong các đoạn ký
  for (let i = 0; i < allParagraphs.length; i++) {
    const p = allParagraphs[i];
    if (/Chuyên viên/i.test(p)) {
      if (i > 0 && /^[A-ZÀ-Ỹ][a-zà-ỹ]+(\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+$/.test(allParagraphs[i - 1].trim())) {
        chuyenVien = allParagraphs[i - 1].trim();
      } else if (i + 1 < allParagraphs.length && /^[A-ZÀ-Ỹ][a-zà-ỹ]+(\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+$/.test(allParagraphs[i + 1].trim())) {
        chuyenVien = allParagraphs[i + 1].trim();
      }
    }
    if (/Lãnh đạo phòng/i.test(p)) {
      if (i > 0 && /^[A-ZÀ-Ỹ][a-zà-ỹ]+(\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+$/.test(allParagraphs[i - 1].trim())) {
        lanhDaoPhong = allParagraphs[i - 1].trim();
      } else if (i + 1 < allParagraphs.length && /^[A-ZÀ-Ỹ][a-zà-ỹ]+(\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+$/.test(allParagraphs[i + 1].trim())) {
        lanhDaoPhong = allParagraphs[i + 1].trim();
      }
    }
    if (/LÃNH ĐẠO VĂN PHÒNG/i.test(p)) {
      for (let j = i + 1; j <= Math.min(i + 4, allParagraphs.length - 1); j++) {
        const nextP = allParagraphs[j].trim();
        if (/^[A-ZÀ-Ỹ][a-zà-ỹ]+(\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+$/.test(nextP) && !nextP.includes("Ngày")) {
          lanhDaoVp = nextP;
          break;
        }
      }
    }
    if (/UBND TỈNH/i.test(p) && (/Ý KIẾN/i.test(p) || /KÍNH TRÌNH/i.test(p))) {
      for (let j = i + 1; j <= Math.min(i + 5, allParagraphs.length - 1); j++) {
        const nextP = allParagraphs[j].trim();
        if (/^[A-ZÀ-Ỹ][a-zà-ỹ]+(\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+$/.test(nextP) && !nextP.includes("Ngày") && !nextP.includes("CHỦ TỊCH")) {
          lanhDaoTinh = nextP;
          break;
        }
      }
    }
    if (p.includes("Ngày") && p.includes("tháng") && p.includes("năm")) {
      const match = p.match(/Ngày\s+\d+\s+tháng\s+\d+\s+năm\s+\d+/i);
      if (match) ngayThang = match[0];
    }
  }

  return {
    so_ky_hieu: soKyHieu,
    co_quan_cap_tren: coQuanCapTren,
    co_quan_ban_hanh: coQuanBanHanh,
    kinh_gui: kinhGui,
    van_ban_trinh: vanBanTrinh || doc.trichYeu,
    trich_yeu: trichYeu,
    check_van_ban_trinh,
    check_trung_uong,
    check_tinh_uy,
    check_hdnd,
    check_dang_uy,
    check_khac,
    check_ubnd,
    cac_co_quan_trinh: cacCoQuanTrinh,
    tham_quyen: thamQuyen,
    de_xuat_phuong_an: deXuat,
    y_kien_lua_chon: yKienLuaChon,
    y_kien_sua: yKienSua,
    y_kien_ly_do: yKienLyDo,
    do_mat: doMat,
    phong_xu_ly: phongXuLy,
    chuyen_vien: chuyenVien,
    ngay_chuyen_vien: ngayThang,
    lanh_dao_phong: lanhDaoPhong,
    ngay_lanh_dao_phong: ngayThang,
    lanh_dao_vp: lanhDaoVp,
    ngay_lanh_dao_vp: "Ngày ..... tháng ..... năm 2026",
    lanh_dao_tinh: lanhDaoTinh,
    ngay_lanh_dao_tinh: "Ngày ....... tháng ..... năm 2026",
  };
}

/**
 * Sinh file DOCX Phiếu trình chuẩn 100% khung viền cố định theo mẫu Phòng Nội chính VP UBND tỉnh
 */
export async function renderPhieuTrinhDocx(docData: AdminDocument): Promise<Buffer> {
  const d = parseAdminDocumentToPhieuTrinhData(docData);
  const box = (checked: boolean) => (checked ? "☑" : "☐");

  // 1. Header 2 cột ẩn viền
  const headerTable = new Table({
    width: { size: 9071, type: WidthType.DXA },
    borders: BORDERS_NONE,
    rows: [
      new TableRow({
        children: [
          // Cột trái: Cơ quan
          new TableCell({
            width: { size: 4000, type: WidthType.DXA },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: d.co_quan_cap_tren, font: FONT, size: 24, bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 20 },
                children: [new TextRun({ text: d.co_quan_ban_hanh, font: FONT, size: 24, bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 0 },
                children: [new TextRun({ text: `Số: ${d.so_ky_hieu}`, font: FONT, size: 24 })],
              }),
            ],
          }),
          // Cột phải: Quốc hiệu, Tiêu ngữ
          new TableCell({
            width: { size: 5071, type: WidthType.DXA },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", font: FONT, size: 24, bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: "Độc lập - Tự do - Hạnh phúc",
                    font: FONT,
                    size: 26,
                    bold: true,
                    underline: { type: "single" as any },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Tiêu đề PHIẾU TRÌNH và Kính gửi
  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 100 },
    children: [new TextRun({ text: "PHIẾU TRÌNH", font: FONT, size: 28, bold: true })],
  });

  const kinhGuiParagraphs = [
    new Paragraph({
      spacing: { before: 0, after: 20 },
      indent: { left: 3000 },
      children: [new TextRun({ text: "Kính gửi:", font: FONT, size: 26, bold: true })],
    }),
    ...d.kinh_gui.map(
      (item) =>
        new Paragraph({
          spacing: { before: 0, after: 20 },
          indent: { left: 4000 },
          children: [new TextRun({ text: `- ${item.replace(/^-+\s*/, "")}`, font: FONT, size: 24 })],
        }),
    ),
  ];

  // 2. Bảng Checkbox trong Mục II.1
  const checkboxGridTable = new Table({
    width: { size: 8700, type: WidthType.DXA },
    borders: BORDERS_NONE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4500, type: WidthType.DXA },
            children: [
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Văn bản của cơ quan trình `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_van_ban_trinh), font: FONT, size: 26 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Quy chế làm việc của Tỉnh ủy `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_tinh_uy), font: FONT, size: 26 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Quy chế làm việc của Đảng ủy UBND tỉnh `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_dang_uy), font: FONT, size: 26 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Quy chế làm việc của UBND tỉnh `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_ubnd), font: FONT, size: 26 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 4200, type: WidthType.DXA },
            children: [
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Bộ, ngành Trung ương `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_trung_uong), font: FONT, size: 26 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ HĐND tỉnh `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_hdnd), font: FONT, size: 26 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Cơ quan khác `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_khac), font: FONT, size: 26 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 3. Khung lớn cố định bao quanh toàn bộ nội dung
  const proposalParagraphs: Paragraph[] = [];
  if (d.de_xuat_phuong_an) {
    const parts = d.de_xuat_phuong_an.split(/\n\s*\n|\n/);
    for (const part of parts) {
      if (part.trim()) {
        proposalParagraphs.push(
          new Paragraph({
            spacing: SPACING_COMPACT,
            children: [new TextRun({ text: part.trim(), font: FONT, size: 23 })],
          }),
        );
      }
    }
  }

  const mainContentCell = new TableCell({
    width: { size: 9071, type: WidthType.DXA },
    borders: CELL_BORDER_ALL,
    children: [
      // MỤC I
      new Paragraph({
        spacing: { before: 60, after: 40 },
        children: [new TextRun({ text: "I. NỘI DUNG TRÌNH/CHỈ ĐẠO", font: FONT, size: 24, bold: true })],
      }),
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({ text: "1. Văn bản/cơ quan, đơn vị: ", font: FONT, size: 23, bold: true, italics: true }),
          new TextRun({ text: d.van_ban_trinh, font: FONT, size: 23 }),
        ],
      }),
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({ text: "2. Trích yếu: ", font: FONT, size: 23, bold: true, italics: true }),
          new TextRun({ text: d.trich_yeu, font: FONT, size: 23 }),
        ],
      }),

      // MỤC II
      new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [
          new TextRun({
            text: "II. RÀ SOÁT, TỔNG HỢP CỦA PHÒNG CHUYÊN MÔN THUỘC VĂN PHÒNG",
            font: FONT,
            size: 24,
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({
            text: "1. Lưu ý thêm (Rà soát cần phải xin ý kiến các cơ quan thì đánh dấu X vào ô tương ứng):",
            font: FONT,
            size: 23,
            bold: true,
            italics: true,
          }),
        ],
      }),
      checkboxGridTable,
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({
            text: "2. Các sở, ban, ngành, đơn vị, địa phương trình (kết quả đề nghị): ",
            font: FONT,
            size: 23,
            bold: true,
            italics: true,
          }),
          new TextRun({ text: d.cac_co_quan_trinh, font: FONT, size: 23 }),
        ],
      }),
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({
            text: "3. Thẩm quyền (Chọn ghi thẩm quyền tương ứng): ",
            font: FONT,
            size: 23,
            bold: true,
            italics: true,
          }),
          new TextRun({ text: d.tham_quyen, font: FONT, size: 23 }),
        ],
      }),
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({
            text: "4. Phòng chuyên môn của Văn phòng UBND tỉnh đề xuất phương án: ",
            font: FONT,
            size: 23,
            bold: true,
            italics: true,
          }),
        ],
      }),
      ...proposalParagraphs,
      new Paragraph({
        spacing: { before: 40, after: 20 },
        children: [
          new TextRun({ text: "4.1. Thống nhất hoàn toàn   ", font: FONT, size: 23, italics: true }),
          new TextRun({ text: box(d.y_kien_lua_chon === 1), font: FONT, size: 26 }),
          new TextRun({
            text: " ......................................................................................................................",
            font: FONT,
            size: 20,
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 20, after: 20 },
        children: [
          new TextRun({ text: "4.2. Thống nhất              ", font: FONT, size: 23, italics: true }),
          new TextRun({ text: box(d.y_kien_lua_chon === 2), font: FONT, size: 26 }),
          new TextRun({
            text: ` Sửa: ${d.y_kien_sua || ".................................................................................................................."}`,
            font: FONT,
            size: 22,
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 20, after: 40 },
        children: [
          new TextRun({ text: "4.3. Không thống nhất        ", font: FONT, size: 23, italics: true }),
          new TextRun({ text: box(d.y_kien_lua_chon === 3), font: FONT, size: 26 }),
          new TextRun({
            text: ` Lý do: ${d.y_kien_ly_do || "..............................................................................................................."}`,
            font: FONT,
            size: 22,
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 40, after: 60 },
        children: [
          new TextRun({ text: "5. Độ mật: ", font: FONT, size: 23, bold: true, italics: true }),
          new TextRun({ text: d.do_mat, font: FONT, size: 23 }),
        ],
      }),
    ],
  });

  // 4. Hàng chữ ký duyệt (2 cột có border)
  const signatureBlockRow = new TableRow({
    children: [
      // Cột trái: PHÒNG XỬ LÝ CHÍNH
      new TableCell({
        width: { size: 5200, type: WidthType.DXA },
        borders: CELL_BORDER_ALL,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: `PHÒNG XỬ LÝ CHÍNH: ${d.phong_xu_ly}`,
                font: FONT,
                size: 24,
                bold: true,
              }),
            ],
          }),
          new Table({
            width: { size: 5200, type: WidthType.DXA },
            borders: {
              top: BORDER_SOLID_BLACK,
              bottom: BORDERS_NONE.bottom,
              left: BORDERS_NONE.left,
              right: BORDERS_NONE.right,
              insideHorizontal: BORDERS_NONE.insideHorizontal,
              insideVertical: BORDER_SOLID_BLACK,
            },
            rows: [
              new TableRow({
                children: [
                  // Chuyên viên
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 20, after: 0 },
                        children: [new TextRun({ text: "Chuyên viên", font: FONT, size: 23, bold: true })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 400 },
                        children: [new TextRun({ text: d.ngay_chuyen_vien, font: FONT, size: 21, italics: true })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 400, after: 20 },
                        children: [new TextRun({ text: d.chuyen_vien, font: FONT, size: 23, bold: true })],
                      }),
                    ],
                  }),
                  // Lãnh đạo phòng
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 20, after: 0 },
                        children: [new TextRun({ text: "Lãnh đạo phòng", font: FONT, size: 23, bold: true })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 400 },
                        children: [new TextRun({ text: d.ngay_lanh_dao_phong, font: FONT, size: 21, italics: true })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 400, after: 20 },
                        children: [new TextRun({ text: d.lanh_dao_phong, font: FONT, size: 23, bold: true })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      // Cột phải: LÃNH ĐẠO VĂN PHÒNG
      new TableCell({
        width: { size: 3871, type: WidthType.DXA },
        borders: CELL_BORDER_ALL,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 20 },
            children: [new TextRun({ text: "LÃNH ĐẠO VĂN PHÒNG", font: FONT, size: 24, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 300 },
            children: [
              new TextRun({
                text: "_________________________",
                font: FONT,
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 300 },
            children: [new TextRun({ text: d.ngay_lanh_dao_vp, font: FONT, size: 21, italics: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 20 },
            children: [new TextRun({ text: d.lanh_dao_vp, font: FONT, size: 23, bold: true })],
          }),
        ],
      }),
    ],
  });

  // 5. Hàng ý kiến lãnh đạo UBND tỉnh
  const lanhDaoTinhRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 9071, type: WidthType.DXA },
        columnSpan: 2,
        borders: CELL_BORDER_ALL,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 20 },
            children: [new TextRun({ text: "Ý KIẾN CỦA LÃNH ĐẠO UBND TỈNH", font: FONT, size: 24, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 1200 }, // Khoảng trống lớn ghi bút phê
            children: [new TextRun({ text: d.ngay_lanh_dao_tinh, font: FONT, size: 21, italics: true })],
          }),
        ],
      }),
    ],
  });

  const outerBoxTable = new Table({
    width: { size: 9071, type: WidthType.DXA },
    borders: CELL_BORDER_ALL,
    rows: [
      new TableRow({ children: [mainContentCell] }),
      signatureBlockRow,
      lanhDaoTinhRow,
    ],
  });

  const wordDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 },
          },
        },
        children: [
          headerTable,
          titleParagraph,
          ...kinhGuiParagraphs,
          new Paragraph({ spacing: { before: 60, after: 60 } }),
          outerBoxTable,
        ],
      },
    ],
  });

  return Packer.toBuffer(wordDoc);
}
