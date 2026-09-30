import { Hono } from "hono";
import { getAccountInsight } from "../group-insight.js";

/** /api/insights - Phân tích hoạt động bot */
export const insightRoutes = new Hono()
  .get("/", (c) => {
    const accountId = c.req.query("accountId");
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);
    const days = Math.min(365, Math.max(1, Number(c.req.query("days") ?? 30)));
    const insight = getAccountInsight(accountId, days);
    return c.json(insight);
  });
