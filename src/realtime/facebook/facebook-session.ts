/**
 * facebook-session.ts
 * Quản lý phiên đăng nhập Facebook CÁ NHÂN để crawler xem được fanpage
 * khi không có Graph API token.
 *
 * Nguyên tắc an toàn:
 * - KHÔNG BAO GIỜ lưu mật khẩu. Mật khẩu chỉ nằm trong RAM trong lúc login,
 *   sau đó chỉ cookie phiên (c_user, xs, datr...) được lưu, mã hoá AES-256-GCM
 *   bằng CREDENTIALS_ENCRYPTION_KEY vào data/facebook-session.enc.
 * - Facebook hay bắt xác minh (2FA / checkpoint) khi login từ IP lạ (VPS).
 *   Trường hợp đó giữ trình duyệt mở tối đa 5 phút chờ Admin nhập mã.
 * - Đường dự phòng: Admin dán cookie export từ trình duyệt đang đăng nhập.
 *
 * Khuyến nghị: dùng TÀI KHOẢN PHỤ, không dùng tài khoản chính - Facebook có
 * thể khoá tạm tài khoản bị nghi là bot.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { env } from "../../config/env.js";
import { decryptSecret, encryptSecret } from "../../config/secret-cipher.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("facebook-session");

const DATA_DIR = join(process.cwd(), "data");
const SESSION_FILE = join(DATA_DIR, "facebook-session.enc");
const HARDCODED_COOKIE_FILE = join(DATA_DIR, "facebook-cookie.txt");
export const FB_BROWSER_PROFILE_DIR = join(DATA_DIR, "facebook-browser-profile");

/** UA desktop thật - headless-shell mặc định lộ chữ "HeadlessChrome" */
export const FB_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Ưu tiên chrome-headless-shell ở /opt: bản chromium apt trên Ubuntu 24.04 là
 * snap, chạy dưới pm2/root hay lỗi confinement với puppeteer.
 */
const CHROMIUM_CANDIDATES = [
  "/opt/chrome-headless-shell/chrome-headless-shell",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export type FbCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
};

export type StoredSession = {
  cookies: FbCookie[];
  userId: string;
  savedAt: string;
  source: "password" | "import" | "env" | "file";
};

type SessionHealth = {
  lastCheckAt?: string;
  lastCheckOk?: boolean;
  lastError?: string;
};

const health: SessionHealth = {};

/** Cache trong RAM để không giải mã file mỗi request */
let cached: StoredSession | null | undefined;

// ─────────────────────────── Parse & Lọc Cookie ───────────────────────────

/** Chỉ giữ cookie của facebook.com - không lưu rác của domain khác */
function keepFacebookCookies(cookies: FbCookie[]): FbCookie[] {
  return cookies
    .filter((c) => c && typeof c.name === "string" && typeof c.value === "string")
    .filter((c) => !c.domain || c.domain.includes("facebook.com"))
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || ".facebook.com",
      path: c.path || "/",
      expires: typeof c.expires === "number" ? c.expires : undefined,
      httpOnly: c.httpOnly,
      secure: c.secure ?? true,
    }));
}

/**
 * Phân tích chuỗi cookie (JSON hoặc Header chuỗi "c_user=...; xs=...; datr=...")
 */
