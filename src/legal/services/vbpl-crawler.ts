/**
 * VBPL Crawler & Download Service
 *
 * Tra cứu và tải văn bản từ Cơ sở dữ liệu quốc gia về pháp luật (vbpl.vn / MOJ Gateway).
 *
 * Cơ chế hoạt động:
 * 1. Search:
 *    - Sử dụng Next.js Server Action (POST https://vbpl.vn/van-ban/trung-uong)
 *      với Action ID đã bóc tách từ Next.js bundles, trả về RSC JSON stream tức thì (100ms).
 *    - Fallback nếu Action ID thay đổi: dùng Puppeteer headless Chromium trên VPS.
 * 2. Download:
 *    - Gọi API công khai Bộ Tư pháp: https://vbpl-bientap-gateway.moj.gov.vn/api/qtdc/public/doc/${id}
 *      để lấy tên file gốc (PDF / DOCX).
 *    - Tải trực tiếp từ MinIO bucket công khai:
 *      https://vbpl-bientap-gateway.moj.gov.vn/api/qtdc/public/doc/minio/buckets/vbpl/${id}/${fileName}/download
 *    - Fallback nếu direct fetch bị chặn: dùng Puppeteer headless Chromium kích hoạt tab "Văn bản gốc"
 *      và capture buffer từ network stream.
 */
