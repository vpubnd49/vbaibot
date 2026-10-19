/**
 * facebook-browser-scraper.ts
 * Cào bài fanpage bằng Chromium headless + cookie phiên Facebook cá nhân
 * (xem facebook-session.ts). Dùng khi page không có Graph API token.
 *
 * Cách lấy dữ liệu (2 nguồn, gộp & khử trùng):
 * 1. JSON nhúng trong HTML + các response /api/graphql/ khi cuộn trang
 *    -> có message, permalink, creation_time chính xác.
 * 2. Dự phòng: đọc DOM (div[data-ad-preview="message"], role=article).
 *
 * Mỗi lượt crawl mở 1 trình duyệt dùng chung cho mọi page rồi đóng ngay,
 * để không giữ ~200MB RAM thường trực trên VPS.
 */
import { createLogger } from "../../shared/logger.js";
import { parseEmbeddedJsonPosts, type ScrapedPost } from "./facebook-public-scraper.js";
import {
  checkIsFacebookSessionAlive,
  getFacebookCookies,
  launchFacebookBrowser,
  prepareFacebookPage,
  reportFacebookSessionResult,
} from "./facebook-session.js";

const log = createLogger("facebook-browser-scraper");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;

/**
 * Mở 1 trình duyệt có cookie, chạy `fn`, luôn đóng trình duyệt sau cùng.
 * Trả null nếu chưa có phiên hoặc không mở được Chromium.
 */
