import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../../shared/logger.js";
import { env, dataDir } from "../../config/env.js";

const log = createLogger("tvpl-crawler");

const BASE_URL = "https://thuvienphapluat.vn";
/** Form đăng nhập nằm trên trang chủ, KHÔNG phải /Account/Login.aspx */
const LOGIN_URL = `${BASE_URL}/`;
const SEARCH_URL = `${BASE_URL}/page/tim-van-ban.aspx`;
const DOWNLOAD_URL = `${BASE_URL}/documents/download.aspx`;

/** Headers giả trình duyệt Chrome để bypass Cloudflare/bot detection */
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
};


// ─── Types ─────────────────────────────────────────────────────────

export type TvplSearchResult = {
  /** ID văn bản (dùng cho download) */
  docId: string;
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
  /** Hiệu lực */
  hieuLuc: string;
  /** URL trang chi tiết */
  detailUrl: string;
};

export type TvplDownloadResult = {
  /** Đường dẫn file đã tải trên đĩa */
  filePath: string | null;
  /** Định dạng file */
  format: "pdf" | "doc" | "docx";
  /** Kích thước (bytes) */
  fileSize: number;
  /** Lỗi nếu có */
  error?: string;
};

// ─── Session Management ────────────────────────────────────────────

/** Cookie jar đơn giản */
let sessionCookies: string[] = [];
let sessionValid = false;
let lastLoginAt = 0;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 phút

/**
 * Đăng nhập TVPL.
 *
 * ⚠️ TVPL dùng Cloudflare JS Challenge (Turnstile) → KHÔNG THỂ login tự động
 * bằng fetch(). Có 2 cách:
 * 1. **Ưu tiên**: Admin paste session cookie vào biến TVPL_SESSION_COOKIES trong .env
 *    (lấy từ DevTools khi đã login trên trình duyệt).
 *    Format: "ASP.NET_SessionId=abc;.ASPXAUTH=def"
 * 2. **Dự phòng**: Gọi login() sẽ thử qua Cloudflare nhưng rất có thể bị 403.
 */
async function login(): Promise<boolean> {
  // Ưu tiên 1: Cookie thủ công từ env
  const manualCookies = process.env.TVPL_SESSION_COOKIES?.trim();
  if (manualCookies) {
    sessionCookies = manualCookies.split(";").map((c) => c.trim()).filter(Boolean);
    const hasAuth = sessionCookies.some((c) => c.includes(".ASPXAUTH") || c.includes("ASP.NET_SessionId"));
    if (hasAuth) {
      sessionValid = true;
      lastLoginAt = Date.now();
      log.info("TVPL using manual session cookies from env");
      return true;
    }
    log.warn("TVPL_SESSION_COOKIES set but missing .ASPXAUTH or ASP.NET_SessionId");
  }

  // Ưu tiên 2: Thử auto-login (thường bị Cloudflare chặn)
  const username = env.TVPL_USERNAME;
  const password = env.TVPL_PASSWORD;

  if (!username || !password) {
    log.warn("TVPL credentials not configured - skipping login");
    return false;
  }

  try {
    // Bước 1: GET trang chủ để lấy __VIEWSTATE và __EVENTVALIDATION
    const getRes = await fetch(LOGIN_URL, {
      headers: BROWSER_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const loginHtml = await getRes.text();
    const viewState = extractHiddenField(loginHtml, "__VIEWSTATE");
    const eventValidation = extractHiddenField(loginHtml, "__EVENTVALIDATION");
    const viewStateGen = extractHiddenField(loginHtml, "__VIEWSTATEGENERATOR");
    // Lấy cookie từ GET
    const getCookies = extractSetCookies(getRes.headers);

    // Bước 2: POST đăng nhập (field names từ trang chủ, KHÔNG phải ContentPlaceHolder)
    const formData = new URLSearchParams({
      __VIEWSTATE: viewState || "",
      __VIEWSTATEGENERATOR: viewStateGen || "",
      __EVENTVALIDATION: eventValidation || "",
      __EVENTTARGET: "loginButton",
      usernameTextBox: username,
      passwordTextBox: password,
    });

    const postRes = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": LOGIN_URL,
        Cookie: getCookies.join("; "),
      },
      body: formData.toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });

    const postCookies = extractSetCookies(postRes.headers);
    sessionCookies = [...getCookies, ...postCookies];

    // Kiểm tra đăng nhập thành công: có .ASPXAUTH cookie
    const hasAuth = sessionCookies.some((c) => c.includes(".ASPXAUTH"));
    if (hasAuth) {
      sessionValid = true;
      lastLoginAt = Date.now();
      log.info("TVPL login successful");
      return true;
    }

    log.warn({ status: postRes.status }, "TVPL login failed - no auth cookie");
    return false;
  } catch (err) {
    log.error({ err }, "TVPL login error");
    return false;
  }
}

