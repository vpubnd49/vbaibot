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

/** Thứ tự nguồn tải: nguồn chính thức, ổn định và nhanh nhất trước. */
export const NATIONAL_DOWNLOAD_SOURCE_PRIORITY = ["vbpl", "phapluat", "congbao", "tvpl"] as const;

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
  // Nhận cả cách nói tự nhiên: "qđ 1805 ngày 18/9/2026 của thủ tướng".
  // Không để query tự do bị hiểu thành yêu cầu soạn DOCX hoặc khớp OR sai văn bản.
  const shorthand = keyword.match(/(?:qđ|quyết định)\s*(\d{1,6})(?:[^\d]|$)/i);
  const explicitNumber = keyword.match(/\b\d+\/\d{4}\/[A-ZĐa-zđ0-9_-]+\b/)?.[0]
    || (shorthand?.[1] && /thủ\s*tướng|ttg/i.test(keyword) ? `${shorthand[1]}/${new Date().getFullYear()}/QĐ-TTg` : undefined);
  const localMatch = findLegalDocumentByNumber(explicitNumber || keyword) || findLegalDocumentByAlias(keyword);
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

  // Kiểm tra keyword có liên quan VBHN không → thêm vanban.chinhphu.vn song song
  const isVbhnQuery = /vbhn|văn\s*bản\s*hợp\s*nhất/i.test(keyword);

  // Chạy song song các nguồn chính thức; một nguồn lỗi không làm mất nguồn còn lại.
  const [congbaoItems, vbplItems, tvplItems, phapLuatItems, chinhphuItems] = await Promise.allSettled([
    searchCongbao(keyword),
    searchVbpl(keyword),
    isTvplConfigured() ? searchTvpl(keyword) : Promise.resolve([] as TvplSearchResult[]),
    searchPhapLuat(keyword),
    // vanban.chinhphu.vn: LUÔN search song song (nguồn ưu tiên cho VBHN + VB mới nhất)
    searchVanbanChinhphu(keyword),
  ]);

  // 0. vanban.chinhphu.vn — merge vào pool, dedup, để qua filter exact match cùng các nguồn khác.
  //    Ưu tiên chinhphu.vn bằng sort score (detailUrl chứa chinhphu.vn), KHÔNG bằng vị trí insert.
  if (chinhphuItems.status === "fulfilled" && chinhphuItems.value.length > 0) {
    for (const item of chinhphuItems.value) {
      const existing = results.find(
        (r) => r.soHieu && item.soHieu && normalizeSoHieu(r.soHieu) === normalizeSoHieu(item.soHieu),
      );
      if (existing) continue;
      results.push(item);
    }
    log.info({ keyword, found: chinhphuItems.value.length }, "vanban.chinhphu.vn results (priority source)");
  } else if (chinhphuItems.status === "rejected") {
    log.warn({ err: chinhphuItems.reason }, "vanban.chinhphu.vn search failed");
  }

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

  // Khi người dùng nêu số hiệu, chỉ chấp nhận khớp tuyệt đối. Không để API
  // tìm OR trả văn bản khác rồi gắn tên số hiệu yêu cầu lên file đó.
  // `soLoai` hoist lên đây để shorthand guard bên dưới tham chiếu được.
  let soLoai: RegExpMatchArray | null = null;
  const explicit = keyword.match(/\b\d+\/\d{4}\/[A-ZĐa-zđ0-9_-]+\b/);
  if (explicit) {
    const wanted = normalizeSoHieu(explicit[0]);
    const exact = results.filter((r) => normalizeSoHieu(r.soHieu) === wanted);
    results.splice(0, results.length, ...exact);
  } else {
    const short = keyword.match(/\b\d+\/\d{4}\b/);
    if (short) {
      const wanted = normalizeSoHieu(short[0]);
      const exact = results.filter((r) => normalizeSoHieu(r.soHieu).startsWith(wanted));
      results.splice(0, results.length, ...exact);
    } else {
      // Pattern: "1805/QĐ-TTg", "66/CĐ-TTg", "139/VBHN-LQ-VPQH" (số/loại, không có năm)
      soLoai = keyword.match(/\b(\d+)\/([\wĐđ]+-[\wĐđ]+(?:-[\wĐđ]+)*)\b/)
        // Fallback: "1805 QĐ-TTg" (space thay slash — model đôi khi format lại keyword)
        || keyword.match(/\b(\d+)\s+([\wĐđ]+-[\wĐđ]+(?:-[\wĐđ]+)*)\b/);
      if (soLoai) {
        const wantedNum = soLoai[1];
        const wantedType = normalizeSoHieu(soLoai[2]);
        const exact = results.filter((r) => {
          // Tách số đầu tiên từ soHieu GỐC (trước normalize) để so chính xác.
          // VD: "1805/2026/QĐ-TTg" → "1805", "66/CĐ-TTg" → "66"
          const leadingNum = r.soHieu.match(/^(\d+)/)?.[1];
          const norm = normalizeSoHieu(r.soHieu);
          return leadingNum === wantedNum && norm.includes(wantedType);
        });
        if (exact.length > 0) {
          results.splice(0, results.length, ...exact);
        }
      }
    }
  }

  // API các cổng thường tìm theo từng từ (OR), vì vậy phải ưu tiên bản ghi
  // khớp số hiệu/tên văn bản trước khi tool chọn bản ghi để tải.
  // Chỉ dùng shorthand khi soLoai chưa filter — tránh đè lên kết quả chính xác hơn.
  // Fix: dùng normalizeSoHieu("QĐ-TTg") thay literal "QDTTG" (bug Unicode Đ≠D).
  if (shorthand?.[1] && !soLoai) {
    const wantedNumber = shorthand[1];
    const wantedYear = keyword.match(/(?:ngày\s+\d{1,2}\/\d{1,2}\/|\b)(20\d{2})\b/)?.[1];
    const wantedIssuer = /thủ\s*tướng|ttg/i.test(keyword);
    const qdttgNorm = normalizeSoHieu("QĐ-TTg");
    const filtered = results.filter((r) => {
      const normalized = normalizeSoHieu(r.soHieu);
      const numberMatches = normalized.startsWith(normalizeSoHieu(wantedNumber)) && normalized.includes(qdttgNorm);
      const yearMatches = !wantedYear || r.ngayBanHanh.startsWith(wantedYear);
      const issuerMatches = !wantedIssuer || /thủ\s*tướng|ttg/i.test(`${r.trichYeu} ${r.loaiVB} ${r.soHieu}`);
      return numberMatches && yearMatches && issuerMatches;
    });
    results.splice(0, results.length, ...filtered);
  }

  const normalizedQuery = normalizeSearchText(keyword);
  results.sort((a, b) => {
    // vanban.chinhphu.vn (detailUrl chứa chinhphu.vn) luôn ưu tiên đầu
    const isChinhphuA = a.detailUrl?.includes("chinhphu.vn") ? 0 : 1;
    const isChinhphuB = b.detailUrl?.includes("chinhphu.vn") ? 0 : 1;
    if (isChinhphuA !== isChinhphuB) return isChinhphuA - isChinhphuB;
    const sourceRank = (source: NationalLegalResult["source"]) => NATIONAL_DOWNLOAD_SOURCE_PRIORITY.indexOf(source);
    return sourceRank(a.source) - sourceRank(b.source) || scoreNationalResult(b, normalizedQuery) - scoreNationalResult(a, normalizedQuery);
  });

  // Cho VBHN: ưu tiên kết quả MỚI NHẤT (năm gần nhất) lên đầu
  if (isVbhnQuery && results.length > 1) {
    results.sort((a, b) => {
      const yearA = parseInt(a.ngayBanHanh?.slice(0, 4) || a.soHieu?.match(/(\d{4})/)?.[1] || "0", 10);
      const yearB = parseInt(b.ngayBanHanh?.slice(0, 4) || b.soHieu?.match(/(\d{4})/)?.[1] || "0", 10);
      return yearB - yearA; // mới nhất trước
    });
  }

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
  // Chỉ tải PDF — bản chính thức trên datafiles.chinhphu.vn là .signed.pdf
  const effectiveFormat = "pdf" as const;
  log.info({ source, soHieu, downloadId, requestedFormat: format, effectiveFormat }, "Starting priority legal download (PDF only)");
  if (source === "congbao") {
    return downloadFromCongbao(downloadId, soHieu);
  }
  if (source === "vbpl") {
    return downloadFromVbpl(downloadId, effectiveFormat, soHieu);
  }
  if (source === "phapluat") {
    return downloadFromPhapLuat(downloadId, effectiveFormat, soHieu);
  }
  return downloadFromTvpl(downloadId, effectiveFormat, soHieu);
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
    const html = (await response.text())
      .replace(/&amp;/g, "&")
      .replace(/\\u002F|\\\//g, "/")
      .replace(/\\u003A/g, ":");
    const rawLinks = [...html.matchAll(/(?:https?:)?[^"'\\\s<>]+\.(?:pdf|docx?)(?:\?[^"'\\\s<>]*)?/gi)]
      .map((m) => m[0].startsWith("/") ? new URL(m[0], detailUrl).toString() : m[0]);
    const links = rawLinks.filter((url) => {
      try {
        const parsed = new URL(url, detailUrl);
        return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "datafiles.chinhphu.vn" && /\/cpp\/files\/vbpq\/\d{4}\/\d{1,2}\/[^/?#]+\.(?:pdf|docx?)(?:[?#].*)?$/i.test(parsed.toString());
      } catch { return false; }
    });
    const preferred = links.find((url) => format === "pdf" ? /\.pdf(?:\?|$)/i.test(url) : /\.docx?(?:\?|$)/i.test(url));
    log.info({ detailUrl, candidateCount: links.length, selectedUrl: preferred, format }, "Official Government document link selected");
    if (!preferred) return { filePath: null, format, fileSize: 0, source: "vbpl", error: `Không tìm thấy file ${format.toUpperCase()} chính thức trên trang Chính phủ` };
    const fileResponse = await fetch(preferred, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!fileResponse.ok) return { filePath: null, format, fileSize: 0, source: "vbpl", error: `Tải file Chính phủ HTTP ${fileResponse.status}` };
    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    const valid = format === "pdf"
      ? buffer.length >= 1000 && buffer.subarray(0, 5).toString("ascii") === "%PDF-"
      : buffer.length >= 1000 && buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
    if (!valid) return { filePath: null, format, fileSize: 0, source: "vbpl", error: `File Chính phủ không phải ${format.toUpperCase()} hợp lệ` };
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "data", "vbpl");
    await fs.mkdir(dir, { recursive: true });
    const safe = (soHieu || "van-ban").replace(/[/\\:*?"<>|]/g, "-");
    const ext = path.extname(new URL(preferred).pathname).toLowerCase();
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

/** Chuẩn hóa số hiệu VB để so sánh (bỏ dấu cách, slash, viết hoa, Đ→D) */
function normalizeSoHieu(sh: string): string {
  return sh.replace(/[\s/-]/g, "").toUpperCase().replace(/Đ/g, "D");
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

// ─── Fallback: vanban.chinhphu.vn ──────────────────────────────────

/**
 * Tìm trực tiếp trên vanban.chinhphu.vn — cổng duy nhất index đầy đủ VBHN.
 *
 * Trang dùng ASP.NET WebForms, render server-side. HTML chứa danh sách VB dạng:
 * ```html
 * <a href="?pageid=27160&docid=219579">Văn bản hợp nhất số 139/2026/VBHN-LQ-VPQH ...</a>
 * ```
 *
 * Chiến lược: fetch HTML từ trang listing + query string, parse regex để lấy
 * docid + tiêu đề + số hiệu. Mỗi docid cho URL detail page dùng để download.
 */
async function searchVanbanChinhphu(keyword: string): Promise<NationalLegalResult[]> {
  const kw = keyword.trim();
  if (!kw) return [];

  // vanban.chinhphu.vn search: thêm tham số vào URL listing
  // pageid=41852 là trang tra cứu, mode=0 là tất cả VB
  const searchUrl = `https://vanban.chinhphu.vn/?pageid=41852&mode=0&keyword=${encodeURIComponent(kw)}`;
  
  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    log.warn({ status: response.status, kw }, "vanban.chinhphu.vn search HTTP error");
    return [];
  }

  const html = await response.text();
  const results: NationalLegalResult[] = [];
  const seen = new Set<string>();

  // HTML thực tế trên vanban.chinhphu.vn (ASP.NET GridView):
  // <a href='/?pageid=27160&docid=219579'>
  //     <span class="code">139/2026/VBHN-LQ-VPQH</span>
  //     <span class="issue-v2">21/09/2026</span>
  // </a>
  // ...
  // <span class="issued-date">21/09/2026</span>
  // ...tiếp theo là <td> chứa trích yếu

  // Step 1: Tìm tất cả link dạng /?pageid=27160&docid=XXXXX
  const linkRe = /href\s*=\s*['"]\/?\?pageid=27160[&\s]docid=(\d+)[^'"]*['"]/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(html)) !== null) {
    const docid = match[1];
    if (!docid || seen.has(docid)) continue;
    seen.add(docid);

    // Step 2: Tìm <span class="code">SỐ HIỆU</span> gần link này
    const afterLink = html.substring(match.index, Math.min(html.length, match.index + 500));
    const codeMatch = afterLink.match(/<span\s+class="code">\s*([^<]+?)\s*<\/span>/i);
    const soHieu = codeMatch?.[1]?.trim() || "";

    // Step 3: Tìm ngày ban hành
    const dateMatch = afterLink.match(/<span\s+class="(?:issue-v2|issued-date)">\s*(\d{2}\/\d{2}\/\d{4})\s*<\/span>/i);
    const rawDate = dateMatch?.[1] || "";
    // Chuyển DD/MM/YYYY → YYYY-MM-DD
    const ngayBanHanh = rawDate ? rawDate.split("/").reverse().join("-") : "";

    // Step 4: Tìm trích yếu — thường ở <td> tiếp theo sau <td> chứa link
    const trichYeuBlock = html.substring(match.index, Math.min(html.length, match.index + 2000));
    // Trích yếu nằm trong <td> thứ 2 sau link, hoặc trong <a> title attribute
    const titleMatch = trichYeuBlock.match(/class="title"[^>]*>\s*([^<]+)/i)
      || trichYeuBlock.match(/<\/td>\s*<td[^>]*>\s*<\/td>\s*<td[^>]*>\s*([^<]+)/i)
      || trichYeuBlock.match(/<a[^>]*title=["']([^"']+)/i);
    const trichYeu = titleMatch?.[1]?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() || soHieu;

    // Phát hiện loại VB
    const loaiVB = /VBHN/i.test(soHieu) ? "Văn bản hợp nhất"
      : soHieu.match(/\/(NĐ|ND)-/i) ? "Nghị định"
      : soHieu.match(/\/(TT)-/i) ? "Thông tư"
      : soHieu.match(/\/(QĐ|QD)-/i) ? "Quyết định"
      : soHieu.match(/\/(NQ)-/i) ? "Nghị quyết"
      : soHieu.match(/\/(L)-/i) ? "Luật"
      : "Văn bản";

    const detailUrl = `https://vanban.chinhphu.vn/?pageid=27160&docid=${docid}`;
    results.push({
      soHieu,
      trichYeu,
      loaiVB,
      ngayBanHanh,
      source: "vbpl", // route through downloadFromVbpl → downloadFromOfficialDetailPage
      detailUrl,
      downloadId: detailUrl,
    });

    if (results.length >= 10) break;
  }

  log.info({ kw, found: results.length, docids: [...seen].slice(0, 5) }, "vanban.chinhphu.vn search completed");
  return results;
}
