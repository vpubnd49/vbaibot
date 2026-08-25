import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ISectionOptions,
} from "docx";
import {
  TEN_LOAI_TIENG_VIET,
  type AdminDocument,
  type AdminSection,
} from "./admin-document-schema.js";
import { parseTextRuns } from "./docx-text-runs.js";

// ====== THÔNG SỐ THỂ THỨC CHUẨN NGHỊ ĐỊNH 30/2020/NĐ-CP ======
const LAYOUT = {
  PAGE: { width: 11906, height: 16838 }, // Khổ A4 tiêu chuẩn (210 x 297 mm)
  MARGIN: {
    top: 1134, // 20mm
    bottom: 1134, // 20mm
    left: 1701, // 30mm (chừa đóng gáy)
    right: 1134, // 20mm (theo NĐ 30)
  },
  FONT: "Times New Roman",
  CONTENT_WIDTH: 9071, // 11906 - 1701 - 1134
  HEADER_COLS: {
    left: 3600, // Cột trái: Cơ quan ban hành
    right: 5471, // Cột phải: Quốc hiệu, Tiêu ngữ, Ngày tháng
  },
  SIGNATURE_COLS: {
    left: 4300, // Nơi nhận
    right: 4771, // Chữ ký
  },
  FIRST_LINE_INDENT: 567, // Thụt đầu dòng 1cm
};

const BORDERS_NONE = {
  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
};

const TABLE_BORDER_THIN = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
};

const BODY_SPACING = {
  before: 120, // 6pt
  after: 0,
  line: 340, // ~17pt (LineRuleType.AT_LEAST)
  lineRule: LineRuleType.AT_LEAST,
};

/**
 * 1. Dựng Header bảng 2 cột: Cơ quan ban hành | Quốc hiệu & Tiêu ngữ
 */
function buildAdminHeader(doc: AdminDocument): Table {
  const leftChildren: Paragraph[] = [];

  // Cơ quan chủ quản cấp trên (nếu có)
  if (doc.coQuanCapTren?.trim()) {
    leftChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [
          new TextRun({
            text: doc.coQuanCapTren.trim().toUpperCase(),
            font: LAYOUT.FONT,
            size: 26, // 13pt
          }),
        ],
      }),
    );
  }

  // Cơ quan ban hành (IN HOA ĐẬM)
  leftChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({
          text: doc.coQuanBanHanh.trim().toUpperCase(),
          font: LAYOUT.FONT,
          size: 26,
          bold: true, // 13pt Đậm
        }),
      ],
    }),
  );

  // Đường kẻ phân cách dưới tên cơ quan (1/3 đến 1/2 bề rộng)
  leftChildren.push(
    new Paragraph({
      spacing: { before: 20, after: 60 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 2, color: "000000", space: 1 },
      },
      indent: { left: 1400, right: 1400 },
    }),
  );

  // Số ký hiệu
  const soKH = doc.soKyHieu?.trim() || "Số:      /TTr-UBND";
  leftChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          text: soKH,
          font: LAYOUT.FONT,
          size: 26, // 13pt
        }),
      ],
    }),
  );

  // V/v Trích yếu đối với Công văn (cỡ 12pt, nghiêng)
  if (doc.loaiVanBan === "cong_van" && doc.trichYeu?.trim()) {
    const lines = doc.trichYeu.split("\n");
    for (const line of lines) {
      leftChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 20, after: 0 },
          children: [
            new TextRun({
              text: line.trim().startsWith("V/v") ? line.trim() : `V/v ${line.trim()}`,
              font: LAYOUT.FONT,
              size: 24, // 12pt
              italics: true,
            }),
          ],
        }),
      );
    }
  }

  // --- CỘT PHẢI: QUỐC HIỆU, TIÊU NGỮ, NGÀY THÁNG ---
  const rightChildren: Paragraph[] = [];

  // Quốc hiệu (13pt, ĐẬM, IN HOA)
  rightChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({
          text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
          font: LAYOUT.FONT,
          size: 26,
          bold: true,
        }),
      ],
    }),
  );

  // Tiêu ngữ (14pt, ĐẬM, in thường)
  rightChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({
          text: "Độc lập - Tự do - Hạnh phúc",
          font: LAYOUT.FONT,
          size: 28,
          bold: true,
        }),
      ],
    }),
  );

  // Đường kẻ phân cách dưới Tiêu ngữ (dài bằng độ dài tiêu ngữ)
  rightChildren.push(
    new Paragraph({
      spacing: { before: 20, after: 0 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 2, color: "000000", space: 1 },
      },
      indent: { left: 1000, right: 1000 },
    }),
  );

  // Địa danh, ngày tháng (14pt, nghiêng)
  const ngay = doc.ngay || "    ";
  const thang = doc.thang || "    ";
  const nam = doc.nam || "2026";
  const diaDanh = doc.diaDanh || "Lâm Đồng";
  rightChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 0 },
      children: [
        new TextRun({
          text: `${diaDanh}, ngày ${ngay} tháng ${thang} năm ${nam}`,
          font: LAYOUT.FONT,
          size: 28, // 14pt
          italics: true,
        }),
      ],
    }),
  );

  return new Table({
    width: { size: LAYOUT.CONTENT_WIDTH, type: WidthType.DXA },
    borders: BORDERS_NONE,
    columnWidths: [LAYOUT.HEADER_COLS.left, LAYOUT.HEADER_COLS.right],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: BORDERS_NONE,
            width: { size: LAYOUT.HEADER_COLS.left, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: leftChildren,
          }),
          new TableCell({
            borders: BORDERS_NONE,
            width: { size: LAYOUT.HEADER_COLS.right, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: rightChildren,
          }),
        ],
      }),
    ],
  });
}