async function ensureSession(): Promise<boolean> {
  if (sessionValid && Date.now() - lastLoginAt < SESSION_TTL_MS) {
    return true;
  }
  return login();
}

// ─── Search ────────────────────────────────────────────────────────

/**
 * Tìm VB trên TVPL theo keyword.
 * Parse HTML kết quả tìm kiếm để lấy danh sách VB.
 */
export async function searchTvpl(keyword: string): Promise<TvplSearchResult[]> {
  if (!(await ensureSession())) {
    log.warn("Cannot search TVPL - not logged in");
    return [];
  }

  const url = `${SEARCH_URL}?keyword=${encodeURIComponent(keyword)}&match=True&area=0`;

  try {
    const res = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        Cookie: sessionCookies.join("; "),
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      log.warn({ status: res.status }, "TVPL search failed");
      return [];
    }

    const html = await res.text();
    return parseTvplSearchResults(html);
  } catch (err) {
    log.error({ err, keyword }, "TVPL search error");
    return [];
  }
}

// ─── Download ──────────────────────────────────────────────────────

/** Rate limiter đơn giản */
let downloadCount = 0;
let downloadWindowStart = Date.now();

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - downloadWindowStart > 3_600_000) {
    downloadCount = 0;
    downloadWindowStart = now;
  }
  return downloadCount < env.TVPL_MAX_DOWNLOADS_PER_HOUR;
}

/**
 * Tải VB từ TVPL.
 * @param docId ID hoặc token của VB trên TVPL
 * @param format Định dạng mong muốn: "pdf" | "doc" | "docx"
 * @param soHieu Số hiệu VB (dùng đặt tên file)
 */
