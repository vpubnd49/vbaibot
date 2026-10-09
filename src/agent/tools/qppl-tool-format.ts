/**
 * Phần thuần (không gửi Zalo) của qppl_lamdong: lọc file chính thức, lọc theo
 * tháng, định dạng danh sách/chi tiết. Tách từ qppl-lamdong-tool.ts (trước ~500 dòng).
 */
import type { QpplDoc, QpplFileLink, QpplNguon } from "../../qppl/qppl-types.js";
import { getAgencyConfig } from "../../qppl/qppl-registry.js";

function isDraftOrNonPdf(link: QpplFileLink): boolean {
  const lowerName = link.name.toLowerCase();
  const lowerUrl = link.url.toLowerCase();
  const isDoc = /\.(docx?|dotx?)$/i.test(lowerName) || /\.(docx?|dotx?)$/i.test(lowerUrl);
  const isDraft =
    lowerName.includes("du thao") ||
    lowerName.includes("dự thảo") ||
    lowerName.includes("bản thảo") ||
    lowerName.includes("duthao");
  const isPdf = lowerName.endsWith(".pdf") || lowerUrl.endsWith(".pdf");
  return isDoc || isDraft || !isPdf;
}

export function parseFileLinks(fileUrls: string): QpplFileLink[] {
  try {
    const parsed: unknown = JSON.parse(fileUrls);
    if (!Array.isArray(parsed)) return [];
    // CHỈ giữ lại các file PDF chính thức, loại bỏ triệt để file Word và file dự thảo
    return (parsed as QpplFileLink[]).filter((link) => !isDraftOrNonPdf(link));
  } catch {
    return [];
  }
}

/** Loại trùng soKyHieu (cùng VB có thể xuất hiện nhiều lần từ search) */
export function loaiTrungSoKyHieu(docs: QpplDoc[]): QpplDoc[] {
  const seen = new Set<string>();
  return docs.filter((d) => {
    if (seen.has(d.soKyHieu)) return false;
    seen.add(d.soKyHieu);
    return true;
  });
}

/**
 * Smart post-filter: khi dateFrom/dateTo là đúng 1 tháng, loại VB có trích yếu
 * nhắc tháng KHÁC (VD: user hỏi tháng 8, trích yếu ghi "tháng 7"). Lọc xong mà
 * rỗng thì giữ nguyên danh sách cũ.
 */
export function locTheoThang(docs: QpplDoc[], dateFrom?: string, dateTo?: string): QpplDoc[] {
  if (!dateFrom || !dateTo || docs.length <= 1) return docs;
  const dfDate = new Date(dateFrom);
  const dtDate = new Date(dateTo);
  const diffMonths = (dtDate.getFullYear() - dfDate.getFullYear()) * 12 + (dtDate.getMonth() - dfDate.getMonth());
  if (diffMonths > 1) return docs;

  const requestedMonth = dfDate.getMonth() + 1; // 1-12
  const otherMonthPatterns: RegExp[] = [];
  for (let m = 1; m <= 12; m++) {
    if (m === requestedMonth) continue;
    // Khớp các dạng: "tháng 7", "tháng 07", "thang 7"
    otherMonthPatterns.push(new RegExp(`(?:tháng|thang|tháng\\s)\\s*0?${m}(?:\\b|[./])`, "i"));
  }
  const requested = new RegExp(`(?:tháng|thang)\\s*0?${requestedMonth}(?:\\b|[./])`, "i");
  const filtered = docs.filter((d) => {
    const text = `${d.trichYeu} ${d.soKyHieu}`;
    const mentionsOther = otherMonthPatterns.some((re) => re.test(text));
    return !(mentionsOther && !requested.test(text));
  });
  return filtered.length > 0 ? filtered : docs;
}

export function formatQpplDetail(doc: QpplDoc, sendNote: string): string {
  const fileLinks = parseFileLinks(doc.fileUrls);
  return (
    `📄 **CHI TIẾT VĂN BẢN (ID #${doc.id})**\n` +
    `- **Số/Ký hiệu**: ${doc.soKyHieu}\n` +
    `- **Loại VB**: ${doc.loaiVanBan || "N/A"}\n` +
    `- **Trích yếu**: ${doc.trichYeu || "N/A"}\n` +
    `- **Cơ quan**: ${doc.coQuanBanHanh || "N/A"}\n` +
    `- **Ngày ban hành**: ${doc.ngayBanHanh ? doc.ngayBanHanh.slice(0, 10) : "N/A"}\n` +
    `- **Hiệu lực**: ${doc.hieuLuc}\n` +
    `- **Nguồn**: ${doc.nguon.toUpperCase()}\n` +
    `- **File đính kèm**: ${fileLinks.length > 0 ? fileLinks.map((f) => f.name).join(", ") : "Không có"}\n` +
    `- **Lưu trữ**: ${doc.localPath ? `Đã tải (${Math.round(doc.fileSize / 1024)} KB)` : "Chưa tải"}` +
    sendNote
  );
}

export function formatQpplList(
  docs: QpplDoc[],
  targetNguon: QpplNguon | undefined,
  keyword: string | undefined,
  sendStatusNote: string,
): string {
  const lines = docs.map((d, idx) => {
    const dateStr = d.ngayBanHanh ? d.ngayBanHanh.slice(0, 10) : "";
    const fileLinks = parseFileLinks(d.fileUrls);
    const fileStatus = d.localPath
      ? `[File sẵn sàng - ${Math.round(d.fileSize / 1024)} KB]`
      : fileLinks.length > 0
        ? `[Có ${fileLinks.length} file trực tuyến]`
        : "[Không có file]";
    const coQuanHienThi = d.coQuanBanHanh || (getAgencyConfig(d.nguon as QpplNguon)?.name ?? d.nguon.toUpperCase());
    return (
      `${idx + 1}. **[ID #${d.id}]** ${d.soKyHieu}\n` +
      `   - ${d.loaiVanBan} | ${dateStr} | CQ: ${coQuanHienThi} | ${d.hieuLuc}\n` +
      `   - ${d.trichYeu.slice(0, 120)}${d.trichYeu.length > 120 ? "..." : ""}\n` +
      `   - ${fileStatus}`
    );
  });

  const agencyInfo = targetNguon ? getAgencyConfig(targetNguon) : undefined;
  const titleHeader = agencyInfo ? agencyInfo.name.toUpperCase() : "TỈNH LÂM ĐỒNG (UBND, SỞ NGÀNH, ĐỊA PHƯƠNG)";

  return (
    `🔍 **DANH SÁCH VĂN BẢN CHỈ ĐẠO & ĐIỀU HÀNH [${titleHeader}]** (Tìm: "${keyword || "Mới nhất"}"):\n\n` +
    lines.join("\n\n") +
    sendStatusNote +
    `\n\n*(Mẹo: Nhắn "tải file VB số [ký hiệu]" hoặc chỉ ID cụ thể để bot gửi file.)*`
  );
}
