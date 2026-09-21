import { Hono } from "hono";
import { createLogger } from "../../shared/logger.js";
import { stopScheduler } from "../../scheduler/scheduler-loop.js";
import { stopAllAccounts } from "../../zalo/account-manager.js";
import { closeHistoryStore } from "../../conversation/history-store.js";

const log = createLogger("system-routes");

/**
 * POST /api/system/restart
 *
 * Restart bot qua dashboard. Cơ chế:
 * 1. Trả response cho client trước
 * 2. Delay 500ms cho response kịp flush
 * 3. Gọi graceful shutdown rồi process.exit(0)
 * 4. PM2 (autorestart: true) tự khởi động lại process
 *
 * An toàn: route nằm sau auth middleware, chỉ admin đăng nhập mới gọi được.
 */
export const systemRoutes = new Hono().post("/restart", (c) => {
  log.warn("⚠️ Restart bot qua dashboard — đang tắt graceful...");

  // Schedule restart SAU khi response đã gửi
  setTimeout(() => {
    try {
      stopScheduler();
      stopAllAccounts();
      closeHistoryStore();
    } catch (err) {
      log.error({ err }, "Lỗi khi shutdown trước restart");
    }
    // Không gọi stopDashboardServer() ở đây vì nó sẽ đóng server
    // trước khi response flush xong. process.exit() sẽ dọn tất cả.
    log.info("Thoát process để PM2 restart...");
    process.exit(0);
  }, 500);

  return c.json({
    ok: true,
    message: "Bot đang restart... Trang sẽ tự tải lại sau vài giây.",
  });
});
