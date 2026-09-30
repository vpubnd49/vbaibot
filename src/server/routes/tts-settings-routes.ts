import { Hono } from "hono";
import { db } from "../../conversation/database.js";

const getStmt = db.prepare("SELECT value FROM runtime_settings WHERE key = ?");
const setStmt = db.prepare(`
  INSERT INTO runtime_settings (key, value, updated_at)
  VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

/** /api/settings/tts - đọc/ghi TTS model từ runtime_settings */
export const ttsSettingsRoutes = new Hono()

  .get("/", (c) => {
    const row = getStmt.get("tts_model") as { value: string } | undefined;
    return c.json({ model: row?.value ?? "" });
  })

  .patch("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.model === "string" && body.model.trim()) {
      setStmt.run("tts_model", body.model.trim());
    }
    const row = getStmt.get("tts_model") as { value: string } | undefined;
    return c.json({ ok: true, model: row?.value ?? "" });
  });
