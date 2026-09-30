import { Hono } from "hono";
import {
  listTickets,
  getTicket,
  createTicket,
  updateTicketStatus,
  addTicketNote,
  ticketStats,
  type TicketStatus,
  type TicketPriority,
} from "../../conversation/ticket-store.js";

/** /api/tickets - CRM mini */
export const ticketRoutes = new Hono()
  .get("/", (c) => {
    const accountId = c.req.query("accountId");
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);
    const status = c.req.query("status") ?? "";
    const page = Math.max(0, Number(c.req.query("page") ?? 0));
    const limit = 20;
    const tickets = listTickets(accountId, status, limit + 1, page * limit);
    return c.json({
      items: tickets.slice(0, limit),
      hasMore: tickets.length > limit,
    });
  })

  .get("/stats", (c) => {
    const accountId = c.req.query("accountId");
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);
    return c.json(ticketStats(accountId));
  })

  .get("/:id", (c) => {
    const accountId = c.req.query("accountId");
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);
    const ticket = getTicket(accountId, Number(c.req.param("id")));
    if (!ticket) return c.json({ error: "Không tìm thấy" }, 404);
    return c.json(ticket);
  })

  .post("/", async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      accountId?: string;
      threadId?: string;
      senderId?: string;
      senderName?: string;
      subject?: string;
      priority?: TicketPriority;
    } | null;
    if (!body?.accountId || !body?.subject) {
      return c.json({ error: "Thiếu accountId hoặc subject" }, 400);
    }
    const ticket = createTicket({
      accountId: body.accountId,
      threadId: body.threadId ?? "admin",
      senderId: body.senderId ?? "admin",
      senderName: body.senderName ?? "Admin",
      subject: body.subject,
      priority: body.priority,
    });
    return c.json({ ok: true, ticket });
  })

  .patch("/:id/status", async (c) => {
    const accountId = c.req.query("accountId");
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);
    const body = (await c.req.json().catch(() => null)) as { status?: TicketStatus } | null;
    if (!body?.status) return c.json({ error: "Thiếu status" }, 400);
    const ok = updateTicketStatus(accountId, Number(c.req.param("id")), body.status);
    if (!ok) return c.json({ error: "Không tìm thấy" }, 404);
    return c.json({ ok: true });
  })

  .post("/:id/notes", async (c) => {
    const accountId = c.req.query("accountId");
    if (!accountId) return c.json({ error: "Thiếu accountId" }, 400);
    const body = (await c.req.json().catch(() => null)) as { note?: string } | null;
    if (!body?.note) return c.json({ error: "Thiếu note" }, 400);
    const ok = addTicketNote(accountId, Number(c.req.param("id")), body.note);
    if (!ok) return c.json({ error: "Không tìm thấy" }, 404);
    return c.json({ ok: true });
  });
