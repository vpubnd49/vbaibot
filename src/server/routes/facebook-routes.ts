import { Hono } from "hono";
import { z } from "zod";
import { getFacebookCrawlReport, runFacebookCrawl } from "../../realtime/facebook/facebook-page-crawler.js";
import { getPostStatsByPage, searchFacebookPosts } from "../../realtime/facebook/facebook-page-store.js";
import { getFacebookDashboardStats } from "../../realtime/facebook/facebook-service.js";
import {
  cancelFacebookLogin,
  clearFacebookSession,
  continueFacebookLogin,
  getFacebookSessionStatus,
  getPendingFacebookVerify,
  importFacebookCookies,
  loginFacebookWithPassword,
  switchFacebookVerifyMethod,
} from "../../realtime/facebook/facebook-session.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("facebook-routes");

const loginSchema = z.object({
  email: z.string().trim().min(3, "Nhập email hoặc số điện thoại"),
  password: z.string().min(1, "Nhập mật khẩu"),
});
const verifySchema = z.object({ code: z.string().trim().max(12).optional() });
const importSchema = z.object({ cookies: z.string().min(10, "Chưa dán cookie").max(50_000) });
const methodSchema = z.object({ method: z.enum(["sms", "app", "device", "email"]) });

let crawlRunning = false;

function snapshot() {
  const stats = getFacebookDashboardStats();
  return {
    session: getFacebookSessionStatus(),
    pages: stats.pages.map((p) => ({
      pageId: p.pageId,
      pageName: p.pageName,
      pageUrl: p.pageUrl,
      enabled: p.enabled,
      hasToken: Boolean(p.encryptedToken),
      lastCrawledAt: p.lastCrawledAt,
    })),
    totalPosts: stats.totalPosts,
    crawlRunning,
  };
}

/**
 * /api/facebook - phiên đăng nhập Facebook cá nhân cho crawler fanpage.
 * Nằm sau middleware auth dashboard. Mật khẩu chỉ đi qua RAM, không log, không lưu.
 */
export const facebookRoutes = new Hono()
  .get("/", (c) => c.json(snapshot()))

  // Giám sát: tình trạng cào từng fanpage + số bài đã lưu
  .get("/monitor", (c) => {
    const report = getFacebookCrawlReport();
    const counts = new Map(getPostStatsByPage().map((s) => [s.pageId, s]));
    const base = snapshot();
    return c.json({
      ...base,
      crawlRunning: base.crawlRunning || report.running,
      lastRun: report.lastRun,
      pages: base.pages.map((p) => ({
        ...p,
        posts: counts.get(p.pageId)?.total ?? 0,
        latestPostAt: counts.get(p.pageId)?.latestPostAt ?? null,
        lastFetchedAt: counts.get(p.pageId)?.lastFetchedAt ?? null,
        lastReport: report.pages[p.pageId] ?? null,
      })),
    });
  })

  // Danh sách bài đã cào (lọc page / từ khoá)
  .get("/posts", (c) => {
    const q = c.req.query();
    return c.json(
      searchFacebookPosts({
        pageId: q.pageId || undefined,
        q: q.q || undefined,
        limit: q.limit ? Number(q.limit) : 30,
        offset: q.offset ? Number(q.offset) : 0,
      }),
    );
  })

  .post("/login", async (c) => {
    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, 400);
    }
    const result = await loginFacebookWithPassword(parsed.data.email, parsed.data.password);
    log.info({ status: result.status }, "Đăng nhập Facebook từ dashboard");
    return c.json({ result, ...snapshot() });
  })

  .post("/verify", async (c) => {
    const parsed = verifySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: "Mã không hợp lệ" }, 400);
    const result = await continueFacebookLogin(parsed.data.code);
    log.info({ status: result.status }, "Xác minh đăng nhập Facebook");
    return c.json({ result, ...snapshot() });
  })

  .post("/cancel", async (c) => {
    await cancelFacebookLogin();
    return c.json(snapshot());
  })

  // Màn xác minh đang chờ (ảnh + chữ) - dùng khi mở lại modal giữa chừng
  .get("/pending", async (c) => c.json({ result: await getPendingFacebookVerify(), ...snapshot() }))

  // "Thử cách khác": chuyển sang nhận mã SMS / app xác thực / duyệt thiết bị / email
  .post("/method", async (c) => {
    const parsed = methodSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Phương thức không hợp lệ" }, 400);
    const result = await switchFacebookVerifyMethod(parsed.data.method);
    log.info({ status: result.status, method: parsed.data.method }, "Đổi cách xác minh Facebook");
    return c.json({ result, ...snapshot() });
  })

  .post("/import", async (c) => {
    const parsed = importSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, 400);
    }
    const res = importFacebookCookies(parsed.data.cookies);
    if (!res.ok) return c.json({ error: res.error }, 400);
    return c.json(snapshot());
  })

  .delete("/session", (c) => {
    clearFacebookSession();
    return c.json(snapshot());
  })

  // Cào ngay 1 lượt (chạy nền, UI hỏi lại GET / để xem kết quả)
  .post("/crawl", (c) => {
    if (!crawlRunning) {
      crawlRunning = true;
      runFacebookCrawl()
        .then((r) => log.info(r, "Cào Facebook thủ công xong"))
        .catch((err) => log.warn({ err }, "Lỗi cào Facebook thủ công"))
        .finally(() => {
          crawlRunning = false;
        });
    }
    return c.json(snapshot());
  });
