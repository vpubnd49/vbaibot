import { createLogger } from "../../shared/logger.js";

const log = createLogger("vbpl-crawler");

const BASE_URL = "https://vbpl.vn";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept": "text/x-component",
  "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
  "RSC": "1",
  "Next-Url": "/vi/van-ban/trung-uong",
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
 *
 * Trang dùng Next.js App Router (RSC) → HTML trả về chỉ là shell,
 * dữ liệu VB nằm trong RSC stream payload.
 * Cần RSC header + parse RSC Flight format.
 */
export async function searchVbpl(keyword: string): Promise<VbplSearchResult[]> {
  try {
    return await searchVbplRsc(keyword);
  } catch (err) {
    log.error({ err, keyword }, "VBPL search failed");
    return [];
  }
}

/**
 * Fetch trang search bằng RSC header → parse RSC Flight payload.
 * RSC stream chứa rendered React tree, trong đó có URL slug của VB.
 */
async function searchVbplRsc(keyword: string): Promise<VbplSearchResult[]> {
  const url = `${BASE_URL}/van-ban/trung-uong?keyword=${encodeURIComponent(keyword)}&page=1`;

  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    log.warn({ status: res.status, url }, "VBPL RSC fetch failed");
    return [];
  }

  const rscText = await res.text();
  return parseRscPayload(rscText, keyword);
}

// ─── RSC Parser ────────────────────────────────────────────────────

/**
 * Parse RSC Flight payload.
 *
 * RSC payload dạng: "ID:TYPE{json}\n"
 * Document slugs nằm trong href links: /van-ban/chi-tiet/{slug}
 * Document title nằm trong "children":"..." cạnh href.
 */
function parseRscPayload(rscText: string, keyword: string): VbplSearchResult[] {
  const results: VbplSearchResult[] = [];

  // Tìm tất cả slug pattern trong RSC text
  // Format: /van-ban/chi-tiet/{loai}-so-{so}-{nam}-{type}-{coQuan}-...--{uuid}
  const slugRe = /van-ban\/chi-tiet\/([\w][\w-]+--[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/g;
  const found = new Map<string, string>(); // slug → title

  let match: RegExpExecArray | null;
  while ((match = slugRe.exec(rscText)) !== null) {
    const slug = match[1];
    if (found.has(slug)) continue;

    // Tìm title gần vị trí slug (RSC thường đặt title sau href)
    const afterSlug = rscText.slice(match.index, match.index + 2000);
    const titleMatch = afterSlug.match(/"children":"([^"]{10,200})"/);
    const title = titleMatch ? titleMatch[1] : "";

    found.set(slug, title);
  }

  // Nếu RSC không chứa slugs (data được hydrate client-side),
  // fallback: tạo URL trực tiếp từ keyword
  if (found.size === 0) {
    log.info({ keyword }, "RSC payload has no slugs, checking if keyword matches known pattern");
    // Không trả kết quả — data thực sự chỉ render ở client
    return [];
  }

  for (const [slug, title] of found) {
    const soHieu = extractSoHieuFromSlug(slug);
    const loaiVB = extractLoaiVBFromSlug(slug);

    results.push({
      soHieu,
      trichYeu: title || soHieu,
      loaiVB,
      coQuanBanHanh: "",
      ngayBanHanh: "",
      detailUrl: `${BASE_URL}/van-ban/chi-tiet/${slug}`,
      slug,
    });
  }

  log.info({ keyword, count: results.length }, "Parsed VBPL RSC results");
  return results.slice(0, 20);
}

// ─── Helpers ───────────────────────────────────────────────────────

function extractSoHieuFromSlug(slug: string): string {
  const cleanSlug = slug.replace(/--[a-f0-9-]{36}$/, "");
  const m = cleanSlug.match(/so-(\d+)-(\d{4})-([a-z]+)-([a-z]+)/i);
  if (m) return `${m[1]}/${m[2]}/${m[3].toUpperCase()}-${m[4].toUpperCase()}`;
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