import { createLogger } from "../../shared/logger.js";
import { mkdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

const log = createLogger("vbpl-crawler");

const BASE_URL = "https://vbpl.vn";
const MOJ_GATEWAY_URL = "https://vbpl-bientap-gateway.moj.gov.vn/api";
const DOWNLOAD_DIR = join(process.cwd(), "data", "vbpl");
const CHROMIUM_PATH = "/usr/bin/chromium-browser";

// Next.js Server Action ID for document search on vbpl.vn
const SEARCH_ACTION_ID = "c529d164f28418e5898a834422629e64c6816af1";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/x-component, application/json, text/plain, */*",
};

// ─── Types ─────────────────────────────────────────────────────────

export type VbplSearchResult = {
  soHieu: string;
  trichYeu: string;
  loaiVB: string;
  coQuanBanHanh: string;
  ngayBanHanh: string;
  detailUrl: string;
  slug: string;
};

export type VbplDownloadResult = {
  filePath: string | null;
  format: string;
  fileSize: number;
  error?: string;
};

const DOC_TYPE_MAP: Record<string, string> = {
  "nghi-dinh": "0d08b84c-7de7-4800-8760-2a68265e7890",
};

export type VbplSearchParams = {
  keyword?: string;
  docType?: string[];
  agencyIds?: string[];
  issueDateFrom?: string;
  issueDateTo?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

/**
 * Phân tích câu hỏi người dùng để trích xuất bộ lọc thời gian và loại văn bản.
 * Hỗ trợ các câu hỏi như:
 * - "tôi cần tải các nghị định mới nhất vừa ban hành trong tháng 7"
 * - "Nghị định ban hành tháng 7 năm 2026"
 * - "nghị định mới nhất"
 */
export function parseTemporalAndCategoryFilter(rawKeyword: string): VbplSearchParams | null {
  const text = rawKeyword.trim();
  const lower = text.toLowerCase();

  let hasFilter = false;
  let docType: string[] | undefined = undefined;
  let issueDateFrom: string | undefined = undefined;
  let issueDateTo: string | undefined = undefined;
  let sortBy = "issueDate";
  let sortDirection: "asc" | "desc" = "desc";

  // 1. Loại văn bản (Nghị định)
  if (/\b(nghị định|nđ|nghidinh)\b/i.test(lower)) {
    docType = [DOC_TYPE_MAP["nghi-dinh"]];
    hasFilter = true;
  }

  // 2. Năm ban hành
  let year = new Date().getFullYear();
  const yearMatch = text.match(/\b(202[0-9])\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
    hasFilter = true;
  }

  // 3. Tháng ban hành
  const monthMatch = text.match(/\btháng\s*([0-9]{1,2})\b/i);
  if (monthMatch) {
    const m = parseInt(monthMatch[1], 10);
    if (m >= 1 && m <= 12) {
      const padM = String(m).padStart(2, "0");
      const lastDay = new Date(year, m, 0).getDate();
      issueDateFrom = `${year}-${padM}-01T00:00:00`;
      issueDateTo = `${year}-${padM}-${lastDay}T23:59:59`;
      hasFilter = true;
    }
  }

  // 4. Các cụm từ chỉ tính mới
  if (/\b(mới nhất|vừa ban hành|gần đây|mới ban hành)\b/i.test(lower)) {
    hasFilter = true;
  }

  if (!hasFilter) return null;

  // Lược bỏ các từ khóa chức năng/thời gian để lại chủ đề tìm kiếm (nếu có)
  const cleaned = text
    .replace(/\b(tôi cần|cần|hãy|cho tôi xin|cho xin|tìm|tải|tra cứu|xem|danh sách|quét)\b/gi, "")
    .replace(/\b(các|những|toàn bộ|tất cả|mới nhất|vừa ban hành|mới ban hành|gần đây)\b/gi, "")
    .replace(/\b(nghị định|nđ|quyết định|thông tư|luật|nghị quyết)\b/gi, "")
    .replace(/\b(ban hành|phát hành)\b/gi, "")
    .replace(/\b(trong\s+)?tháng\s*[0-9]{1,2}(\s*năm\s*202[0-9])?\b/gi, "")
    .replace(/\b(năm\s*)?202[0-9]\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    keyword: cleaned.length > 1 ? cleaned : "",
    docType,
    issueDateFrom,
    issueDateTo,
    sortBy,
    sortDirection,
    page: 1,
    pageSize: 15,
  };
}

export function getSearchCandidates(rawKeyword: string): string[] {
  const candidates: string[] = [];
  const trimmed = rawKeyword.trim();
  if (!trimmed) return candidates;

  // 1. Trích xuất mẫu số hiệu nếu có (VD: 349/2026/NĐ-CP hoặc 349/2026)
  const match = trimmed.match(/(\d+\/\d{4}(?:\/[A-ZĐa-zđ0-9_-]+)?)/i);
  if (match) {
    const fullSoHieu = match[1].toUpperCase();
    candidates.push(fullSoHieu);
    const numYear = fullSoHieu.replace(/\/[A-ZĐ0-9_-]+$/i, "");
    if (!candidates.includes(numYear)) candidates.push(numYear);
  }

  // 2. Lược bỏ từ khóa giao tiếp (Nghị định, Thông tư, Tải, Tra cứu...)
  const stripped = trimmed
    .replace(/^(tải|tìm|tra cứu|xem|cho tôi xin|cho xin|hãy tải|tải giúp)\s+/i, "")
    .replace(/^(nghị định|nghị quyết|thông tư|quyết định|luật|pháp lệnh|chỉ thị|vb|văn bản|nđ|nq|tt|qđ)\s+/i, "")
    .trim();
  if (stripped && !candidates.includes(stripped)) {
    candidates.push(stripped);
  }

  // 3. Toàn bộ chuỗi nguyên bản
  if (!candidates.includes(trimmed)) {
    candidates.push(trimmed);
  }

  return candidates;
}

// ─── 1. Search ─────────────────────────────────────────────────────

/**
 * Tìm VB trên CSDL quốc gia về pháp luật (vbpl.vn).
 * Hỗ trợ tự động nhận diện bộ lọc thời gian (tháng/năm) và loại VB (Nghị định),
 * kết hợp Server Action có retry và dự phòng candidates.
 */
export async function searchVbpl(keyword: string): Promise<VbplSearchResult[]> {
  // 1. Kiểm tra xem query có chứa bộ lọc thời gian / loại VB hay không
  const temporalFilter = parseTemporalAndCategoryFilter(keyword);
  if (temporalFilter) {
    try {
      const results = await searchVbplServerAction(temporalFilter);
      if (results.length > 0) return results;

      // Nếu có keyword chủ đề nhưng không ra kết quả, thử quét toàn bộ theo tháng (bỏ keyword chủ đề)
      if (temporalFilter.keyword) {
        const broadResults = await searchVbplServerAction({ ...temporalFilter, keyword: "" });
        if (broadResults.length > 0) return broadResults;
      }
    } catch (err) {
      log.warn({ err, keyword }, "VBPL temporal filter search failed, falling back to candidates");
    }
  }

  // 2. Thử từng từ khóa ứng viên
  const candidates = getSearchCandidates(keyword);
  for (const cand of candidates) {
    try {
      const results = await searchVbplServerAction(cand);
      if (results.length > 0) return results;
    } catch (err) {
      log.warn({ err, cand }, "VBPL Server Action search candidate failed, trying next candidate");
    }
  }

  // 3. Fallback: browser-based search
  for (const cand of candidates) {
    try {
      const results = await searchVbplBrowser(cand);
      if (results.length > 0) return results;
    } catch (err) {
      log.warn({ err, cand }, "VBPL browser search candidate failed");
    }
  }

  return [];
}

/**
 * Search qua Next.js Server Action có cơ chế retry khi gặp lỗi 500 ngẫu nhiên từ server.
 */
async function searchVbplServerAction(queryOrParams: string | VbplSearchParams): Promise<VbplSearchResult[]> {
  const url = `${BASE_URL}/van-ban/trung-uong`;
  const params =
    typeof queryOrParams === "string"
      ? { keyword: queryOrParams, page: 1, pageSize: 15 }
      : { page: 1, pageSize: 15, ...queryOrParams };

  const maxAttempts = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/json",
          "Next-Action": SEARCH_ACTION_ID,
        },
        body: JSON.stringify([params]),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`VBPL Server Action HTTP ${res.status}`);
      }

      const text = await res.text();
      const results: VbplSearchResult[] = [];

      // Parse Flight RSC response - data nằm ở dòng "1:{...}"
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("1:")) {
          try {
            const jsonStr = line.slice(2);
            const data = JSON.parse(jsonStr) as {
              total?: number;
              items?: Array<{
                id: string;
                docNum?: string;
                title?: string;
                agencyName?: string;
                issueDate?: string;
                docType?: { name?: string };
              }>;
            };

            if (Array.isArray(data.items)) {
              for (const item of data.items) {
                results.push({
                  soHieu: item.docNum || "",
                  trichYeu: item.title || item.docNum || "",
                  loaiVB: item.docType?.name || extractLoaiVBFromTitle(item.title || ""),
                  coQuanBanHanh: item.agencyName || "",
                  ngayBanHanh: item.issueDate ? item.issueDate.slice(0, 10) : "",
                  detailUrl: `${BASE_URL}/van-ban/chi-tiet/${item.id}`,
                  slug: item.id,
                });
              }
            }
          } catch (parseErr) {
            log.warn({ parseErr }, "Error parsing VBPL RSC line 1");
          }
          break;
        }
      }

      log.info({ params, count: results.length, attempt }, "VBPL Server Action search completed");
      return results;
    } catch (err) {
      lastError = err;
      log.warn({ err, params, attempt }, "VBPL Server Action attempt failed");
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
  }

  throw lastError || new Error(`VBPL Server Action failed after ${maxAttempts} attempts`);
}

