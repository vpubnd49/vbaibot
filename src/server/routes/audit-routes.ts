/**
 * /api/audit - xem audit trail.
 *
 * GET /api/audit — liệt kê (phân trang, filter)
 */

import { Hono } from "hono";
import { listAuditLogs } from "../../conversation/audit-log-store.js";

export const auditRoutes = new Hono()

  .get("/", (c) => {
    const action = c.req.query("action");
    const actor = c.req.query("actor");
    const accountId = c.req.query("accountId");
    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) || 0;

    const result = listAuditLogs({ action, actor, accountId, limit, offset });
    return c.json(result);
  });