export function parseFacebookCookies(
  raw: string,
): { ok: true; cookies: FbCookie[]; userId: string } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Chưa dán cookie" };

  let cookies: FbCookie[] = [];
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const arr = Array.isArray(parsed) ? parsed : (parsed as { cookies?: unknown }).cookies;
      if (!Array.isArray(arr)) return { ok: false, error: "JSON không phải mảng cookie" };
      cookies = (arr as Array<Record<string, unknown>>).map((c) => ({
        name: String(c.name ?? ""),
        value: String(c.value ?? ""),
        domain: typeof c.domain === "string" ? c.domain : undefined,
        path: typeof c.path === "string" ? c.path : undefined,
        expires:
          typeof c.expirationDate === "number"
            ? c.expirationDate
            : typeof c.expires === "number"
              ? c.expires
              : undefined,
        httpOnly: typeof c.httpOnly === "boolean" ? c.httpOnly : undefined,
        secure: typeof c.secure === "boolean" ? c.secure : undefined,
      }));
    } catch {
      return { ok: false, error: "JSON cookie không hợp lệ" };
    }
  } else {
    cookies = text
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf("=");
        return i > 0 ? { name: p.slice(0, i).trim(), value: p.slice(i + 1).trim() } : null;
      })
      .filter((c): c is FbCookie => c !== null);
  }

  cookies = keepFacebookCookies(cookies);
  const cUser = cookies.find((c) => c.name === "c_user")?.value;
  const xs = cookies.find((c) => c.name === "xs")?.value;
  if (!cUser || !xs) {
    return { ok: false, error: "Thiếu cookie c_user hoặc xs - hãy export khi đang ĐĂNG NHẬP facebook.com" };
  }

  return { ok: true, cookies, userId: cUser };
}

// ─────────────────────────── Lưu / đọc phiên ───────────────────────────

function readSession(): StoredSession | null {
  if (cached !== undefined) return cached;

  // 1. Ưu tiên cao nhất: Dán cứng trong biến môi trường FACEBOOK_COOKIE (.env)
  if (env.FACEBOOK_COOKIE && env.FACEBOOK_COOKIE.trim().length > 10) {
    const res = parseFacebookCookies(env.FACEBOOK_COOKIE);
    if (res.ok) {
      cached = {
        cookies: res.cookies,
        userId: res.userId,
        savedAt: "env",
        source: "env",
      };
      return cached;
    } else {
      log.warn({ error: res.error }, "Biến FACEBOOK_COOKIE trong .env không hợp lệ");
    }
  }

  // 2. Ưu tiên thứ hai: Dán cứng trong file text vĩnh viễn data/facebook-cookie.txt
  if (existsSync(HARDCODED_COOKIE_FILE)) {
    try {
      const content = readFileSync(HARDCODED_COOKIE_FILE, "utf8").trim();
      if (content.length > 10) {
        const res = parseFacebookCookies(content);
        if (res.ok) {
          cached = {
            cookies: res.cookies,
            userId: res.userId,
            savedAt: "file",
            source: "file",
          };
          return cached;
        }
      }
    } catch (err) {
      log.warn({ err }, "Không đọc được file cookie cứng data/facebook-cookie.txt");
    }
  }

  // 3. Đọc từ file mã hoá phiên AES-256 data/facebook-session.enc
  try {
    if (!existsSync(SESSION_FILE)) {
      cached = null;
      return null;
    }
    const json = decryptSecret(readFileSync(SESSION_FILE, "utf8").trim());
    const parsed = JSON.parse(json) as StoredSession;
    cached = Array.isArray(parsed.cookies) && parsed.cookies.length > 0 ? parsed : null;
  } catch (err) {
    log.warn({ err }, "Không đọc được phiên Facebook đã lưu (sai khoá hoặc file hỏng)");
    cached = null;
  }
  return cached;
}

function writeSession(session: StoredSession): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(SESSION_FILE, encryptSecret(JSON.stringify(session)), { mode: 0o600 });
  cached = session;
  health.lastCheckOk = true;
  health.lastCheckAt = new Date().toISOString();
  health.lastError = undefined;
}