/**
 * 2. Dựng Tiêu đề tên loại văn bản và Trích yếu
 */
function buildAdminTitle(doc: AdminDocument): Paragraph[] {
  const elements: Paragraph[] = [];
  if (doc.loaiVanBan === "cong_van") return elements;

  const tenLoai = TEN_LOAI_TIENG_VIET[doc.loaiVanBan] || doc.loaiVanBan.toUpperCase();
  if (tenLoai) {
    elements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 0 },
        children: [
          new TextRun({
            text: tenLoai,
            font: LAYOUT.FONT,
            size: 28, // 14pt
            bold: true,
          }),
        ],
      }),
    );
  }

  // Trích yếu nội dung
  if (doc.trichYeu?.trim()) {
    const lines = doc.trichYeu.split("\n");
    for (const line of lines) {
      elements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 0 },
          children: [
            new TextRun({
              text: line.trim(),
              font: LAYOUT.FONT,
              size: 28, // 14pt
              bold: true,
            }),
          ],
        }),
      );
    }

    // Đường gạch mảnh dưới trích yếu đối với Quyết định / Tờ trình
    elements.push(
      new Paragraph({
        spacing: { before: 40, after: 120 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 2, color: "000000", space: 1 },
        },
        indent: { left: 3000, right: 3000 },
      }),
    );
  }

  return elements;
}

/**
 * 3. Dựng phần Kính gửi (nếu có)
 */
function buildAdminKinhGui(kinhGui?: string[]): Paragraph[] {
  if (!kinhGui || kinhGui.length === 0) return [];
  const elements: Paragraph[] = [];

  const first = kinhGui[0]!;
  elements.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: BODY_SPACING,
      indent: { firstLine: LAYOUT.FIRST_LINE_INDENT },
      children: [
        new TextRun({
          text: "Kính gửi: ",
          font: LAYOUT.FONT,
          size: 28, // 14pt
          italics: false,
        }),
        new TextRun({
          text: first,
          font: LAYOUT.FONT,
          size: 28,
        }),
      ],
    }),
  );

  for (let i = 1; i < kinhGui.length; i++) {
    elements.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 40, after: 0, line: 340, lineRule: LineRuleType.AT_LEAST },
        indent: { left: 1400 },
        children: [
          new TextRun({
            text: `- ${kinhGui[i]}`,
            font: LAYOUT.FONT,
            size: 28,
          }),
        ],
      }),
    );
  }

  return elements;
}

/**
 * 4. Dựng hệ thống Căn cứ pháp lý
 */