// ─── 2. Download ───────────────────────────────────────────────────

/**
 * Tải văn bản từ vbpl.vn / MOJ Gateway.
 * @param docIdOrSlug ID (UUID hoặc integer) hoặc slug của văn bản
 * @param format "pdf" | "docx"
 * @param soHieu Số hiệu văn bản để đặt tên file
 */
export async function downloadVbplDocument(
  docIdOrSlug: string,
  format: "pdf" | "docx" = "pdf",
  soHieu?: string,
): Promise<VbplDownloadResult> {
  mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const docId = extractDocId(docIdOrSlug);

  // Thử tải trực tiếp qua MOJ MinIO Gateway trước (cực nhanh, không cần mở Chrome)
  try {
    const directRes = await downloadFromMojGateway(docId, format, soHieu);
    if (directRes.filePath) {
      return directRes;
    }
    log.warn({ docId, error: directRes.error }, "Direct MOJ download failed, trying browser");
  } catch (err) {
    log.warn({ err, docId }, "MOJ direct gateway error, falling back to browser");
  }

  // Fallback: dùng Puppeteer headless Chromium
  return downloadWithPuppeteer(docIdOrSlug, format, soHieu);
}

/**
 * Tải trực tiếp qua MOJ Gateway REST + MinIO.
 */
