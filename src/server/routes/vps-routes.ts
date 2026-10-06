import { Hono } from "hono";
import { executeVpsReboot, getVpsMetrics, restartSpecificService } from "../vps-monitor-service.js";

export const vpsRoutes = new Hono()
  .get("/metrics", async (c) => {
    try {
      const data = await getVpsMetrics();
      return c.json(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: "Lỗi lấy thông số VPS", details: message }, 500);
    }
  })
  .post("/reboot", async (c) => {
    const res = await executeVpsReboot();
    return c.json(res);
  })
  .post("/restart-service", async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as { service?: string };
      const serviceName = body.service;
      if (!serviceName) {
        return c.json({ error: "Tên dịch vụ không được để trống" }, 400);
      }
      const res = await restartSpecificService(serviceName);
      return c.json(res, res.ok ? 200 : 500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: "Không thể khởi động lại dịch vụ", details: message }, 500);
    }
  });