/** Header `Cookie:` cho fetch(). null = chưa có phiên. */
export function getFacebookCookieHeader(): string | null {
  const s = readSession();
  if (!s) return null;
  return s.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Mảng cookie cho puppeteer page.setCookie() */
export function getFacebookCookies(): FbCookie[] | null {
  return readSession()?.cookies ?? null;
}

export function hasFacebookSession(): boolean {
  return readSession() !== null;
}

/**
 * Crawler gọi khi có cookie mà FB vẫn trả trang login -> phiên hết hạn.
 * Không xoá ngay (có thể chỉ là lỗi tạm), chỉ đánh dấu để Dashboard báo đỏ.
 */
export function reportFacebookSessionResult(ok: boolean, error?: string): void {
  const wasOk = health.lastCheckOk !== false;
  health.lastCheckAt = new Date().toISOString();
  health.lastCheckOk = ok;
  health.lastError = ok ? undefined : error;
  if (!ok && wasOk) log.warn({ error }, "Phiên Facebook có vẻ đã hết hạn - cần đăng nhập lại trong Dashboard");
}

export function clearFacebookSession(): void {
  try {
    if (existsSync(SESSION_FILE)) unlinkSync(SESSION_FILE);
  } catch (err) {
    log.warn({ err }, "Không xoá được file phiên Facebook");
  }
  try {
    if (existsSync(HARDCODED_COOKIE_FILE)) unlinkSync(HARDCODED_COOKIE_FILE);
  } catch (err) {
    log.warn({ err }, "Không xoá được file cookie cứng Facebook");
  }
  cached = undefined;
  health.lastCheckOk = undefined;
  health.lastError = undefined;
  log.info("Đã xoá phiên Facebook");
}

export type FacebookSessionStatus = {
  hasSession: boolean;
  userId?: string;
  savedAt?: string;
  source?: StoredSession["source"];
  isHardcoded: boolean;
  cookieCount: number;
  health: SessionHealth;
  pendingVerification: boolean;
  browserAvailable: boolean;
};

export function getFacebookSessionStatus(): FacebookSessionStatus {
  const s = readSession();
  return {
    hasSession: s !== null,
    userId: s?.userId,
    savedAt: s?.savedAt,
    source: s?.source,
    isHardcoded: s?.source === "env" || s?.source === "file",
    cookieCount: s?.cookies?.length ?? 0,
    health: { ...health },
    pendingVerification: pending !== null && pending.expiresAt > Date.now(),
    browserAvailable: findChromiumPath() !== null,
  };
}

// ─────────────────────────── Import cookie thủ công ───────────────────────────

/**
 * Nhận cookie dán từ trình duyệt (hỗ trợ lưu cứng vào data/facebook-cookie.txt).
 */
export function importFacebookCookies(
  raw: string,
  saveHardcoded = true,
): { ok: true; userId: string; source: StoredSession["source"] } | { ok: false; error: string } {
  const parsed = parseFacebookCookies(raw);
  if (!parsed.ok) return parsed;

  const { cookies, userId } = parsed;

  if (saveHardcoded) {
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(HARDCODED_COOKIE_FILE, raw.trim(), { mode: 0o600 });
      log.info({ userId }, "Đã lưu cứng cookie Facebook vào data/facebook-cookie.txt");
    } catch (err) {
      log.warn({ err }, "Không ghi được file data/facebook-cookie.txt");
    }
  }

  writeSession({
    cookies,
    userId,
    savedAt: new Date().toISOString(),
    source: saveHardcoded ? "file" : "import",
  });

  log.info({ userId, count: cookies.length, saveHardcoded }, "Đã lưu phiên Facebook thành công");
  return { ok: true, userId, source: saveHardcoded ? "file" : "import" };
}

// ─────────────────────────── Trình duyệt headless & Persistent Profile ───────────────────────────

