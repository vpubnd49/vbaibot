/**
 * /api/feedback - API đánh giá phản hồi bot.
 *
 * POST /api/feedback — lưu feedback (turnId + rating)
 * GET  /api/feedback — liệt kê (phân trang)
 * GET  /api/feedback/stats — thống kê satisfaction score
 */

import { Hono } from "hono";
import { saveFeedback, listFeedback, getFeedbackStats } from "../../conversation/feedback-store.js";

export const feedbackRoutes = new Hono()

  .post("/", async (c) => {
    const body = await c.req.json<{
      accountId: string;
      threadId: string;
      turnId: number;
      rating: number;
      userId: string;
    }>();

    if (!body.accountId || !body.turnId || ![1, -1].includes(body.rating)) {
      return c.json({ error: "accountId, turnId, rating (1 or -1) required" }, 400);
    }

    saveFeedback({
      accountId: body.accountId,
      threadId: body.threadId ?? "",
      turnId: body.turnId,
      rating: body.rating as 1 | -1,
      userId: body.userId ?? "",
    });

    return c.json({ ok: true });
  })

  .get("/stats", (c) => {
    const accountId = c.req.query("accountId");
    const stats = getFeedbackStats(accountId);
    return c.json(stats);
  })

  .get("/", (c) => {
    const accountId = c.req.query("accountId");
    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) || 0;
    const items = listFeedback({ accountId, limit, offset });
    return c.json({ items });
  });
