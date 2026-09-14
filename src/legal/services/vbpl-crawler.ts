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

// ─── 1. Search ─────────────────────────────────────────────────────

/**
 * Tìm VB trên CSDL quốc gia về pháp luật (vbpl.vn).
 * Ưu tiên gọi Next.js Server Action trực tiếp (nhanh, 100ms).
 */
export async function searchVbpl(keyword: string): Promise<VbplSearchResult[]> {
  try {
    const results = await searchVbplServerAction(keyword);
    if (results.length > 0) return results;
  } catch (err) {
    log.warn({ err, keyword }, "VBPL Server Action search failed, trying browser fallback");
  }

  // Fallback: browser-based search
  return searchVbplBrowser(keyword);
}

/**
 * Search qua Next.js Server Action.
 */
async function searchVbplServerAction(keyword: string): Promise<VbplSearchResult[]> {
  const url = `${BASE_URL}/van-ban/trung-uong`;
  const params = {
    keyword,
    page: 1,
    pageSize: 15,
  };

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

  log.info({ keyword, count: results.length }, "VBPL Server Action search completed");
  return results;
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