export function findChromiumPath(): string | null {
  return [env.CHROMIUM_PATH, ...CHROMIUM_CANDIDATES].find((p) => p && existsSync(p)) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pptrModule: any = null;

/**
 * Mở Chromium với Persistent Profile (userDataDir) để giữ nguyên IndexedDB,
 * LocalStorage và session tokens của Facebook giữa các lần chạy, tránh bị Meta
 * coi là trình duyệt lạ / session hijacking rồi tự động vô hiệu hoá cookie.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function launchFacebookBrowser(options?: { useProfile?: boolean }): Promise<any> {
  if (!pptrModule) {
    const pkg = "puppeteer-core";
    pptrModule = await import(pkg);
  }
  const executablePath = findChromiumPath();
  if (!executablePath) throw new Error("Không tìm thấy Chromium trên máy chủ");

  const useProfile = options?.useProfile ?? true;
  let userDataDir: string | undefined;
  if (useProfile) {
    userDataDir = FB_BROWSER_PROFILE_DIR;
    try {
      mkdirSync(userDataDir, { recursive: true });
    } catch {
      // Đã tồn tại
    }
  }

  return pptrModule.default.launch({
    executablePath,
    headless: true,
    userDataDir,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-notifications",
      "--lang=vi-VN",
      "--window-size=1280,900",
      // Chống anti-bot: che giấu thuộc tính AutomationControlled
      "--disable-blink-features=AutomationControlled",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-sync",
      "--no-first-run",
      "--mute-audio",
      "--renderer-process-limit=2",
      "--js-flags=--max-old-space-size=512",
    ],
    timeout: 30_000,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function prepareFacebookPage(browser: any): Promise<any> {
  const page = await browser.newPage();
  await page.setUserAgent(FB_BROWSER_UA);
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  });

  // Ẩn navigator.webdriver tránh bị phát hiện tự động
  await page.evaluateOnNewDocument(() => {
    try {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    } catch {
      // Bỏ qua nếu không gán được
    }
  }).catch(() => undefined);

  // Giảm tải RAM/băng thông: bỏ media, font nặng
  await page.setRequestInterception(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page.on("request", (req: any) => {
    const t = req.resourceType();
    if (t === "media" || t === "font") req.abort().catch(() => undefined);
    else req.continue().catch(() => undefined);
  });
  return page;
}

/**
 * Kiểm tra xem phiên Facebook có thật sự còn sống trên Facebook không
 * bằng cách truy cập trang chủ facebook.com. Tránh việc 1 page lẻ bị chặn mà
 * kết luận oan là toàn bộ phiên đã hết hạn.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkIsFacebookSessionAlive(browser: any, cookies?: FbCookie[]): Promise<boolean> {
  let page: any = null;
  try {
    page = await prepareFacebookPage(browser);
    const sessionCookies = cookies ?? getFacebookCookies();
    if (sessionCookies && sessionCookies.length > 0) {
      await page.setCookie(
        ...sessionCookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain ?? ".facebook.com",
          path: c.path ?? "/",
          secure: c.secure ?? true,
          httpOnly: c.httpOnly ?? false,
          ...(c.expires && c.expires > 0 ? { expires: c.expires } : {}),
        })),
      );
    }
    await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded", timeout: 20_000 });
    const currentUrl: string = page.url();
    const isLogin =
      currentUrl.includes("/login") ||
      currentUrl.includes("checkpoint") ||
      (await page.$("#login_form, form[action*='login']").then(Boolean).catch(() => false));
    return !isLogin;
  } catch (err) {
    log.warn({ err }, "Lỗi khi kiểm tra độ sống của phiên Facebook");
    return false;
  } finally {
    if (page) await page.close().catch(() => undefined);
  }
}

// ─────────────────────────── Đăng nhập bằng mật khẩu ───────────────────────────

/** Phiên login đang chờ Admin nhập mã 2FA / duyệt đăng nhập */
let pending: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
} | null = null;

let loginRunning = false;

export type FbVerifyInfo = {
  /** Chữ Facebook đang hiển thị trên màn xác minh (để Admin biết FB muốn gì) */
  pageText?: string;
  /** Ảnh chụp màn xác minh, data URL JPEG */
  screenshot?: string;
};

export type FbLoginResult =
  | { status: "ok"; userId: string }
  | ({ status: "need_code"; message: string } & FbVerifyInfo)
  | ({ status: "need_approval"; message: string } & FbVerifyInfo)
  | { status: "error"; message: string };

