import { Hono } from "hono";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("kie-callback");

/**
 * KIE/Suno callback endpoint. Results are still obtained by polling; this
 * endpoint exists because the music API requires a reachable callbackUrl.
 */
export const kieCallbackRoutes = new Hono();

kieCallbackRoutes.post("/", async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  const body = payload as Record<string, unknown>;
  log.info(
    {
      taskId: typeof body.taskId === "string" ? body.taskId : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      state: typeof body.state === "string" ? body.state : undefined,
    },
    "Đã nhận callback KIE",
  );
  return c.json({ ok: true });
});

kieCallbackRoutes.get("/", (c) => c.json({ ok: true }));
