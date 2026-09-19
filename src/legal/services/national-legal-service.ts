import { createLogger } from "../../shared/logger.js";
import {
  searchCongbao,
  fetchCongbaoDetail,
  downloadCongbaoPdf,
} from "./congbao-crawler.js";
import {
  searchTvpl,
  downloadTvplDocument,
  isTvplConfigured,
  type TvplSearchResult,
} from "./tvpl-crawler.js";
import { searchVbpl, downloadVbplDocument } from "./vbpl-crawler.js";
import { searchPhapLuat, downloadPhapLuatDocument } from "./phapluat-crawler.js";
import { findLegalDocumentByAlias, findLegalDocumentByNumber } from "../repositories/legal-repository.js";

const log = createLogger("national-legal-service");

// ─── Types ─────────────────────────────────────────────────────────

export type NationalLegalResult = {
  /** Số hiệu VB */
  soHieu: string;
  /** Trích yếu */
  trichYeu: string;
  /** Loại VB */
  loaiVB: string;
  /** Ngày ban hành */
  ngayBanHanh: string;
  /** Nguồn chính thức */
  source: "congbao" | "tvpl" | "vbpl" | "phapluat";
  /** URL trang chi tiết */
  detailUrl: string;
  /** ID dùng để tải (docId TVPL hoặc detail URL Công báo) */
  downloadId: string;
};

export type NationalDownloadResult = {
  filePath: string | null;
  format: string;
  fileSize: number;
  source: "congbao" | "tvpl" | "vbpl" | "phapluat";
  error?: string;
};

// ─── Tra cứu VB cấp TW ────────────────────────────────────────────

/**
 * Tìm kiếm văn bản pháp luật cấp Trung ương.
 * Chiến lược: song song Công báo + VBPL + TVPL, gộp kết quả loại trùng.
 */
export async function searchNationalLegal(keyword: string): Promise<NationalLegalResult[]> {
  const results: NationalLegalResult[] = [];
  const localMatch = findLegalDocumentByNumber(keyword) || findLegalDocumentByAlias(keyword);
  if (localMatch) {
    const officialUrl = localMatch.officialSourceUrls.find((url) => url.includes("vanban.chinhphu.vn")) || localMatch.officialSourceUrls[0] || "";
    results.push({
      soHieu: localMatch.documentNumber,
      trichYeu: localMatch.title,
      loaiVB: localMatch.documentType,
      ngayBanHanh: localMatch.issueDate || "",
      source: "vbpl",
      detailUrl: officialUrl,
      downloadId: officialUrl || localMatch.documentNumber,
    });
    log.info({ keyword, soHieu: localMatch.documentNumber }, "Using verified local legal match");
    return results;
  }

  // Chạy song song các nguồn chính thức; một nguồn lỗi không làm mất nguồn còn lại.
  const [congbaoItems, vbplItems, tvplItems, phapLuatItems] = await Promise.allSettled([
    searchCongbao(keyword),
    searchVbpl(keyword),
    isTvplConfigured() ? searchTvpl(keyword) : Promise.resolve([] as TvplSearchResult[]),
    searchPhapLuat(keyword),
  ]);

  // 1. Xử lý Cổng Pháp luật quốc gia (phapluat.gov.vn), ưu tiên dữ liệu hiệu lực.
  if (phapLuatItems.status === "fulfilled") {
    for (const item of phapLuatItems.value) {
      const existing = results.find(
        (r) => r.soHieu && item.soHieu && normalizeSoHieu(r.soHieu) === normalizeSoHieu(item.soHieu),
      );
      if (existing) continue;
      results.push({
        soHieu: item.soHieu,
        trichYeu: item.trichYeu,
        loaiVB: item.loaiVB,
        ngayBanHanh: item.ngayBanHanh,
        source: "phapluat",
        detailUrl: item.detailUrl,
        downloadId: item.downloadId,
      });
    }
  } else {
    log.warn({ err: phapLuatItems.reason }, "PhapLuat.gov.vn search failed");
  }

  // 2. Xử lý kết quả VBPL trước (CSDL quốc gia về pháp luật - miễn phí, có sẵn file gốc trực tiếp từ MOJ)
  if (vbplItems.status === "fulfilled") {
    for (const item of vbplItems.value) {
      const existing = results.find(
        (r) => r.soHieu && item.soHieu && normalizeSoHieu(r.soHieu) === normalizeSoHieu(item.soHieu),
      );
      if (existing) continue;

      results.push({
        soHieu: item.soHieu,
        trichYeu: item.trichYeu,
        loaiVB: item.loaiVB,
        ngayBanHanh: item.ngayBanHanh,
        source: "vbpl",
        detailUrl: item.detailUrl,
        downloadId: item.slug,
      });
    }
  } else {
    log.warn({ err: vbplItems.reason }, "VBPL search failed");
  }

  // 3. Xử lý kết quả Công báo
  if (congbaoItems.status === "fulfilled") {
    for (const item of congbaoItems.value) {
      const existing = results.find(
        (r) => r.soHieu && item.soHieu && normalizeSoHieu(r.soHieu) === normalizeSoHieu(item.soHieu),
      );
      if (existing) continue;

      results.push({
        soHieu: item.soHieu,
        trichYeu: item.title,
        loaiVB: item.loaiVB,
        ngayBanHanh: item.pubDate.slice(0, 10),
        source: "congbao",
        detailUrl: item.detailUrl,
        downloadId: item.detailUrl,
      });
    }
  } else {
    log.warn({ err: congbaoItems.reason }, "Congbao search failed");
  }

  // 4. Xử lý kết quả TVPL (cần đăng nhập)
  if (tvplItems.status === "fulfilled") {
    for (const item of tvplItems.value) {
      const existing = results.find(
        (r) => r.soHieu && item.soHieu && normalizeSoHieu(r.soHieu) === normalizeSoHieu(item.soHieu),
      );
      if (existing) continue;

      results.push({
        soHieu: item.soHieu,
        trichYeu: item.trichYeu,
        loaiVB: item.loaiVB,
        ngayBanHanh: item.ngayBanHanh,
        source: "tvpl",
        detailUrl: item.detailUrl,
        downloadId: item.docId,
      });
    }
  } else {
    log.warn({ err: tvplItems.reason }, "TVPL search failed");
  }

  // API các cổng thường tìm theo từng từ (OR), vì vậy phải ưu tiên bản ghi
  // khớp số hiệu/tên văn bản trước khi tool chọn bản ghi để tải.
  const normalizedQuery = normalizeSearchText(keyword);
  results.sort((a, b) => scoreNationalResult(b, normalizedQuery) - scoreNationalResult(a, normalizedQuery));

  log.info({ keyword, total: results.length, top: results[0]?.soHieu }, "National legal search completed");
  return results;
}