async function closePending(): Promise<void> {
  if (!pending) return;
  clearTimeout(pending.timer);
  const b = pending.browser;
  pending = null;
  await b.close().catch(() => undefined);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractSessionIfLoggedIn(page: any): Promise<string | null> {
  const cookies = (await page.cookies("https://www.facebook.com")) as FbCookie[];
  const cUser = cookies.find((c) => c.name === "c_user")?.value;
  const xs = cookies.find((c) => c.name === "xs")?.value;
  if (!cUser || !xs) return null;
  const fbCookies = keepFacebookCookies(cookies);
  writeSession({
    cookies: fbCookies,
    userId: cUser,
    savedAt: new Date().toISOString(),
    source: "password",
  });
  try {
    const rawHeader = fbCookies.map((c) => `${c.name}=${c.value}`).join("; ");
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(HARDCODED_COOKIE_FILE, rawHeader, { mode: 0o600 });
  } catch (err) {
    log.warn({ err }, "Không ghi được file dự phòng facebook-cookie.txt khi login");
  }
  log.info({ userId: cUser }, "Đăng nhập Facebook thành công - đã lưu cookie (không lưu mật khẩu)");
  return cUser;
}

/** Ảnh + chữ của màn hiện tại để Admin thấy đúng thứ Facebook đang yêu cầu */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function captureVerifyInfo(page: any, bodyText: string): Promise<FbVerifyInfo> {
  const shot: string | undefined = await page
    .screenshot({ type: "jpeg", quality: 55, encoding: "base64" })
    .then((b: string) => `data:image/jpeg;base64,${b}`)
    .catch(() => undefined);
  const pageText = bodyText.replace(/\n{2,}/g, "\n").trim().slice(0, 600);
  return { pageText, screenshot: shot };
}

/** Xem trang đang ở bước nào sau khi submit */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function classifyPage(page: any): Promise<FbLoginResult> {
  const userId = await extractSessionIfLoggedIn(page);
  if (userId) return { status: "ok", userId };

  const url: string = page.url();
  const bodyText: string = await page.evaluate("document.body ? document.body.innerText : ''").catch(() => "");
  const hasCodeInput: boolean = await page
    .$('input[name="approvals_code"], input[autocomplete="one-time-code"], input[type="text"][inputmode="numeric"], input[type="tel"]')
    .then((el: unknown) => Boolean(el))
    .catch(() => false);

  const isVerifyScreen =
    hasCodeInput || url.includes("two_step_verification") || url.includes("approvals_code") || url.includes("checkpoint");
  if (isVerifyScreen) {
    const info = await captureVerifyInfo(page, bodyText);
    // Màn "Kiểm tra thông báo trên thiết bị khác" - KHÔNG có mã nào được gửi
    if (!hasCodeInput && /thiết bị khác|another device|thông báo|notification|phê duyệt|approve/i.test(bodyText)) {
      return {
        status: "need_approval",
        message:
          "Facebook KHÔNG gửi mã mà yêu cầu duyệt trên thiết bị đang đăng nhập: mở app Facebook trên điện thoại → thông báo “Đây là bạn?” → “Đúng, là tôi”, rồi bấm “Kiểm tra lại”. Không thấy thông báo thì bấm “Gửi mã qua SMS”.",
        ...info,
      };
    }
    if (hasCodeInput) {
      const viaSms = /tin nhắn|sms|text message|đã gửi|we sent/i.test(bodyText);
      return {
        status: "need_code",
        message: viaSms
          ? "Facebook đã gửi mã qua SMS/email (xem nội dung bên dưới). Nhập mã rồi bấm “Gửi mã”."
          : "Facebook yêu cầu mã 6 số từ app xác thực (Google Authenticator…). Nếu tài khoản không dùng app xác thực, bấm “Gửi mã qua SMS”.",
        ...info,
      };
    }
    return {
      status: "need_approval",
      message: "Facebook đang bắt xác minh (xem ảnh bên dưới). Làm theo hướng dẫn trên ảnh, rồi bấm “Kiểm tra lại”.",
      ...info,
    };
  }

  if (/mật khẩu.*không đúng|incorrect password|wrong password|password you entered/i.test(bodyText)) {
    return { status: "error", message: "Sai mật khẩu" };
  }
  if (/không khớp với tài khoản|isn't connected to an account|find your account/i.test(bodyText)) {
    return { status: "error", message: "Email/SĐT không khớp tài khoản nào" };
  }
  return { status: "error", message: `Không đăng nhập được (đang ở ${url.split("?")[0]})` };
}

function keepPendingAlive(): void {
  if (!pending) return;
  clearTimeout(pending.timer);
  pending.expiresAt = Date.now() + 5 * 60 * 1000;
  pending.timer = setTimeout(() => {
    log.info("Hết 5 phút chờ xác minh Facebook - đóng trình duyệt");
    void closePending();
  }, 5 * 60 * 1000);
}

/**
 * Đăng nhập Facebook bằng email/SĐT + mật khẩu trên Chromium headless.
 * Mật khẩu KHÔNG được lưu ở bất kỳ đâu.
 */
export async function loginFacebookWithPassword(email: string, password: string): Promise<FbLoginResult> {
  if (loginRunning) return { status: "error", message: "Đang có lượt đăng nhập khác chạy" };
  loginRunning = true;
  await closePending();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any;
  try {
    browser = await launchFacebookBrowser();
    const page = await prepareFacebookPage(browser);

    await page.goto("https://www.facebook.com/login/?locale=vi_VN", { waitUntil: "domcontentloaded", timeout: 45_000 });

    // Đóng popup đồng ý cookie (EU/VN đôi khi có)
    await page.evaluate(clickButtonScript("cho phép tất cả|allow all|chấp nhận|accept all")).catch(() => undefined);

    // FB đổi form: id sinh động, nút là div[role=button] -> chọn theo name, submit bằng Enter
    const emailSel = 'input[name="email"], #email';
    const passSel = 'input[name="pass"], #pass';
    await page.waitForSelector(emailSel, { timeout: 20_000 });
    await page.type(emailSel, email, { delay: 40 + Math.random() * 40 });
    await page.type(passSel, password, { delay: 40 + Math.random() * 40 });

    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined),
      page.focus(passSel).then(() => page.keyboard.press("Enter")),
    ]);
    await new Promise((r) => setTimeout(r, 4000));

    const result = await classifyPage(page);
    if (result.status === "need_code" || result.status === "need_approval") {
      pending = { browser, page, expiresAt: 0, timer: setTimeout(() => undefined, 0) };
      keepPendingAlive();
      browser = null; // giữ mở, không đóng ở finally
    }
    return result;
  } catch (err) {
    log.warn({ err }, "Lỗi khi đăng nhập Facebook headless");
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  } finally {
    loginRunning = false;
    if (browser) await browser.close().catch(() => undefined);
  }
}