function buildAdminCanCu(canCu?: string[]): Paragraph[] {
  if (!canCu || canCu.length === 0) return [];
  const elements: Paragraph[] = [];

  for (let i = 0; i < canCu.length; i++) {
    let text = canCu[i]!.trim();
    if (!text.startsWith("Căn cứ")) {
      text = `Căn cứ ${text}`;
    }
    // Dấu kết thúc: căn cứ cuối là dấu chấm, các căn cứ trước là chấm phẩy
    if (i === canCu.length - 1) {
      if (!text.endsWith(".")) text = text.replace(/[,;]$/, "") + ".";
    } else {
      if (!text.endsWith(";")) text = text.replace(/[,.]$/, "") + ";";
    }

    elements.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: BODY_SPACING,
        indent: { firstLine: LAYOUT.FIRST_LINE_INDENT },
        children: [
          new TextRun({
            text,
            font: LAYOUT.FONT,
            size: 28, // 14pt
            italics: true, // In nghiêng theo NĐ 30
          }),
        ],
      }),
    );
  }

  return elements;
}

/**
 * 5. Dựng Bảng nội dung có viền (nếu có bảng trong section)
 */
function buildSectionTable(headers: string[], rows: string[][]): Table {
  const colCount = headers.length;
  const colWidth = Math.floor(LAYOUT.CONTENT_WIDTH / colCount);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          borders: TABLE_BORDER_THIN,
          width: { size: colWidth, type: WidthType.DXA },
          shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
              children: [
                new TextRun({
                  text: h.trim(),
                  font: LAYOUT.FONT,
                  size: 24, // 12pt
                  bold: true,
                }),
              ],
            }),
          ],
        }),
    ),
  });

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map((cellText, idx) => {
          const isNumeric = /^[\d.,% -]+$/.test(cellText.trim());
          const align = idx === 0 ? AlignmentType.CENTER : isNumeric ? AlignmentType.RIGHT : AlignmentType.LEFT;
          return new TableCell({
            borders: TABLE_BORDER_THIN,
            width: { size: colWidth, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: align,
                spacing: { before: 40, after: 40 },
                children: parseTextRuns(cellText.trim(), { font: LAYOUT.FONT, size: 24 }),
              }),
            ],
          });
        }),
      }),
  );

  return new Table({
    width: { size: LAYOUT.CONTENT_WIDTH, type: WidthType.DXA },
    borders: TABLE_BORDER_THIN,
    rows: [headerRow, ...dataRows],
  });
}

/**
 * 6. Dựng Thân văn bản (Các mục, đoạn văn xuôi, gạch đầu dòng, bảng)
 */
function buildAdminBody(sections: AdminSection[]): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  for (const sec of sections) {
    // Tiêu đề mục (I, II, Điều 1, Phần 1...)
    if (sec.heading?.trim()) {
      const isArticle = /^Điều\s+\d+/i.test(sec.heading.trim());
      elements.push(
        new Paragraph({
          alignment: isArticle ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
          spacing: { before: 200, after: 80, line: 340, lineRule: LineRuleType.AT_LEAST },
          indent: isArticle ? { firstLine: LAYOUT.FIRST_LINE_INDENT } : undefined,
          children: [
            new TextRun({
              text: sec.heading.trim(),
              font: LAYOUT.FONT,
              size: 28, // 14pt
              bold: true,
            }),
          ],
        }),
      );
    }

    // Các đoạn văn xuôi
    for (const p of sec.paragraphs) {
      if (!p.trim()) continue;
      elements.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: BODY_SPACING,
          indent: { firstLine: LAYOUT.FIRST_LINE_INDENT },
          children: parseTextRuns(p.trim(), { font: LAYOUT.FONT, size: 28 }),
        }),
      );
    }

    // Các gạch đầu dòng liệt kê
    if (sec.items && sec.items.length > 0) {
      for (const item of sec.items) {
        if (!item.trim()) continue;
        elements.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 60, after: 60, line: 340, lineRule: LineRuleType.AT_LEAST },
            indent: { left: 850, hanging: 283 }, // Thụt lề điểm liệt kê (hanging)
            children: parseTextRuns(item.trim().startsWith("-") ? item.trim() : `- ${item.trim()}`, {
              font: LAYOUT.FONT,
              size: 28,
            }),
          }),
        );
      }
    }

    // Bảng số liệu nếu có
    if (sec.table && sec.table.headers.length > 0) {
      elements.push(new Paragraph({ text: "", spacing: { before: 80, after: 80 } }));
      elements.push(buildSectionTable(sec.table.headers, sec.table.rows));
      elements.push(new Paragraph({ text: "", spacing: { before: 80, after: 80 } }));
    }
  }

  // Ký hiệu kết thúc văn bản ./.
  elements.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 120, after: 120 },
      indent: { firstLine: LAYOUT.FIRST_LINE_INDENT },
      children: [
        new TextRun({
          text: "./.",
          font: LAYOUT.FONT,
          size: 28,
          bold: true,
        }),
      ],
    }),
  );

  return elements;
}

