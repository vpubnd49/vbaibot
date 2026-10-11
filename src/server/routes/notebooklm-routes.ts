import { Hono } from "hono";
import { z } from "zod";
import {
  getNotebooklmSettings,
  isNotebooklmConfigured,
  updateNotebooklmSettings,
} from "../../config/runtime-notebooklm-settings.js";
import { nlmHealth, nlmSetupAuth } from "../../notebooklm/notebooklm-client.js";
import { countNotebooks, usageToday } from "../../notebooklm/notebooklm-store.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("notebooklm-routes");

/**
 * Trạng thái lượt đăng nhập Google đang chạy. `setup-auth` của máy chủ giữ
 * kết nối tới khi đăng nhập xong (tối đa ~10 phút) nên chạy nền, UI hỏi trạng
 * thái bằng GET.
 */
const login: { running: boolean; startedAt?: string; result?: string } = { running: false };

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  apiUrl: z.string().regex(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/, "Chỉ cho phép máy chủ chạy trên chính VPS (127.0.0.1)").optional(),
  publicAccess: z.boolean().optional(),
  maxPerDay: z.number().int().min(0).max(100).optional(),
  maxPerDayGlobal: z.number().int().min(0).max(500).optional(),
});

async function snapshot() {
  const settings = getNotebooklmSettings();
  const health = await nlmHealth();
  return {
    ...settings,
    configured: isNotebooklmConfigured(settings),
    server: health.ok
      ? { online: true, authenticated: Boolean(health.data.authenticated) }
      : { online: false, authenticated: false, error: health.error },
    usedToday: usageToday("").global,
    notebooks: countNotebooks(),
    login,
  };
}

/** /api/notebooklm - cấu hình + trạng thái máy chủ NotebookLM (chỉ Admin dashboard) */
export const notebooklmRoutes = new Hono()
  .get("/", async (c) => c.json(await snapshot()))

  .patch("/", async (c) => {
    const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, 400);
    }
    updateNotebooklmSettings(parsed.data);
    log.info({ changedFields: Object.keys(parsed.data) }, "Đổi cấu hình NotebookLM từ dashboard");
    return c.json({ ok: true, ...(await snapshot()) });
  })

  // Mở Chrome trên màn hình noVNC để Admin đăng nhập Google. Trả về ngay,
  // kết quả xem ở GET / (login.result).
  .post("/login", async (c) => {
    if (login.running) return c.json({ ok: true, alreadyRunning: true, login });
    login.running = true;
    login.startedAt = new Date().toISOString();
    login.result = undefined;
    log.info("Bắt đầu đăng nhập Google cho NotebookLM từ dashboard");
    void nlmSetupAuth().then((r) => {
      login.running = false;
      login.result = r.ok ? "ok" : r.error;
      log.info({ ok: r.ok }, "Kết thúc lượt đăng nhập Google NotebookLM");
    });
    return c.json({ ok: true, login });
  });