async function downloadFromMojGateway(
  docId: string,
  format: "pdf" | "docx",
  soHieu?: string,
): Promise<VbplDownloadResult> {
  // B1: Lấy metadata để biết chính xác tên file gốc
  const metaUrl = `${MOJ_GATEWAY_URL}/qtdc/public/doc/${docId}`;
  const metaRes = await fetch(metaUrl, {
    headers: { Accept: "application/json", "User-Agent": BROWSER_HEADERS["User-Agent"] },
    signal: AbortSignal.timeout(10_000),
  });

  if (!metaRes.ok) {
    return { filePath: null, format, fileSize: 0, error: `MOJ metadata HTTP ${metaRes.status}` };
  }

  const metaJson = (await metaRes.json()) as {
    data?: {
      docNum?: string;
      title?: string;
      documentContentFileName?: string; // PDF
      documentContentFileDocName?: string; // DOCX
    };
  };

  const data = metaJson.data;
  if (!data) {
    return { filePath: null, format, fileSize: 0, error: "Không tìm thấy dữ liệu văn bản trên MOJ" };
  }

  const exactFileName = format === "docx"
    ? data.documentContentFileDocName || data.documentContentFileName?.replace(/\.pdf$/i, ".docx")
    : data.documentContentFileName;

  if (!exactFileName) {
    return { filePath: null, format, fileSize: 0, error: `Không có file ${format} cho văn bản này` };
  }

  // B2: Tải file từ MinIO bucket
  const fileUrl = `${MOJ_GATEWAY_URL}/qtdc/public/doc/minio/buckets/vbpl/${docId}/${encodeURIComponent(exactFileName)}/download`;
  log.info({ docId, exactFileName, fileUrl }, "Downloading from MOJ MinIO");

  const fileRes = await fetch(fileUrl, {
    headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] },
    signal: AbortSignal.timeout(60_000),
  });

  if (!fileRes.ok) {
    return { filePath: null, format, fileSize: 0, error: `MOJ MinIO HTTP ${fileRes.status}` };
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 1000) {
    return { filePath: null, format, fileSize: 0, error: "File tải về dung lượng quá nhỏ" };
  }

  const effectiveSoHieu = soHieu || data.docNum || exactFileName.replace(/\.(pdf|docx)$/i, "");
  const safeName = effectiveSoHieu.replace(/[/\\:*?"<>|]/g, "-");
  const ext = format === "docx" ? "docx" : "pdf";
  const filePath = join(DOWNLOAD_DIR, `${safeName}.${ext}`);

  writeFileSync(filePath, buffer);
  log.info({ filePath, size: buffer.length }, "VBPL document downloaded directly from MOJ");

  return {
    filePath,
    format: ext,
    fileSize: buffer.length,
  };
}

// ─── 3. Puppeteer Fallbacks ────────────────────────────────────────

let puppeteer: any = null;

async function getPuppeteer(): Promise<any> {
  if (!puppeteer) {
    try {
      const pkg = "puppeteer-core";
      puppeteer = await import(pkg);
    } catch {
      log.warn("puppeteer-core not installed");
      return null;
    }
  }
  return puppeteer;
}

async function launchBrowser(): Promise<any> {
  const pptr = await getPuppeteer();
  if (!pptr) throw new Error("puppeteer-core chưa được cài đặt");

  const execPath = [CHROMIUM_PATH, "/usr/bin/chromium", "/usr/bin/google-chrome"].find((p) =>
    existsSync(p),
  );

  if (!execPath) throw new Error("Không tìm thấy Chromium trên server");

  return pptr.default.launch({
    executablePath: execPath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
    ],
    timeout: 30_000,
  });
}

/**
 * Fallback download dùng Puppeteer Chromium headless.
 * Kích hoạt tab "Văn bản gốc" và bắt buffer từ response event.
 */
