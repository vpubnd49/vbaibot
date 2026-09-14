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
  /** Nguồn: "congbao" | "tvpl" */
  source: "congbao" | "tvpl";
  /** URL trang chi tiết */
  detailUrl: string;
  /** ID dùng để tải (docId TVPL hoặc detail URL Công báo) */
  downloadId: string;
};

export type NationalDownloadResult = {
  filePath: string | null;
  format: string;
  fileSize: number;
  source: "congbao" | "tvpl";
  error?: string;
};

// ─── Tra cứu VB cấp TW ────────────────────────────────────────────

/**
 * Tìm kiếm văn bản pháp luật cấp Trung ương.
 * Chiến lược: song song Công báo + TVPL, gộp kết quả loại trùng.
 */
export async function searchNationalLegal(keyword: string): Promise<NationalLegalResult[]> {
  const results: NationalLegalResult[] = [];

  // Chạy song song 2 nguồn
  const [congbaoItems, tvplItems] = await Promise.allSettled([
    searchCongbao(keyword),
    isTvplConfigured() ? searchTvpl(keyword) : Promise.resolve([] as TvplSearchResult[]),
  ]);

  // Xử lý kết quả Công báo
  if (congbaoItems.status === "fulfilled") {
    for (const item of congbaoItems.value) {
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

  // Xử lý kết quả TVPL
  if (tvplItems.status === "fulfilled") {
    for (const item of tvplItems.value) {
      // Kiểm tra trùng số hiệu với kết quả Công báo
      const existing = results.find(
        (r) => r.soHieu && item.soHieu && normalizeSoHieu(r.soHieu) === normalizeSoHieu(item.soHieu),
      );
      if (existing) continue; // Bỏ trùng, ưu tiên Công báo

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

  log.info({ keyword, total: results.length }, "National legal search completed");
  return results;
}

// ─── Tải VB cấp TW ────────────────────────────────────────────────

/**
 * Tải VB pháp luật cấp Trung ương.
 * @param downloadId ID/URL trả từ searchNationalLegal
 * @param source Nguồn: "congbao" hoặc "tvpl"
 * @param format Định dạng tải (chỉ TVPL hỗ trợ chọn format)
 * @param soHieu Số hiệu dùng đặt tên file
 */
export async function downloadNationalLegal(
  downloadId: string,
  source: "congbao" | "tvpl",
  format: "pdf" | "doc" | "docx" = "pdf",
  soHieu?: string,
): Promise<NationalDownloadResult> {
  if (source === "congbao") {
    return downloadFromCongbao(downloadId, soHieu);
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

// ─── Helpers ───────────────────────────────────────────────────────

/** Chuẩn hóa số hiệu VB để so sánh (bỏ dấu cách, slash, viết hoa) */
function normalizeSoHieu(sh: string): string {
  return sh.replace(/[\s/-]/g, "").toUpperCase();
}