/**
 * 7. Dựng Khối Chữ Ký & Nơi Nhận Cuối Văn Bản
 */
function buildAdminSignature(doc: AdminDocument): Table {
  // --- CỘT TRÁI: NƠI NHẬN ---
  const leftChildren: Paragraph[] = [];

  leftChildren.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: "Nơi nhận:",
          font: LAYOUT.FONT,
          size: 24, // 12pt
          bold: true,
          italics: true,
        }),
      ],
    }),
  );

  const noiNhanList = doc.noiNhan && doc.noiNhan.length > 0 ? doc.noiNhan : ["Như trên", "Lưu: VT"];
  for (const item of noiNhanList) {
    const formatted = item.trim().startsWith("-") ? item.trim() : `- ${item.trim()}`;
    leftChildren.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 20, after: 20, line: 240, lineRule: LineRuleType.AUTO },
        children: [
          new TextRun({
            text: formatted,
            font: LAYOUT.FONT,
            size: 22, // 11pt
          }),
        ],
      }),
    );
  }

  // --- CỘT PHẢI: CHỨC VỤ & CHỮ KÝ ---
  const rightChildren: Paragraph[] = [];

  const chucVuLines = doc.chucVuNguoiKy.split("\n");
  for (const line of chucVuLines) {
    rightChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 20 },
        children: [
          new TextRun({
            text: line.trim().toUpperCase(),
            font: LAYOUT.FONT,
            size: 28, // 14pt
            bold: true,
          }),
        ],
      }),
    );
  }

  // 4 Dòng trống chừa vị trí ký tên và đóng dấu (~70pt)
  for (let i = 0; i < 4; i++) {
    rightChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO },
        children: [new TextRun({ text: "" })],
      }),
    );
  }

  // Họ và tên người ký
  if (doc.hoTenNguoiKy?.trim()) {
    rightChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 0 },
        children: [
          new TextRun({
            text: doc.hoTenNguoiKy.trim(),
            font: LAYOUT.FONT,
            size: 28, // 14pt
            bold: true,
          }),
        ],
      }),
    );
  }

  return new Table({
    width: { size: LAYOUT.CONTENT_WIDTH, type: WidthType.DXA },
    borders: BORDERS_NONE,
    columnWidths: [LAYOUT.SIGNATURE_COLS.left, LAYOUT.SIGNATURE_COLS.right],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: BORDERS_NONE,
            width: { size: LAYOUT.SIGNATURE_COLS.left, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: leftChildren,
          }),
          new TableCell({
            borders: BORDERS_NONE,
            width: { size: LAYOUT.SIGNATURE_COLS.right, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: rightChildren,
          }),
        ],
      }),
    ],
  });
}

/**
 * Hàm Render chính sinh Buffer file .docx chuẩn Nghị định 30/2020/NĐ-CP
 */
export async function renderAdminDocx(doc: AdminDocument): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // 1. Phần Đầu: Header cơ quan & quốc hiệu
  children.push(buildAdminHeader(doc));

  // 2. Tiêu đề tên loại và trích yếu
  children.push(...buildAdminTitle(doc));

  // 3. Kính gửi (nếu có)
  children.push(...buildAdminKinhGui(doc.kinhGui));

  // 4. Căn cứ pháp lý (nếu có)
  children.push(...buildAdminCanCu(doc.canCuPhapLy));

  // 5. Nội dung thân văn bản
  children.push(...buildAdminBody(doc.sections));

  // 6. Khối chữ ký & Nơi nhận
  children.push(buildAdminSignature(doc));

  // Đánh số trang chuẩn NĐ 30: Đỉnh trang (Header), canh giữa, 13.5pt, ẩn ở trang 1
  const pageHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: LAYOUT.FONT,
            size: 27, // 13.5pt
          }),
        ],
      }),
    ],
  });

  const section: ISectionOptions = {
    properties: {
      page: {
        margin: LAYOUT.MARGIN,
      },
      titlePage: true, // Bật differentFirstPageHeaderFooter để ẩn số trang ở trang 1
    },
    headers: {
      default: pageHeader,
      first: new Header({ children: [] }), // Trang 1 không có header số trang
    },
    children,
  };

  const wordDoc = new Document({
    sections: [section],
  });

  return Packer.toBuffer(wordDoc);
}
