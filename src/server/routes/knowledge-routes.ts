import { Hono } from "hono";
import {
  approveKnowledge,
  countPending,
  deleteKnowledge,
  listKnowledge,
  proposeKnowledge,
  rejectKnowledge,
} from "../../conversation/shared-knowledge-store.js";

/** /api/knowledge - xem/duyệt/xóa shared knowledge */
export const knowledgeRoutes = new Hono()
  .get("/", (c) => {
    const accountId = c.req.query("accountId");
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);

    const status = c.req.query("status") as "pending" | "approved" | "rejected" | undefined;
    const page = Math.max(0, Number(c.req.query("page") ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? 50)));

    const rows = listKnowledge({
      accountId,
      status,
      query: c.req.query("q") ?? "",
      limit: pageSize + 1,
      offset: page * pageSize,
    });
    
    const pendingCount = countPending(accountId);

    return c.json({ 
      items: rows.slice(0, pageSize), 
      hasMore: rows.length > pageSize,
      pendingCount
    });
  })

  .post("/", async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      accountId?: string;
      category?: string;
      content?: string;
      source?: string;
    } | null;

    if (!body?.accountId || !body?.category || !body?.content) {
      return c.json({ error: "Thiếu accountId, category hoặc content" }, 400);
    }

    const result = proposeKnowledge({
      accountId: body.accountId,
      category: body.category,
      content: body.content,
      source: body.source ?? "admin",
      learnedInThreadId: "admin",
      autoApprove: true,
    });

    if (!result.ghi) {
      return c.json({ error: "Thêm thất bại", lyDo: result.lyDo }, 400);
    }

    return c.json({ ok: true, id: result.id });
  })

  .post("/:id/approve", (c) => {
    const accountId = c.req.query("accountId");
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);

    const ok = approveKnowledge(accountId, Number(c.req.param("id")), "admin");
    if (!ok) return c.json({ error: "Knowledge không tồn tại hoặc đã duyệt" }, 404);
    
    return c.json({ ok: true });
  })

  .post("/:id/reject", (c) => {
    const accountId = c.req.query("accountId");
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);

    const ok = rejectKnowledge(accountId, Number(c.req.param("id")), "admin");
    if (!ok) return c.json({ error: "Knowledge không tồn tại hoặc đã bị từ chối" }, 404);
    
    return c.json({ ok: true });
  })

  .delete("/:id", (c) => {
    const accountId = c.req.query("accountId");
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);

    const ok = deleteKnowledge(accountId, Number(c.req.param("id")));
    if (!ok) return c.json({ error: "Knowledge không tồn tại" }, 404);
    
    return c.json({ ok: true });
  })

  .get("/pending-count", (c) => {
    const accountId = c.req.query("accountId");
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);

    const count = countPending(accountId);
    return c.json({ count });
  });
