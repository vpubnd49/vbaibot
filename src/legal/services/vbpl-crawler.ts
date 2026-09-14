import { createLogger } from "../../shared/logger.js";

const log = createLogger("vbpl-crawler");

const BASE_URL = "https://vbpl.vn";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
};

// ─── Types ─────────────────────────────────────────────────────────

export type VbplSearchResult = {
  /** Số hiệu VB */
  soHieu: string;
  /** Trích yếu */
  trichYeu: string;
  /** Loại VB */
  loaiVB: string;
  /** Cơ quan ban hành */
  coQuanBanHanh: string;
  /** Ngày ban hành */
  ngayBanHanh: string;
  /** URL trang chi tiết */
  detailUrl: string;
  /** Slug (dùng để tạo URL chi tiết) */
  slug: string;
};

// ─── Search ────────────────────────────────────────────────────────

/**
 * Tìm VB trên CSDL quốc gia về pháp luật (vbpl.vn).
 * Trang dùng Next.js App Router → cần lấy buildId động rồi fetch RSC data.
 *
 * Nếu không lấy được buildId, fallback sang parse HTML trang danh sách.
 */
export async function searchVbpl(keyword: string): Promise<VbplSearchResult[]> {
  try {
    // Phương án 1: Dùng trang search HTML (luôn hoạt động)
    return await searchVbplHtml(keyword);
  } catch (err) {
    log.error({ err, keyword }, "VBPL search failed");
    return [];
  }
}

/**
 * Search bằng HTML page — không phụ thuộc buildId.
 * URL: https://vbpl.vn/van-ban/trung-uong?keyword=349/2026
 */
async function searchVbplHtml(keyword: string): Promise<VbplSearchResult[]> {
  const url = `${BASE_URL}/van-ban/trung-uong?keyword=${encodeURIComponent(keyword)}&page=1`;

  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    log.warn({ status: res.status, url }, "VBPL search page failed");
    return [];
  }

  const html = await res.text();
  return parseVbplSearchHtml(html);
}

/**
 * Parse kết quả tìm kiếm từ HTML.
 *
 * Cấu trúc HTML vbpl.vn (Next.js SSR):
 * Dữ liệu nằm trong RSC payload dạng JSON inline trong <script> tags.
 * Tìm pattern: slug URL + title + metadata.
 */
function parseVbplSearchHtml(html: string): VbplSearchResult[] {
  const results: VbplSearchResult[] = [];

  // Pattern 1: Tìm link VB trong HTML rendered
  // <a href="/van-ban/chi-tiet/{slug}">Tiêu đề VB</a>
  const linkRe = /href="\/van-ban\/chi-tiet\/([^"]+)"[^>]*>([^<]+)</g;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(html)) !== null) {
    const [, slug, rawTitle] = match;
    if (!slug || slug.includes("_next")) continue;

    const title = rawTitle.trim();
    if (!title || title.length < 10) continue;

    // Trích số hiệu từ slug
    const soHieu = extractSoHieuFromSlug(slug);
    const loaiVB = extractLoaiVBFromSlug(slug);

    // Tránh trùng
    if (results.some((r) => r.slug === slug)) continue;

    results.push({
      soHieu,
      trichYeu: title,
      loaiVB,
      coQuanBanHanh: "",
      ngayBanHanh: "",
      detailUrl: `${BASE_URL}/van-ban/chi-tiet/${slug}`,
      slug,
    });
  }

  // Pattern 2: Tìm trong RSC payload (self.__next_f.push)
  // Dữ liệu VB thường nằm dạng JSON string trong RSC chunks
  const rscRe = /van-ban\/chi-tiet\/([\w-]+--[a-f0-9-]+)/g;
  while ((match = rscRe.exec(html)) !== null) {
    const slug = match[1];
    if (results.some((r) => r.slug === slug)) continue;

    const soHieu = extractSoHieuFromSlug(slug);
    results.push({
      soHieu,
      trichYeu: soHieu,
      loaiVB: extractLoaiVBFromSlug(slug),
      coQuanBanHanh: "",
      ngayBanHanh: "",
      detailUrl: `${BASE_URL}/van-ban/chi-tiet/${slug}`,
      slug,
    });
  }

  log.info({ count: results.length }, "Parsed VBPL search results");
  return results.slice(0, 20);
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Trích số hiệu từ slug URL.
 * VD: "nghi-dinh-so-349-2026-nd-cp-sua-doi...--c5481e50-acfc..." → "349/2026/NĐ-CP"
 */
function extractSoHieuFromSlug(slug: string): string {
  // Bỏ UUID cuối
  const cleanSlug = slug.replace(/--[a-f0-9-]{36}$/, "");

  // Pattern: {loai}-so-{so}-{nam}-{loai2}-{coQuan}-{phần còn lại}
  const m = cleanSlug.match(/so-(\d+)-(\d{4})-([a-z]+)-([a-z]+)/i);
  if (m) {
    const [, so, nam, loai, coQuan] = m;
    return `${so}/${nam}/${loai.toUpperCase()}-${coQuan.toUpperCase()}`;
  }

  // Pattern QĐ-TTg
  const ttg = cleanSlug.match(/so-(\d+)-qd-ttg/i);
  if (ttg) return `${ttg[1]}/QĐ-TTg`;

  // Pattern NQ-CP
  const nqcp = cleanSlug.match(/so-(\d+)-(\d{4})-nq-cp/i);
  if (nqcp) return `${nqcp[1]}/${nqcp[2]}/NQ-CP`;

  return cleanSlug.split("-sua-doi")[0].replace(/-/g, " ");
}

function extractLoaiVBFromSlug(slug: string): string {
  if (slug.startsWith("nghi-dinh")) return "Nghị định";
  if (slug.startsWith("thong-tu-lien-tich")) return "Thông tư liên tịch";
  if (slug.startsWith("thong-tu")) return "Thông tư";
  if (slug.startsWith("quyet-dinh")) return "Quyết định";
  if (slug.startsWith("nghi-quyet")) return "Nghị quyết";
  if (slug.startsWith("luat")) return "Luật";
  if (slug.startsWith("phap-lenh")) return "Pháp lệnh";
  if (slug.startsWith("chi-thi")) return "Chỉ thị";
  return "Văn bản";
}