// ─── Tải VB cấp TW ────────────────────────────────────────────────

/**
 * Tải VB pháp luật cấp Trung ương.
 * @param downloadId ID/URL trả từ searchNationalLegal
 * @param source Nguồn chính thức: "phapluat" | "congbao" | "tvpl" | "vbpl"
 * @param format Định dạng tải (chỉ TVPL hỗ trợ chọn format)
 * @param soHieu Số hiệu dùng đặt tên file
 */
export async function downloadNationalLegal(
  downloadId: string,
  source: "congbao" | "tvpl" | "vbpl" | "phapluat",
  format: "pdf" | "doc" | "docx" = "pdf",
  soHieu?: string,
): Promise<NationalDownloadResult> {
  if (source === "congbao") {
    return downloadFromCongbao(downloadId, soHieu);
  }
  if (source === "vbpl") {
    return downloadFromVbpl(downloadId, format === "doc" ? "docx" : (format as "pdf" | "docx"), soHieu);
  }
  if (source === "phapluat") {
    return downloadFromPhapLuat(downloadId, format, soHieu);
  }
  return downloadFromTvpl(downloadId, format, soHieu);
}

async function downloadFromCongbao(
  detailUrl: string,
  soHieu?: string,
): Promise<NationalDownloadResult> {
  try {
    const detail = await fetchCongbaoDetail(detailUrl);
    if (!detail?.pdfUrl) {
      return {
        filePath: null,
        format: "pdf",
        fileSize: 0,
        source: "congbao",
        error: "Không tìm thấy link PDF trên trang Công báo",
      };
    }

    const filePath = await downloadCongbaoPdf(detail.pdfUrl, soHieu || detail.soHieu);
    if (!filePath) {
      return { filePath: null, format: "pdf", fileSize: 0, source: "congbao", error: "Tải PDF thất bại" };
    }

    const { size } = await import("node:fs").then((m) => m.statSync(filePath));
    return { filePath, format: "pdf", fileSize: size, source: "congbao" };
  } catch (err) {
    log.error({ err, detailUrl }, "Congbao download failed");
    return { filePath: null, format: "pdf", fileSize: 0, source: "congbao", error: String(err) };
  }
}

