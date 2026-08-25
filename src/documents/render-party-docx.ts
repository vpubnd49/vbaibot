import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
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

// ====== THÔNG SỐ THỂ THỨC VĂN BẢN ĐẢNG CHUẨN HƯỚNG DẪN 05-HD/VPTW ======
const LAYOUT = {
  PAGE: { width: 11906, height: 16838 },
  MARGIN: {
    top: 1134, // 20mm
    bottom: 1134, // 20mm
    left: 1701, // 30mm
    right: 850, // 15mm (Khác NĐ 30: 15mm)
  },
  FONT: "Times New Roman",
  CONTENT_WIDTH: 9355, // 11906 - 1701 - 850
  HEADER_COLS: {
    left: 4000,
    right: 5355,
  },
  SIGNATURE_COLS: {
    left: 4400,
    right: 4955,
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


const PARTY_BODY_SPACING = {
  before: 120, // 6pt
  after: 0,
  line: 360, // 18pt EXACTLY (theo HD 05)
  lineRule: LineRuleType.EXACTLY,
};

function buildPartyHeader(doc: AdminDocument): Table {
  const leftChildren: Paragraph[] = [];

  if (doc.coQuanCapTren?.trim()) {
    leftChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [
          new TextRun({
            text: doc.coQuanCapTren.trim().toUpperCase(),
            font: LAYOUT.FONT,
            size: 26,
          }),
        ],
      }),
    );
  }

  leftChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({
          text: doc.coQuanBanHanh.trim().toUpperCase(),
          font: LAYOUT.FONT,
          size: 26,
          bold: true,
        }),
      ],
    }),
  );

  // Dấu sao * dưới tên cơ quan Đảng
  leftChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: "*",
          font: LAYOUT.FONT,
          size: 24,
          bold: true,
        }),
      ],
    }),
  );

  // Số ký hiệu (Số XX-NQ/TU hoặc Số XX-CV/VPTW)
  const soKH = doc.soKyHieu?.trim() || "Số:     -NQ/TU";
  leftChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          text: soKH,
          font: LAYOUT.FONT,
          size: 26,
        }),
      ],
    }),
  );

  const rightChildren: Paragraph[] = [];

  // Khẩu hiệu Đảng (ĐẢNG CỘNG SẢN VIỆT NAM)
  rightChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({
          text: "ĐẢNG CỘNG SẢN VIỆT NAM",
          font: LAYOUT.FONT,
          size: 28,
          bold: true,
        }),
      ],
    }),
  );

  const ngay = doc.ngay || "    ";
  const thang = doc.thang || "    ";
  const nam = doc.nam || "2026";
  const diaDanh = doc.diaDanh || "Lâm Đồng";
  rightChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 0 },
      children: [
        new TextRun({
          text: `${diaDanh}, ngày ${ngay} tháng ${thang} năm ${nam}`,
          font: LAYOUT.FONT,
          size: 28,
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

function buildPartyTitle(doc: AdminDocument): Paragraph[] {
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
            size: 28,
            bold: true,
          }),
        ],
      }),
    );
  }

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
              size: 28,
              bold: true,
            }),
          ],
        }),
      );
    }
  }

  return elements;
}

function buildPartyKinhGui(doc: AdminDocument): Paragraph[] {
  if (!doc.kinhGui || doc.kinhGui.length === 0) return [];
  const elements: Paragraph[] = [];
  // Đối với Tờ trình Đảng (HD05): dùng Kính trình, các loại khác dùng Kính gửi
  const label = doc.loaiVanBan === "to_trinh" ? "Kính trình: " : "Kính gửi: ";

  const first = doc.kinhGui[0]!;
  elements.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: PARTY_BODY_SPACING,
      indent: { firstLine: LAYOUT.FIRST_LINE_INDENT },
      children: [
        new TextRun({
          text: label,
          font: LAYOUT.FONT,
          size: 28,
        }),
        new TextRun({
          text: first,
          font: LAYOUT.FONT,
          size: 28,
        }),
      ],
    }),
  );

  for (let i = 1; i < doc.kinhGui.length; i++) {
    elements.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 40, after: 0, line: 360, lineRule: LineRuleType.EXACTLY },
        indent: { left: 1400 },
        children: [
          new TextRun({
            text: `- ${doc.kinhGui[i]}`,
            font: LAYOUT.FONT,
            size: 28,
          }),
        ],
      }),
    );
  }

  return elements;
}

