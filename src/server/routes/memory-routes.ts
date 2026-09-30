import { Hono } from "hono";
import {
  deleteMemoryFact,
  listMemories,
  exportAllMemories,
  importMemories,
  countMemories,
} from "../../conversation/memory-store.js";

/** /api/memories - xem/xóa/export/import fact bot đã ghi nhớ */
export const memoryRoutes = new Hono()

  .get("/", (c) => {
    // accountId bỏ trống = mọi account
    const accountId = c.req.query("accountId") ?? "";
    const page = Math.max(0, Number(c.req.query("page") ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? 50)));

    const rows = listMemories({
      accountId,
      query: c.req.query("q") ?? "",
      limit: pageSize + 1,
      offset: page * pageSize,
    });
    return c.json({ items: rows.slice(0, pageSize), hasMore: rows.length > pageSize });
  })

  .delete("/:id", (c) => {
    const accountId = c.req.query("accountId") ?? "";
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);

    const ok = deleteMemoryFact(accountId, Number(c.req.param("id")));
    if (!ok) return c.json({ error: "Fact không tồn tại" }, 404);
    return c.json({ ok: true });
  })

  /** Sao lưu trí nhớ → JSON file */
  .get("/export", (c) => {
    const accountId = c.req.query("accountId") ?? undefined;
    const facts = exportAllMemories(accountId);
    const filename = `memories-backup-${new Date().toISOString().slice(0, 10)}.json`;
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    c.header("Content-Type", "application/json; charset=utf-8");
    return c.json({
      exportedAt: new Date().toISOString(),
      version: 1,
      totalFacts: facts.length,
      facts,
    });
  })

  /** Đếm fact (cho UI hiện thông tin trước export) */
  .get("/stats", (c) => {
    const accountId = c.req.query("accountId") ?? undefined;
    return c.json({ total: countMemories(accountId) });
  })

  /** Khôi phục trí nhớ từ file JSON đã export */
  .post("/import", async (c) => {
    try {
      const body = await c.req.json();
      const facts = body?.facts;
      if (!Array.isArray(facts)) {
        return c.json({ error: "File không hợp lệ: thiếu trường 'facts'" }, 400);
      }
      if (facts.length > 10000) {
        return c.json({ error: "Tối đa 10.000 fact mỗi lần import" }, 400);
      }
      const result = importMemories(facts);
      return c.json({ ok: true, ...result });
    } catch {
      return c.json({ error: "Không đọc được file JSON" }, 400);
    }
  });