export async function downloadTvplDocument(
  docId: string,
  format: "pdf" | "doc" | "docx" = "pdf",
  soHieu?: string,
): Promise<TvplDownloadResult> {
  if (!(await ensureSession())) {
    return { filePath: null, format, fileSize: 0, error: "Chưa đăng nhập TVPL" };
  }

  if (!checkRateLimit()) {
    return { filePath: null, format, fileSize: 0, error: `Đã vượt trần ${env.TVPL_MAX_DOWNLOADS_PER_HOUR} file/giờ` };
  }

  // Tạo URL tải
  let downloadParams: string;
  switch (format) {
    case "pdf":
      downloadParams = `id=${encodeURIComponent(docId)}&part=-100`;
      break;
    case "doc":
      downloadParams = `id=${encodeURIComponent(docId)}&part=-1&docx=`;
      break;
    case "docx":
      downloadParams = `id=${encodeURIComponent(docId)}&part=-1&docx=1`;
      break;
  }

  const url = `${DOWNLOAD_URL}?${downloadParams}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "VBAI-Bot/1.0",
        Cookie: sessionCookies.join("; "),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      // Session hết hạn → thử login lại 1 lần
      if (res.status === 302 || res.status === 401 || res.status === 403) {
        sessionValid = false;
        if (await ensureSession()) {
          return downloadTvplDocument(docId, format, soHieu);
        }
      }
      return { filePath: null, format, fileSize: 0, error: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") || "";
    // Kiểm tra có phải file thật không (tránh redirect về trang login HTML)
    if (contentType.includes("text/html")) {
      sessionValid = false;
      return { filePath: null, format, fileSize: 0, error: "Session hết hạn, cần đăng nhập lại" };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) {
      return { filePath: null, format, fileSize: 0, error: "File quá nhỏ, có thể lỗi" };
    }

    const dir = getTvplStorageDir();
    const safeName = (soHieu || docId).replace(/[\\/:*?"<>|]/g, "-");
    const ext = format === "pdf" ? ".pdf" : format === "docx" ? ".docx" : ".doc";
    const filePath = path.join(dir, `${safeName}_tvpl${ext}`);

    fs.writeFileSync(filePath, buffer);
    downloadCount++;
    log.info({ filePath, size: buffer.length, format }, "Downloaded TVPL document");
    return { filePath, format, fileSize: buffer.length };
  } catch (err) {
    log.error({ err, docId }, "TVPL download error");
    return { filePath: null, format, fileSize: 0, error: String(err) };
  }
}

// ─── HTML Parsing ──────────────────────────────────────────────────

/**
 * Parse kết quả tìm kiếm TVPL từ HTML.
 *
 * Cấu trúc HTML (đã xác minh):
 * ```html
 * <div class="nqDoc">
 *   <p class="nqTitle"><a href="/van-ban/xxx">Trích yếu</a></p>
 *   <div class="nqInfor">Thông tin cơ quan, ngày, hiệu lực</div>
 * </div>
 * ```
 */
function parseTvplSearchResults(html: string): TvplSearchResult[] {
  const results: TvplSearchResult[] = [];

  // Pattern: link văn bản trong danh sách kết quả
  const docRe = /<p\s+class="nqTitle"[^>]*>\s*<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  let match: RegExpExecArray | null;

  while ((match = docRe.exec(html)) !== null) {
    const [, href, title] = match;
    const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Trích docId từ URL: /van-ban/xxx-{docId}.aspx hoặc query string
    const idMatch = href.match(/(\d+)\.aspx/);
    const docId = idMatch ? idMatch[1] : href;

    // Trích số hiệu từ tiêu đề
    const shMatch = title.match(/(?:số\s+)?([\d/]+[\w-]+)/i);
    const soHieu = shMatch ? shMatch[1] : "";

    results.push({
      docId,
      soHieu,
      trichYeu: title.trim(),
      loaiVB: guessLoaiVB(title),
      coQuanBanHanh: "",
      ngayBanHanh: "",
      hieuLuc: "",
      detailUrl: fullUrl,
    });
  }

  log.info({ count: results.length }, "Parsed TVPL search results");
  return results.slice(0, 20); // Giới hạn 20 kết quả
}

function guessLoaiVB(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("nghị định")) return "Nghị định";
  if (t.includes("thông tư")) return "Thông tư";
  if (t.includes("quyết định")) return "Quyết định";
  if (t.includes("nghị quyết")) return "Nghị quyết";
  if (t.includes("luật")) return "Luật";
  if (t.includes("pháp lệnh")) return "Pháp lệnh";
  if (t.includes("chỉ thị")) return "Chỉ thị";
  if (t.includes("công văn")) return "Công văn";
  return "Văn bản";
}

// ─── Helpers ───────────────────────────────────────────────────────

function extractHiddenField(html: string, fieldName: string): string | null {
  const re = new RegExp(`id="${fieldName}"[^>]*value="([^"]*)"`, "i");
  const match = html.match(re);
  return match ? match[1] : null;
}

function extractSetCookies(headers: Headers): string[] {
  const cookies: string[] = [];
  // Headers.getSetCookie() available in Node 20+
  const raw = headers.getSetCookie?.() || [];
  for (const cookie of raw) {
    // Lấy phần name=value, bỏ path/domain/expires
    const nameVal = cookie.split(";")[0].trim();
    if (nameVal) cookies.push(nameVal);
  }
  return cookies;
}

export function getTvplStorageDir(): string {
  const dir = path.join(dataDir, "tvpl");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function isTvplConfigured(): boolean {
  return !!env.TVPL_USERNAME && !!env.TVPL_PASSWORD;
}