async function downloadFromPhapLuat(
  downloadId: string,
  format: "pdf" | "doc" | "docx",
  soHieu?: string,
): Promise<NationalDownloadResult> {
  try {
    const result = await downloadPhapLuatDocument(downloadId, format, soHieu);
    return { ...result, source: "phapluat" };
  } catch (err) {
    log.error({ err, downloadId }, "PhapLuat.gov.vn download failed");
    return { filePath: null, format, fileSize: 0, source: "phapluat", error: String(err) };
  }
}

async function downloadFromOfficialDetailPage(
  detailUrl: string,
  format: "pdf" | "docx",
  soHieu?: string,
): Promise<NationalDownloadResult> {
  try {
    const response = await fetch(detailUrl, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return { filePath: null, format, fileSize: 0, source: "vbpl", error: `Nguồn Chính phủ HTTP ${response.status}` };
    const html = await response.text();
    const links = [...html.matchAll(/https?:[^"'\\\s<>]+\.(?:pdf|docx?)(?:\?[^"'\\\s<>]*)?/gi)].map((m) => m[0].replace(/&amp;/g, "&"));
    const preferred = links.find((url) => format === "pdf" ? /\.pdf(?:\?|$)/i.test(url) : /\.docx?(?:\?|$)/i.test(url)) || links[0];
    if (!preferred) return { filePath: null, format, fileSize: 0, source: "vbpl", error: "Không tìm thấy file trên trang Chính phủ" };
    const fileResponse = await fetch(preferred, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(60_000) });
    if (!fileResponse.ok) return { filePath: null, format, fileSize: 0, source: "vbpl", error: `Tải file Chính phủ HTTP ${fileResponse.status}` };
    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "data", "vbpl");
    await fs.mkdir(dir, { recursive: true });
    const safe = (soHieu || "van-ban").replace(/[/\\:*?"<>|]/g, "-");
    const ext = path.extname(new URL(preferred).pathname) || `.${format}`;
    const filePath = path.join(dir, `${safe}${ext}`);
    await fs.writeFile(filePath, buffer);
    return { filePath, format: ext.slice(1), fileSize: buffer.length, source: "vbpl" };
  } catch (err) {
    return { filePath: null, format, fileSize: 0, source: "vbpl", error: String(err) };
  }
}

async function downloadFromTvpl(
  docId: string,
  format: "pdf" | "doc" | "docx",
  soHieu?: string,
): Promise<NationalDownloadResult> {
  if (!isTvplConfigured()) {
    return { filePath: null, format, fileSize: 0, source: "tvpl", error: "TVPL chưa cấu hình username/password" };
  }

  const result = await downloadTvplDocument(docId, format, soHieu);
  return {
    filePath: result.filePath,
    format: result.format,
    fileSize: result.fileSize,
    source: "tvpl",
    error: result.error,
  };
}

async function downloadFromVbpl(
  slug: string,
  format: "pdf" | "docx" = "pdf",
  soHieu?: string,
): Promise<NationalDownloadResult> {
  if (/^https?:\/\/vanban\.chinhphu\.vn\//i.test(slug)) {
    return downloadFromOfficialDetailPage(slug, format, soHieu);
  }
  try {
    const result = await downloadVbplDocument(slug, format, soHieu);
    return {
      filePath: result.filePath,
      format: result.format,
      fileSize: result.fileSize,
      source: "vbpl",
      error: result.error,
    };
  } catch (err) {
    log.error({ err, slug }, "VBPL download failed");
    return { filePath: null, format, fileSize: 0, source: "vbpl", error: String(err) };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Chuẩn hóa số hiệu VB để so sánh (bỏ dấu cách, slash, viết hoa) */
function normalizeSoHieu(sh: string): string {
  return sh.replace(/[\s/-]/g, "").toUpperCase();
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreNationalResult(result: NationalLegalResult, query: string): number {
  const haystack = normalizeSearchText(`${result.soHieu} ${result.trichYeu} ${result.loaiVB}`);
  if (!query) return 0;
  const queryTokens = query.split(/\s+/).filter((token) => token.length > 1);
  const matched = queryTokens.filter((token) => haystack.includes(token)).length;
  let score = matched * 10;
  if (haystack.includes(query)) score += 100;
  if (normalizeSoHieu(result.soHieu) && query.replace(/[^a-z0-9]/g, "") === normalizeSoHieu(result.soHieu).toLowerCase()) score += 200;
  if (normalizeSearchText(result.trichYeu).includes(query)) score += 50;
  return score;
}
