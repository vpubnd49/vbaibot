import { Hono } from "hono";
import { getAccountInsight } from "../group-insight.js";

/** /api/insights - Phân tích hoạt động bot theo tài khoản hoặc toàn hệ thống */
export const insightRoutes = new Hono().get("/", (c) => {
  const accountId = c.req.query("accountId");
  const days = Math.min(365, Math.max(1, Number(c.req.query("days") ?? 30)));
  const insight = getAccountInsight(accountId, days);
  return c.json(insight);
});