function buildPartyCanCu(canCu?: string[]): Paragraph[] {
  if (!canCu || canCu.length === 0) return [];
  const elements: Paragraph[] = [];

  for (let i = 0; i < canCu.length; i++) {
    let text = canCu[i]!.trim();
    if (!text.startsWith("Căn cứ")) {
      text = `Căn cứ ${text}`;
    }
    if (i === canCu.length - 1) {
      if (!text.endsWith(",")) text = text.replace(/[,;.]$/, "") + ",";
    } else {
      if (!text.endsWith(";")) text = text.replace(/[,;.]$/, "") + ";";
    }

    elements.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: PARTY_BODY_SPACING,
        indent: { firstLine: LAYOUT.FIRST_LINE_INDENT },
        children: [
          new TextRun({
            text,
            font: LAYOUT.FONT,
            size: 28,
            italics: true,
          }),
        ],
      }),
    );
  }

  return elements;
}

function buildPartyBody(sections: AdminSection[]): Paragraph[] {
  const elements: Paragraph[] = [];

  for (const sec of sections) {
    if (sec.heading?.trim()) {
      elements.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 200, after: 80, line: 360, lineRule: LineRuleType.EXACTLY },
          children: [
            new TextRun({
              text: sec.heading.trim(),
              font: LAYOUT.FONT,
              size: 28,
              bold: true,
            }),
          ],
        }),
      );
    }

    for (const p of sec.paragraphs) {
      if (!p.trim()) continue;
      elements.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: PARTY_BODY_SPACING,
          indent: { firstLine: LAYOUT.FIRST_LINE_INDENT },
          children: parseTextRuns(p.trim(), { font: LAYOUT.FONT, size: 28 }),
        }),
      );
    }

    if (sec.items && sec.items.length > 0) {
      for (const item of sec.items) {
        if (!item.trim()) continue;
        elements.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 60, after: 60, line: 360, lineRule: LineRuleType.EXACTLY },
            indent: { left: 850, hanging: 283 },
            children: parseTextRuns(item.trim().startsWith("-") ? item.trim() : `- ${item.trim()}`, {
              font: LAYOUT.FONT,
              size: 28,
            }),
          }),
        );
      }
    }
  }

  return elements;
}

function buildPartySignature(doc: AdminDocument): Table {
  const leftChildren: Paragraph[] = [];

  // Nơi nhận có gạch chân trong văn bản Đảng
  leftChildren.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: "Nơi nhận:",
          font: LAYOUT.FONT,
          size: 24,
          underline: { type: UnderlineType.SINGLE },
        }),
      ],
    }),
  );

  const noiNhanList = doc.noiNhan && doc.noiNhan.length > 0 ? doc.noiNhan : ["Như trên", "Lưu: VP"];
  for (let i = 0; i < noiNhanList.length; i++) {
    const isLast = i === noiNhanList.length - 1;
    let itemText = noiNhanList[i]!.trim();
    if (!itemText.startsWith("-")) itemText = `- ${itemText}`;
    if (isLast) {
      if (!itemText.endsWith(".")) itemText = itemText.replace(/[,;]$/, "") + ".";
    } else {
      if (!itemText.endsWith(";")) itemText = itemText.replace(/[,.]$/, "") + ";";
    }

    leftChildren.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 20, after: 20, line: 240, lineRule: LineRuleType.AUTO },
        children: [
          new TextRun({
            text: itemText,
            font: LAYOUT.FONT,
            size: 22,
          }),
        ],
      }),
    );
  }

  const rightChildren: Paragraph[] = [];

  // Chuẩn hóa T/M, K/T, T/L
  let chucVu = doc.chucVuNguoiKy.replace(/\bTM\./g, "T/M ").replace(/\bKT\./g, "K/T ").replace(/\bTL\./g, "T/L ");
  const chucVuLines = chucVu.split("\n");
  for (const line of chucVuLines) {
    rightChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 20 },
        children: [
          new TextRun({
            text: line.trim().toUpperCase(),
            font: LAYOUT.FONT,
            size: 28,
            bold: true,
          }),
        ],
      }),
    );
  }

  for (let i = 0; i < 4; i++) {
    rightChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO },
        children: [new TextRun({ text: "" })],
      }),
    );
  }

  if (doc.hoTenNguoiKy?.trim()) {
    rightChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 0 },
        children: [
          new TextRun({
            text: doc.hoTenNguoiKy.trim(),
            font: LAYOUT.FONT,
            size: 28,
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

export async function renderPartyDocx(doc: AdminDocument): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(buildPartyHeader(doc));
  children.push(...buildPartyTitle(doc));
  children.push(...buildPartyKinhGui(doc));
  children.push(...buildPartyCanCu(doc.canCuPhapLy));
  children.push(...buildPartyBody(doc.sections));
  children.push(buildPartySignature(doc));

  const pageHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: LAYOUT.FONT,
            size: 27,
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
      titlePage: true,
    },
    headers: {
      default: pageHeader,
      first: new Header({ children: [] }),
    },
    children,
  };

  const wordDoc = new Document({
    sections: [section],
  });

  return Packer.toBuffer(wordDoc);
}
