import { Hono } from "hono";
import { z } from "zod";
import {
  DEFAULT_BROADCAST_TEMPLATES,
  getBroadcastHistory,
  listBroadcastTargets,
  sendBroadcastBatch,
} from "../../broadcast/broadcast-service.js";
import { getRunningAccountApi } from "../../zalo/account-manager.js";
import { guiFileKemCaption } from "../../agent/tools/send-attachment-with-caption.js";

/** /api/broadcast - Quản lý thông báo và gửi tin cập nhật đến các nhóm / user Zalo */
export const broadcastRoutes = new Hono()

  .get("/targets", (c) => {
    const accountId = c.req.query("accountId") || undefined;
    const query = c.req.query("q") || undefined;
    const type = (c.req.query("type") as "all" | "group" | "direct") || undefined;
    const botEnabledOnly = c.req.query("botEnabledOnly") === "true";
    const activeWithinDays = c.req.query("activeWithinDays") ? Number(c.req.query("activeWithinDays")) : undefined;

    const targets = listBroadcastTargets({
      accountId,
      query,
      type,
      botEnabledOnly,
      activeWithinDays,
    });

    return c.json({ targets });
  })

  .get("/templates", (c) => {
    return c.json({ templates: DEFAULT_BROADCAST_TEMPLATES });
  })

  .post("/send", async (c) => {
    const bodySchema = z.object({
      accountId: z.string().min(1, "Thiếu accountId"),
      threadIds: z.array(z.string()).min(1, "Cần chọn ít nhất 1 nhóm hoặc người nhận"),
      message: z.string().min(1, "Nội dung thông báo không được để trống"),
      delayMinMs: z.number().int().min(500).max(10_000).optional(),
      delayMaxMs: z.number().int().min(500).max(15_000).optional(),
    });

    const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, 400);
    }

    try {
      const result = await sendBroadcastBatch(parsed.data);
      return c.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  })

  .post("/send-file", async (c) => {
    const bodySchema = z.object({
      accountId: z.string().min(1, "Thiếu accountId"),
      threadId: z.string().min(1, "Thiếu threadId"),
      filePath: z.string().min(1, "Thiếu filePath"),
      caption: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, 400);
    }

    const { accountId, threadId, filePath, caption } = parsed.data;
    const api = getRunningAccountApi(accountId);
    if (!api) {
      return c.json({ error: "Tài khoản Zalo chưa kết nối hoặc đang offline" }, 400);
    }

    const targets = listBroadcastTargets({ accountId });
    const target = targets.find((t) => t.threadId === threadId);
    const threadType = target ? target.threadType : 0;
    const threadKey = `${accountId}:${threadId}`;

    try {
      await guiFileKemCaption(api, threadKey, threadId, threadType, filePath, caption);
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  })

  .get("/history", (c) => {
    const accountId = c.req.query("accountId") || undefined;
    const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 50;
    const items = getBroadcastHistory(accountId, limit);
    return c.json({ items });
  });
