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
 * Tách dòng cơ quan hành chính chuẩn NĐ30:
 * - Nếu là cơ quan cấp trên của Sở/Ngành (isCapTren = true): viết tắt "UBND TỈNH [TÊN]" trên 1 dòng duy nhất.
 * - Nếu là chính cơ quan ban hành (isCapTren = false): nhảy dòng ngay trước "TỈNH", "THÀNH PHỐ", "HUYỆN"...
 */
function splitAgencyLines(name: string, isCapTren = false): string[] {
  if (!name || !name.trim()) return [];
  const trimmed = name.trim();
  if (trimmed.includes("\n")) {
    return trimmed.split("\n").map(s => s.trim()).filter(Boolean);
  }

  // Khi là cơ quan chủ quản cấp trên của Sở/Ngành (ví dụ: Sở Tài chính, Sở Công Thương)
  // Mẫu chuẩn thực tế các Sở: "UBND TỈNH LÂM ĐỒNG" trên 1 dòng duy nhất
  if (isCapTren) {
    const capTrenMatch = trimmed.match(/^(?:ỦY BAN NHÂN DÂN|UBND)\s+(TỈNH|THÀNH PHỐ|TP\.?|HUYỆN|THỊ XÃ|TX\.?)\s+(.+)$/i);
    if (capTrenMatch) {
      const type = capTrenMatch[1]!.trim().toUpperCase();
      const place = capTrenMatch[2]!.trim().toUpperCase();
      return [`UBND ${type} ${place}`];
    }
    return [trimmed.toUpperCase()];
  }

  // Khi là cơ quan ban hành trực tiếp (ví dụ: văn bản do UBND tỉnh ban hành)
  const regex = /^(ỦY BAN NHÂN DÂN|HỘI ĐỒNG NHÂN DÂN|UBND|HĐND)\s+(TỈNH|THÀNH PHỐ|TP\.?|HUYỆN|THỊ XÃ|TX\.?|XÃ|PHƯỜNG|ĐẶC KHU)\s+(.+)$/i;
  const match = trimmed.match(regex);
  if (match) {
    const org = match[1]!.trim().toUpperCase();
    const locType = match[2]!.trim().toUpperCase();
    const locName = match[3]!.trim().toUpperCase();
    return [org, `${locType} ${locName}`];
  }

  return [trimmed.toUpperCase()];
}

/**
 * 1. Dựng Header bảng 2 cột: Cơ quan ban hành | Quốc hiệu & Tiêu ngữ
 */
