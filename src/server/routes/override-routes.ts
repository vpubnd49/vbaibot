import { Hono } from "hono";
import {
  deleteOverride,
  listOverrides,
  saveOverride,
} from "../../conversation/response-override-store.js";

/** /api/overrides - xem/lưu/xóa response overrides (admin sửa câu trả lời) */
export const overrideRoutes = new Hono()
  .get("/", (c) => {
    const accountId = c.req.query("accountId") ?? "";
    const page = Math.max(0, Number(c.req.query("page") ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? 50)));

    const rows = listOverrides({
      accountId: accountId || undefined,
      limit: pageSize + 1,
      offset: page * pageSize,
    });

    const hasMore = rows.length > pageSize;
    return c.json({
      items: rows.slice(0, pageSize),
      page,
      hasMore,
    });
  })

  .post("/", async (c) => {
    const body = await c.req.json<{
      accountId: string;
      threadId: string;
      userMessage: string;
      originalResponse: string;
      correctedResponse: string;
    }>();

    if (!body.accountId || !body.threadId || !body.correctedResponse) {
      return c.json({ error: "Thiếu accountId, threadId hoặc correctedResponse" }, 400);
    }

    const id = saveOverride({
      accountId: body.accountId,
      threadId: body.threadId,
      userMessage: body.userMessage ?? "",
      originalResponse: body.originalResponse ?? "",
      correctedResponse: body.correctedResponse,
    });

    return c.json({ id, message: "Đã lưu override" });
  })

  .delete("/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "ID không hợp lệ" }, 400);

    const ok = deleteOverride(id);
    if (!ok) return c.json({ error: "Không tìm thấy override" }, 404);
    return c.json({ message: "Đã xóa" });
  });