export async function withFacebookBrowser<T>(fn: (scrape: (slug: string, max?: number) => Promise<ScrapedPost[]>) => Promise<T>): Promise<T | null> {
  const cookies = getFacebookCookies();
  if (!cookies) return null;

  let browser: Browser;
  try {
    browser = await launchFacebookBrowser();
  } catch (err) {
    log.warn({ err }, "Không mở được Chromium để cào Facebook");
    return null;
  }

  // chrome-headless-shell trên VPS thỉnh thoảng tự crash (trap int3) giữa lượt
  // -> mở lại trình duyệt mới rồi thử lại đúng page đó, không bỏ các page còn lại
  const relaunch = async (): Promise<void> => {
    await browser?.close().catch(() => undefined);
    browser = await launchFacebookBrowser();
    log.info("Đã mở lại Chromium sau khi trình duyệt bị đóng/crash");
  };

  let sessionChecked = false;
  try {
    const scrape = async (slug: string, max = 5): Promise<ScrapedPost[]> => {
      const alive = typeof browser?.connected === "boolean" ? browser.connected : Boolean(browser?.isConnected?.());
      if (!alive) await relaunch();
      let res: { posts: ScrapedPost[]; loginWall: boolean };
      try {
        res = await scrapeOnePage(browser, cookies, slug, max);
      } catch (err) {
        if (!isBrowserCrash(err)) throw err;
        log.warn({ slug, err: err instanceof Error ? err.message : String(err) }, "Chromium crash khi cào - mở lại và thử lại 1 lần");
        await relaunch();
        res = await scrapeOnePage(browser, cookies, slug, max);
      }
      if (res.loginWall) {
        log.warn({ slug }, "Fanpage gặp trang đăng nhập - đang kiểm tra xem phiên Facebook chính còn sống không...");
        const alive = await checkIsFacebookSessionAlive(browser, cookies);
        if (!alive) {
          reportFacebookSessionResult(false, "Facebook đã đăng xuất phiên này trên máy chủ Meta");
          throw new FacebookSessionExpiredError();
        }
        log.warn({ slug }, "Fanpage này bị chặn riêng (có thể do giới hạn độ tuổi/quốc gia), phiên chính vẫn hoạt động bình thường");
        return [];
      }
      if (!sessionChecked) {
        reportFacebookSessionResult(true);
        sessionChecked = true;
      }
      return res.posts;
    };
    return await fn(scrape);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

/** Lỗi do trình duyệt/tab chết (crash, frame bị tách) - đáng mở lại và thử lại */
function isBrowserCrash(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /detached Frame|Connection closed|Target closed|Session closed|Protocol error|ConnectionClosedError|Navigating frame was detached|browser has disconnected/i.test(msg);
}

export class FacebookSessionExpiredError extends Error {
  constructor() {
    super("Phiên Facebook đã hết hạn");
  }
}

async function scrapeOnePage(
  browser: Browser,
  cookies: NonNullable<ReturnType<typeof getFacebookCookies>>,
  slug: string,
  maxPosts: number,
): Promise<{ posts: ScrapedPost[]; loginWall: boolean }> {
  const page = await prepareFacebookPage(browser);
  try {
    await page.setCookie(
      ...cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain ?? ".facebook.com",
        path: c.path ?? "/",
        secure: c.secure ?? true,
        httpOnly: c.httpOnly ?? false,
        ...(c.expires && c.expires > 0 ? { expires: c.expires } : {}),
      })),
    );

    // Gom body các response GraphQL (feed tải thêm khi cuộn)
    const graphqlChunks: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.on("response", async (res: any) => {
      try {
        if (!res.url().includes("/api/graphql")) return;
        const text: string = await res.text();
        if (text.includes('"message"')) graphqlChunks.push(text);
      } catch {
        /* response đã bị huỷ - bỏ qua */
      }
    });

    const url = `https://www.facebook.com/${slug}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await sleep(3500);

    const currentUrl: string = page.url();
    const loginWall: boolean =
      currentUrl.includes("/login") ||
      currentUrl.includes("checkpoint") ||
      (await page.$("#login_form, form[action*='login']").then(Boolean).catch(() => false));
    if (loginWall) return { posts: [], loginWall: true };

    // Cuộn vài lần cho feed tải bài
    for (let i = 0; i < 4; i++) {
      await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)").catch(() => undefined);
      await sleep(1800 + Math.random() * 800);
    }

    // Nguồn 1: JSON trong HTML + GraphQL
    const html: string = await page.content();
    const merged = new Map<string, ScrapedPost>();
    for (const p of [
      ...parseEmbeddedJsonPosts(html, slug, maxPosts * 3),
      ...graphqlChunks.flatMap((chunk) => parseEmbeddedJsonPosts(chunk, slug, maxPosts * 3)),
    ]) {
      const key = p.message.slice(0, 80);
      if (!merged.has(key)) merged.set(key, p);
    }

    // Nguồn 2: DOM (khi FB đổi cấu trúc JSON)
    if (merged.size === 0) {
      for (const p of await extractFromDom(page, slug, maxPosts)) {
        const key = p.message.slice(0, 80);
        if (!merged.has(key)) merged.set(key, p);
      }
    }

    // Bài mới nhất trước (bài ghim thường cũ, nằm đầu feed)
    const posts = [...merged.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, maxPosts);

    log.info({ slug, postCount: posts.length, graphqlChunks: graphqlChunks.length }, "Đã cào fanpage qua phiên đăng nhập");
    return { posts, loginWall: false };
  } finally {
    await page.close().catch(() => undefined);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractFromDom(page: any, slug: string, maxPosts: number): Promise<ScrapedPost[]> {
  const raw: Array<{ text: string; href: string | null }> = await page
    .evaluate(`(() => {
      const limit = ${Number(maxPosts) || 5};
      const out = [];
      const blocks = Array.from(
        document.querySelectorAll('div[data-ad-preview="message"], div[data-ad-comet-preview="message"]'),
      );
      for (const b of blocks) {
        if (out.length >= limit) break;
        const text = (b.innerText || "").trim();
        if (text.length < 15) continue;
        const article = b.closest('[role="article"]') || (b.parentElement && b.parentElement.parentElement && b.parentElement.parentElement.parentElement);
        const a = article && article.querySelector(
          'a[href*="/posts/"], a[href*="story_fbid"], a[href*="/permalink/"], a[href*="pfbid"], a[href*="/videos/"]',
        );
        out.push({ text, href: a ? a.href : null });
      }
      return out;
    })()`)
    .catch(() => []);

  const now = new Date().toISOString();
  return raw.map((r) => {
    const permalink = r.href ? r.href.split("?")[0]! : `https://www.facebook.com/${slug}`;
    return {
      postId: idFromUrl(permalink) ?? `dom_${hash(r.text)}`,
      message: r.text.slice(0, 1000),
      permalink,
      imageUrl: null,
      // Không đọc được giờ đăng từ DOM -> lấy lúc thấy lần đầu (DB giữ nguyên khi upsert lại)
      createdAt: now,
    };
  });
}

function idFromUrl(url: string): string | null {
  const m =
    url.match(/\/posts\/([\w]+)/) ??
    url.match(/story_fbid=(\w+)/) ??
    url.match(/\/permalink\/(\d+)/) ??
    url.match(/\/videos\/(\d+)/);
  return m?.[1] ?? null;
}

function hash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