async function downloadWithPuppeteer(
  docIdOrSlug: string,
  format: "pdf" | "docx" = "pdf",
  soHieu?: string,
): Promise<VbplDownloadResult> {
  let browser: any;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(BROWSER_HEADERS["User-Agent"]);

    let capturedBuf: Buffer | null = null;

    // Intercept network response containing the file
    page.on("response", async (res: any) => {
      const ct = res.headers()["content-type"] || "";
      const url = res.url();
      if (
        (ct.includes("octet-stream") || ct.includes("pdf")) &&
        (url.includes("vbpl-bientap-gateway") || url.includes("minio") || url.includes(".pdf"))
      ) {
        try {
          const buf = await res.buffer();
          if (buf.length > 5000) {
            capturedBuf = buf;
          }
        } catch {}
      }
    });

    const targetUrl = `${BASE_URL}/van-ban/chi-tiet/${docIdOrSlug}`;
    log.info({ targetUrl }, "VBPL browser download fallback navigating");
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 30_000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Click tab "Văn bản gốc"
    await page.evaluate(() => {
      const doc = (globalThis as any).document;
      const allDivs = Array.from(doc.querySelectorAll("div"));
      const tab = allDivs.find((d: any) => d.textContent?.trim() === "Văn bản gốc" && d.children.length === 0);
      if (tab) (tab as any).click();
    });

    // Wait for captured buffer up to 15 seconds
    for (let i = 0; i < 15; i++) {
      if (capturedBuf) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!capturedBuf || (capturedBuf as Buffer).length < 1000) {
      return { filePath: null, format, fileSize: 0, error: "Browser timeout waiting for file stream" };
    }

    const safeName = (soHieu || docIdOrSlug.slice(0, 60)).replace(/[/\\:*?"<>|]/g, "-");
    const ext = format === "docx" ? "docx" : "pdf";
    const filePath = join(DOWNLOAD_DIR, `${safeName}.${ext}`);

    writeFileSync(filePath, capturedBuf);
    return {
      filePath,
      format: ext,
      fileSize: (capturedBuf as Buffer).length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err, docIdOrSlug }, "Puppeteer download error");
    return { filePath: null, format, fileSize: 0, error: msg };
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * Fallback search dùng Puppeteer Chromium headless.
 */
async function searchVbplBrowser(keyword: string): Promise<VbplSearchResult[]> {
  let browser: any;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(BROWSER_HEADERS["User-Agent"]);

    const searchUrl = `${BASE_URL}/van-ban/trung-uong?keyword=${encodeURIComponent(keyword)}&isSearchFromDetail=true`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30_000 });
    await new Promise((r) => setTimeout(r, 5000));

    const results = await page.evaluate(() => {
      const doc = (globalThis as any).document;
      const items: VbplSearchResult[] = [];
      const links = Array.from(doc.querySelectorAll('a[href*="/van-ban/chi-tiet/"]'));
      for (const a of links as any[]) {
        const href = a.getAttribute("href") || "";
        const title = a.textContent?.trim() || "";
        const slug = href.split("/van-ban/chi-tiet/")[1] || "";
        if (title.length > 5 && slug && !items.some((i) => i.slug === slug)) {
          items.push({
            soHieu: "",
            trichYeu: title,
            loaiVB: "",
            coQuanBanHanh: "",
            ngayBanHanh: "",
            detailUrl: a.href,
            slug,
          });
        }
      }
      return items;
    });

    return results;
  } catch (err) {
    log.error({ err, keyword }, "VBPL browser search error");
    return [];
  } finally {
    await browser?.close().catch(() => {});
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Trích xuất UUID hoặc numeric ID từ chuỗi slug/URL.
 * Ví dụ: "...--c5481e50-acfc-11f1-acd5-4df39554f44f" → "c5481e50-acfc-11f1-acd5-4df39554f44f"
 */
function extractDocId(slugOrId: string): string {
  if (/^[a-f0-9-]{36}$/i.test(slugOrId) || /^\d+$/.test(slugOrId)) {
    return slugOrId;
  }
  const match = slugOrId.match(/--([a-f0-9-]{36})$/i) || slugOrId.match(/--(\d+)$/);
  if (match) return match[1];
  return slugOrId;
}

function extractLoaiVBFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("nghị định")) return "Nghị định";
  if (t.includes("thông tư liên tịch")) return "Thông tư liên tịch";
  if (t.includes("thông tư")) return "Thông tư";
  if (t.includes("quyết định")) return "Quyết định";
  if (t.includes("nghị quyết")) return "Nghị quyết";
  if (t.includes("luật")) return "Luật";
  if (t.includes("pháp lệnh")) return "Pháp lệnh";
  if (t.includes("chỉ thị")) return "Chỉ thị";
  return "Văn bản";
}
