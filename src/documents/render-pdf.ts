/**
 * Render file PDF chuẩn định dạng PDF 1.4 nhẹ, tương thích 100% không cần thư viện ngoài cồng kềnh.
 * Tự động tạo trang, canh lề, tiêu đề, đoạn văn và bảng biểu.
 */

export type PdfSection = {
  title?: string;
  paragraphs?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
};

/**
 * Xóa dấu tiếng Việt sang dạng không dấu an toàn cho chuẩn Type1 font PDF tiêu chuẩn (Helvetica)
 * để đảm bảo file PDF mở ở mọi trình đọc Acrobat/Browser mà không bị vỡ font.
 */
function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Tạo file PDF dạng buffer
 */
export function renderPdf(title: string, sections: PdfSection[]): Buffer {
  const safeTitle = removeVietnameseDiacritics(title);
  const streams: string[] = [];

  // Khởi tạo nội dung trang
  let pageContent = "";
  let y = 780; // Tọa độ Y từ trên xuống dưới (khổ A4: 595 x 842 pt)

  // Tiêu đề chính
  pageContent += "BT /F1 20 Tf 50 " + y + " Td (" + escapePdfText(safeTitle) + ") Tj ET\n";
  y -= 30;

  // Đường kẻ ngang dưới tiêu đề
  pageContent += "0.2 w 50 " + y + " m 545 " + y + " l S\n";
  y -= 25;

  for (const sec of sections) {
    if (y < 100) {
      // Sang trang mới nếu hết chỗ
      pageContent += "BT /F2 9 Tf 250 30 Td (- Trang -) Tj ET\n";
      streams.push(pageContent);
      pageContent = "";
      y = 800;
    }

    if (sec.title) {
      const safeSecTitle = removeVietnameseDiacritics(sec.title);
      pageContent += "BT /F1 14 Tf 50 " + y + " Td (" + escapePdfText(safeSecTitle) + ") Tj ET\n";
      y -= 20;
    }

    if (sec.paragraphs) {
      for (const p of sec.paragraphs) {
        const safeP = removeVietnameseDiacritics(p);
        // Cắt dòng đơn giản nếu quá dài
        const words = safeP.split(" ");
        let line = "";
        for (const w of words) {
          if ((line + " " + w).length > 80) {
            pageContent += "BT /F2 11 Tf 50 " + y + " Td (" + escapePdfText(line.trim()) + ") Tj ET\n";
            y -= 15;
            line = w;
            if (y < 80) break;
          } else {
            line += (line ? " " : "") + w;
          }
        }
        if (line && y >= 80) {
          pageContent += "BT /F2 11 Tf 50 " + y + " Td (" + escapePdfText(line.trim()) + ") Tj ET\n";
          y -= 18;
        }
      }
    }

    if (sec.table && sec.table.headers.length > 0) {
      const cols = sec.table.headers.length;
      const colWidth = Math.floor(495 / cols);

      // Header row
      pageContent += "0.9 g 50 " + (y - 5) + " 495 18 re f 0 g\n";
      for (let i = 0; i < cols; i++) {
        const h = removeVietnameseDiacritics(sec.table.headers[i] ?? "");
        const x = 55 + i * colWidth;
        pageContent += "BT /F1 10 Tf " + x + " " + y + " Td (" + escapePdfText(h) + ") Tj ET\n";
      }
      y -= 18;

      // Table rows
      for (const row of sec.table.rows) {
        if (y < 80) break;
        pageContent += "0.8 w 50 " + (y - 4) + " m 545 " + (y - 4) + " l S\n";
        for (let i = 0; i < cols; i++) {
          const val = removeVietnameseDiacritics(row[i] ?? "");
          const x = 55 + i * colWidth;
          pageContent += "BT /F2 10 Tf " + x + " " + y + " Td (" + escapePdfText(val) + ") Tj ET\n";
        }
        y -= 16;
      }
      y -= 15;
    }
  }

  // Footer trang cuối
  pageContent += "BT /F2 9 Tf 220 30 Td (Xuat tu Zalo Agent) Tj ET\n";
  streams.push(pageContent);

  // Dựng cấu trúc PDF
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  function addObj(content: string): number {
    offsets.push(pdf.length);
    const objNum = offsets.length;
    pdf += objNum + " 0 obj\n" + content + "\nendobj\n";
    return objNum;
  }

  // 1: Catalog
  // 2: Pages
  // 3: Font Helvetica-Bold
  // 4: Font Helvetica
  // 5..: Page & Contents
  const fontBoldObj = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const fontNormObj = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const pageObjIds: number[] = [];
  const contentObjIds: number[] = [];

  for (const s of streams) {
    const contentObj = addObj("<< /Length " + s.length + " >>\nstream\n" + s + "\nendstream");
    contentObjIds.push(contentObj);
  }

  const pagesObjIndex = offsets.length + 1; // placeholder

  for (let i = 0; i < streams.length; i++) {
    const pageObj = addObj(
      "<< /Type /Page /Parent " +
        pagesObjIndex +
        " 0 R /MediaBox [0 0 595 842] /Contents " +
        contentObjIds[i] +
        " 0 R /Resources << /Font << /F1 " +
        fontBoldObj +
        " 0 R /F2 " +
        fontNormObj +
        " 0 R >> >> >>",
    );
    pageObjIds.push(pageObj);
  }

  const pagesObj = addObj(
    "<< /Type /Pages /Kids [" + pageObjIds.map((id) => id + " 0 R").join(" ") + "] /Count " + pageObjIds.length + " >>",
  );
  const catalogObj = addObj("<< /Type /Catalog /Pages " + pagesObj + " 0 R >>");

  const startxref = pdf.length;
  pdf += "xref\n0 " + (offsets.length + 1) + "\n0000000000 65535 f \n";
  for (const o of offsets) {
    pdf += String(o).padStart(10, "0") + " 00000 n \n";
  }
  pdf += "trailer\n<< /Size " + (offsets.length + 1) + " /Root " + catalogObj + " 0 R >>\nstartxref\n" + startxref + "\n%%EOF";

  return Buffer.from(pdf, "binary");
}