function buildAdminHeader(doc: AdminDocument): Table {
  // --- ROW 0: CƠ QUAN BAN HÀNH (TRÁI) & QUỐC HIỆU, TIÊU NGỮ (PHẢI) ---
  const row0Left: Paragraph[] = [];

  // Cơ quan chủ quản cấp trên (nếu có, ví dụ "UBND TỈNH LÂM ĐỒNG")
  if (doc.coQuanCapTren?.trim()) {
    const capTrenLines = splitAgencyLines(doc.coQuanCapTren, true);
    for (const line of capTrenLines) {
      row0Left.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({
              text: line,
              font: LAYOUT.FONT,
              size: 26, // 13pt
            }),
          ],
        }),
      );
    }
  }

  // Cơ quan ban hành (IN HOA ĐẬM, ví dụ "SỞ TÀI CHÍNH" hoặc "ỦY BAN NHÂN DÂN / TỈNH LÂM ĐỒNG")
  const banHanhLines = splitAgencyLines(doc.coQuanBanHanh, false);
  for (const line of banHanhLines) {
    row0Left.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: line,
            font: LAYOUT.FONT,
            size: 26,
            bold: true, // 13pt Đậm
          }),
        ],
      }),
    );
  }

  // Đường kẻ phân cách dưới tên cơ quan (1/3 đến 1/2 bề rộng)
  row0Left.push(
    new Paragraph({
      spacing: { before: 20, after: 60 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 2, color: "000000", space: 1 },
      },
      indent: { left: 1400, right: 1400 },
    }),
  );

  const row0Right: Paragraph[] = [
    // Quốc hiệu (13pt, ĐẬM, IN HOA)
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
          font: LAYOUT.FONT,
          size: 26,
          bold: true,
        }),
      ],
    }),
    // Tiêu ngữ (14pt, ĐẬM, in thường)
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          text: "Độc lập - Tự do - Hạnh phúc",
          font: LAYOUT.FONT,
          size: 28,
          bold: true,
        }),
      ],
    }),
    // Đường kẻ phân cách dưới Tiêu ngữ (dài bằng độ dài tiêu ngữ)
    new Paragraph({
      spacing: { before: 20, after: 60 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 2, color: "000000", space: 1 },
      },
      indent: { left: 1000, right: 1000 },
    }),
  ];

  // --- ROW 1: SỐ KÝ HIỆU + TRÍCH YẾU (TRÁI) & ĐỊA DANH NGÀY THÁNG (PHẢI) ---
  const row1Left: Paragraph[] = [];
  const soKH = doc.soKyHieu?.trim() || "Số:      /UBND-NC";
  row1Left.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 0 },
      children: [
        new TextRun({
          text: soKH,
          font: LAYOUT.FONT,
          size: 26, // 13pt
        }),
      ],
    }),
  );

  // V/v Trích yếu đối với Công văn (cỡ 12-13pt, kiểu chữ ĐỨNG theo NĐ 30 Phụ lục I mục II.4.b)
  if (doc.loaiVanBan === "cong_van" && doc.trichYeu?.trim()) {
    const lines = doc.trichYeu.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) continue;
      row1Left.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: i === 0 ? 60 : 20, after: 0 },
          children: [
            new TextRun({
              text: line.startsWith("V/v") || i > 0 ? line : `V/v ${line}`,
              font: LAYOUT.FONT,
              size: 24, // 12pt (chữ ĐỨNG chuẩn NĐ 30, KHÔNG ĐƯỢC IN NGHIÊNG)
              italics: false,
            }),
          ],
        }),
      );
    }
  }

  const row1Right: Paragraph[] = [];
  const ngay = doc.ngay || "    ";
  const thang = doc.thang || "    ";
  const nam = doc.nam || "2026";
  const diaDanh = doc.diaDanh || "Lâm Đồng";
  row1Right.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 0 },
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
            children: row0Left,
          }),
          new TableCell({
            borders: BORDERS_NONE,
            width: { size: LAYOUT.HEADER_COLS.right, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: row0Right,
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: BORDERS_NONE,
            width: { size: LAYOUT.HEADER_COLS.left, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: row1Left,
          }),
          new TableCell({
            borders: BORDERS_NONE,
            width: { size: LAYOUT.HEADER_COLS.right, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: row1Right,
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

  if (kinhGui.length === 1) {
    // 1 cơ quan nhận (như Sở gửi "Kính gửi: UBND tỉnh Lâm Đồng"): căn giữa trang
    elements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 280, after: 140 },
        children: [
          new TextRun({
            text: "Kính gửi: ",
            font: LAYOUT.FONT,
            size: 28, // 14pt
            italics: false,
          }),
          new TextRun({
            text: kinhGui[0]!,
            font: LAYOUT.FONT,
            size: 28,
          }),
        ],
      }),
    );
  } else {
    // Nhiều cơ quan nhận
    elements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 280, after: 60 },
        children: [
          new TextRun({
            text: "Kính gửi:",
            font: LAYOUT.FONT,
            size: 28,
          }),
        ],
      }),
    );

    for (let i = 0; i < kinhGui.length; i++) {
      const suffix = i === kinhGui.length - 1 ? "." : ";";
      elements.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 20, after: 20, line: 340, lineRule: LineRuleType.AT_LEAST },
          indent: { left: 2800 },
          children: [
            new TextRun({
              text: `- ${kinhGui[i]}${suffix}`,
              font: LAYOUT.FONT,
              size: 28,
            }),
          ],
        }),
      );
    }
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
        children: parseTextRuns(text, {
          font: LAYOUT.FONT,
          size: 28, // 14pt
          italics: true, // In nghiêng theo NĐ 30
        }),
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
              children: parseTextRuns(h.trim(), {
                font: LAYOUT.FONT,
                size: 24, // 12pt
                bold: true,
              }),
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

  // Xác định vị trí phần tử văn bản cuối cùng trong toàn bộ sections để gắn dấu ./.
  let lastSecIdx = -1;
  let lastType: "paragraph" | "item" | null = null;
  let lastItemIdx = -1;

  for (let sIdx = sections.length - 1; sIdx >= 0; sIdx--) {
    const sec = sections[sIdx]!;
    if (sec.items && sec.items.length > 0) {
      for (let iIdx = sec.items.length - 1; iIdx >= 0; iIdx--) {
        if (sec.items[iIdx]?.trim()) {
          lastSecIdx = sIdx;
          lastType = "item";
          lastItemIdx = iIdx;
          break;
        }
      }
    }
    if (lastSecIdx !== -1) break;

    if (sec.paragraphs && sec.paragraphs.length > 0) {
      for (let pIdx = sec.paragraphs.length - 1; pIdx >= 0; pIdx--) {
        if (sec.paragraphs[pIdx]?.trim()) {
          lastSecIdx = sIdx;
          lastType = "paragraph";
          lastItemIdx = pIdx;
          break;
        }
      }
    }
    if (lastSecIdx !== -1) break;
  }

  // Hàm phụ gắn dấu ./. vào chuỗi văn bản cuối cùng (không bao giờ để ./. thành dòng riêng)
  const attachDauKetThuc = (text: string): string => {
    let t = text.trim();
    while (t.endsWith("./.") || t.endsWith(".")) {
      if (t.endsWith("./.")) return t;
      t = t.slice(0, -1).trimEnd();
    }
    return `${t}./.`;
  };

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const sec = sections[sIdx]!;

    // Tiêu đề mục (Chương, Mục, Điều, La Mã, số Ả Rập...)
    if (sec.heading?.trim()) {
      const headingText = sec.heading.trim();
      const isChapter = /^(Chương|Phần)\s+[IVXLCDM\d]+/i.test(headingText);
      const isMuc = /^Mục\s+\d+/i.test(headingText);
      const isArticle = /^Điều\s+\d+/i.test(headingText);
      const isCenter = isChapter || isMuc;

      elements.push(
        new Paragraph({
          alignment: isCenter
            ? AlignmentType.CENTER
            : isArticle
              ? AlignmentType.JUSTIFIED
              : AlignmentType.LEFT,
          spacing: { before: 200, after: 80, line: 340, lineRule: LineRuleType.AT_LEAST },
          indent: isCenter ? undefined : { firstLine: LAYOUT.FIRST_LINE_INDENT },
          children: parseTextRuns(headingText, {
            font: LAYOUT.FONT,
            size: 28, // 14pt
            bold: true,
          }),
        }),
      );
    }

    // Các đoạn văn xuôi
    for (let pIdx = 0; pIdx < sec.paragraphs.length; pIdx++) {
      let p = sec.paragraphs[pIdx]!.trim();
      if (!p) continue;

      // Nếu là đoạn văn bản cuối cùng của toàn bộ văn bản, gắn liền dấu ./.
      if (sIdx === lastSecIdx && lastType === "paragraph" && pIdx === lastItemIdx) {
        p = attachDauKetThuc(p);
      }

      // Tự động nhận diện và bôi đậm đề mục con dạng "1. Tiêu đề:" hoặc "a) Tiêu đề:"
      const matchPrefix = p.match(/^(([IVXLCDM]+[\.\-]|\d+[\.\)]|[a-zđ]\))\s+[^:\n]{2,80}:)\s*(.*)$/i);
      let pChildren: TextRun[];
      if (matchPrefix && !p.includes("**")) {
        const titlePart = matchPrefix[1]!;
        const restPart = matchPrefix[3]!;
        pChildren = [
          new TextRun({ text: titlePart, font: LAYOUT.FONT, size: 28, bold: true }),
          ...(restPart ? [new TextRun({ text: ` ${restPart}`, font: LAYOUT.FONT, size: 28 })] : []),
        ];
      } else {
        pChildren = parseTextRuns(p, { font: LAYOUT.FONT, size: 28 });
      }

      elements.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: BODY_SPACING,
          indent: { firstLine: LAYOUT.FIRST_LINE_INDENT },
          children: pChildren,
        }),
      );
    }

    // Các gạch đầu dòng liệt kê
    if (sec.items && sec.items.length > 0) {
      for (let iIdx = 0; iIdx < sec.items.length; iIdx++) {
        let item = sec.items[iIdx]!.trim();
        if (!item) continue;

        // Nếu là điểm liệt kê cuối cùng của văn bản, gắn liền dấu ./.
        if (sIdx === lastSecIdx && lastType === "item" && iIdx === lastItemIdx) {
          item = attachDauKetThuc(item);
        }

        const itemText = item.startsWith("-") ? item : `- ${item}`;
        elements.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 60, after: 60, line: 340, lineRule: LineRuleType.AT_LEAST },
            indent: { left: 850, hanging: 283 }, // Thụt lề điểm liệt kê (hanging)
            children: parseTextRuns(itemText, {
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

  // Không tạo thêm Paragraph riêng chứa ./. để tránh dư dòng trống!
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
  for (let i = 0; i < noiNhanList.length; i++) {
    const isLast = i === noiNhanList.length - 1;
    let itemText = noiNhanList[i]!.trim();
    // Bắt buộc chuẩn hóa: thay thế "Như kính gửi" thành "Như trên" theo Nghị định 30/2020/NĐ-CP
    if (/^-?\s*như\s+kính\s+gửi/i.test(itemText)) {
      itemText = itemText.replace(/^-?\s*như\s+kính\s+gửi/i, "Như trên");
    }
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
            size: 22, // 11pt
          }),
        ],
      }),
    );
  }

  // --- CỘT PHẢI: CHỨC VỤ & CHỮ KÝ ---
  const rightChildren: Paragraph[] = [];

  const chucVuLines = doc.chucVuNguoiKy.split(/\\n|\n/);
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