/**
 * Bước 2: nhập mã 2FA, hoặc (code rỗng) kiểm tra lại sau khi Admin đã duyệt
 * trên app Facebook.
 */
export async function continueFacebookLogin(code?: string): Promise<FbLoginResult> {
  if (!pending || pending.expiresAt < Date.now()) {
    await closePending();
    return { status: "error", message: "Phiên chờ xác minh đã hết hạn - đăng nhập lại từ đầu" };
  }
  const { page } = pending;
  try {
    if (code?.trim()) {
      const sel =
        'input[name="approvals_code"], input[autocomplete="one-time-code"], input[type="text"][inputmode="numeric"], input[type="text"]';
      await page.waitForSelector(sel, { timeout: 10_000 });
      await page.click(sel, { clickCount: 3 });
      await page.type(sel, code.trim(), { delay: 60 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined),
        page.keyboard.press("Enter"),
      ]);
      await new Promise((r) => setTimeout(r, 3000));
    } else {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Các màn "Lưu trình duyệt?" / "Tiếp tục" sau checkpoint - bấm qua tối đa 4 lần
    for (let i = 0; i < 4; i++) {
      const uid = await extractSessionIfLoggedIn(page);
      if (uid) break;
      const clicked: boolean = await page
        .evaluate(clickButtonScript("tiếp tục|continue|lưu trình duyệt|save browser|đây là tôi|this was me|^ok$"))
        .catch(() => false);
      if (!clicked) break;
      await new Promise((r) => setTimeout(r, 3000));
    }

    const result = await classifyPage(page);
    if (result.status === "ok" || result.status === "error") {
      await closePending();
    } else {
      keepPendingAlive();
    }
    return result;
  } catch (err) {
    log.warn({ err }, "Lỗi bước xác minh Facebook");
    keepPendingAlive();
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelFacebookLogin(): Promise<void> {
  await closePending();
}

/** Ảnh/chữ màn xác minh đang chờ (khi mở lại modal giữa chừng) */
export async function getPendingFacebookVerify(): Promise<FbLoginResult | null> {
  if (!pending || pending.expiresAt < Date.now()) return null;
  try {
    return await classifyPage(pending.page);
  } catch {
    return null;
  }
}

export type FbVerifyMethod = "sms" | "app" | "device" | "email";

const METHOD_PATTERNS: Record<FbVerifyMethod, string> = {
  sms: "tin nhắn|sms|text message|số điện thoại",
  app: "ứng dụng xác thực|authentication app|authenticator",
  device: "thông báo|notification|thiết bị khác|another device",
  email: "email",
};

/**
 * Bấm "Thử cách khác" trên màn 2FA rồi chọn phương thức (SMS / app / thiết bị / email).
 * Dùng khi FB mặc định "duyệt trên thiết bị khác" nên không có mã nào được gửi.
 */
export async function switchFacebookVerifyMethod(method: FbVerifyMethod): Promise<FbLoginResult> {
  if (!pending || pending.expiresAt < Date.now()) {
    await closePending();
    return { status: "error", message: "Phiên chờ xác minh đã hết hạn - đăng nhập lại từ đầu" };
  }
  const { page } = pending;
  try {
    await page.evaluate(clickButtonScript("thử cách khác|try another way|cách khác|other options", true)).catch(() => false);
    await new Promise((r) => setTimeout(r, 2500));
    const picked: boolean = await page.evaluate(clickOptionScript(METHOD_PATTERNS[method])).catch(() => false);
    await new Promise((r) => setTimeout(r, 1000));
    if (picked) {
      await page.evaluate(clickButtonScript("tiếp tục|continue|tiếp|next|gửi mã|send code")).catch(() => false);
      await new Promise((r) => setTimeout(r, 4000));
    }
    keepPendingAlive();
    const result = await classifyPage(page);
    if (!picked && result.status !== "ok" && result.status !== "error") {
      return { ...result, message: `Không tìm thấy lựa chọn "${method}" trên màn Facebook - xem ảnh bên dưới để biết các cách FB cho phép.` };
    }
    if (result.status === "ok") await closePending();
    return result;
  } catch (err) {
    keepPendingAlive();
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

/** Chọn 1 lựa chọn (radio / dòng có role) có chữ khớp regex trong danh sách phương thức xác minh */
function clickOptionScript(pattern: string): string {
  return `(() => {
    const re = new RegExp(${JSON.stringify(pattern)}, "i");
    const els = Array.from(document.querySelectorAll('[role=radio], input[type=radio], label, [role=button], [role=listitem], div[tabindex]'));
    const el = els.find((e) => re.test((e.textContent || (e.labels && e.labels[0] && e.labels[0].textContent) || "") + "") && (e.textContent || "").length < 200);
    if (el) el.click();
    return Boolean(el);
  })()`;
}

/**
 * Script chạy trong trang: bấm nút đầu tiên có chữ khớp regex, trả true nếu bấm được.
 * Viết dạng chuỗi vì backend không bật lib DOM của TypeScript.
 */
function clickButtonScript(pattern: string, includeLinks = false): string {
  return `(() => {
    const re = new RegExp(${JSON.stringify(pattern)}, "i");
    const els = Array.from(document.querySelectorAll(${JSON.stringify(includeLinks ? "button, div[role=button], input[type=submit], a, span[role=link], div[role=link]" : "button, div[role=button], input[type=submit]")}));
    const btn = els.find((e) => re.test(((e.value || e.textContent || "") + "").trim()));
    if (btn) btn.click();
    return Boolean(btn);
  })()`;
}
