import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../conversation/database.js";
import { decryptSecret, encryptSecret, maskSecret } from "../../config/secret-cipher.js";
import { createLogger } from "../../shared/logger.js";
import { listAccounts } from "../../config/account-store.js";

const log = createLogger("notion-routes");

function decryptSecretSafe(stored: string): string {
  if (!stored) return "";
  try {
    return decryptSecret(stored);
  } catch {
    return stored;
  }
}

// Đảm bảo bảng notion_config tồn tại
db.exec(`
  CREATE TABLE IF NOT EXISTS notion_config (
    account_id TEXT PRIMARY KEY,
    api_key TEXT NOT NULL DEFAULT '',
    default_database_id TEXT DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const notionUpdateSchema = z.object({
  apiKey: z.string().optional(),
  defaultDatabaseId: z.string().optional(),
  enabled: z.boolean().optional(),
  clearKey: z.boolean().optional(),
});

export const notionRoutes = new Hono()
  .get("/", (c) => {
    // Lấy cấu hình đầu tiên hoặc tạo dòng mặc định
    const row = db.prepare(
      "SELECT account_id, api_key, default_database_id, enabled FROM notion_config ORDER BY created_at ASC LIMIT 1"
    ).get() as { account_id: string; api_key: string; default_database_id: string; enabled: number } | undefined;
    const plainKey = decryptSecretSafe(row?.api_key ?? "");

    return c.json({
      hasApiKey: Boolean(plainKey),
      apiKeyMasked: plainKey ? maskSecret(plainKey) : "",
      defaultDatabaseId: row?.default_database_id ?? "",
      enabled: Boolean(row?.enabled),
    });
  })

  .patch("/", async (c) => {
    const parsed = notionUpdateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Dữ liệu không hợp lệ", issues: parsed.error.issues }, 400);
    }

    const { apiKey, defaultDatabaseId, enabled, clearKey } = parsed.data;
    const accounts = listAccounts();
    const primaryAccountId = accounts[0]?.id ?? "default";

    const current = db.prepare(
      "SELECT account_id, api_key, default_database_id, enabled FROM notion_config ORDER BY created_at ASC LIMIT 1"
    ).get() as { account_id: string; api_key: string; default_database_id: string; enabled: number } | undefined;

    let plainKey = decryptSecretSafe(current?.api_key ?? "");
    if (clearKey) {
      plainKey = "";
    } else if (apiKey !== undefined && apiKey.trim() !== "") {
      plainKey = apiKey.trim();
    }
    const encryptedKey = plainKey ? encryptSecret(plainKey) : "";

    const finalDbId = defaultDatabaseId !== undefined ? defaultDatabaseId.trim() : (current?.default_database_id ?? "");
    const finalEnabled = enabled !== undefined ? (enabled ? 1 : 0) : (current?.enabled ?? (plainKey ? 1 : 0));

    // Đồng bộ cấu hình cho tất cả tài khoản đang có
    const targetAccounts = accounts.length > 0 ? accounts.map((a) => a.id) : [primaryAccountId];
    const upsert = db.prepare(`
      INSERT INTO notion_config (account_id, api_key, default_database_id, enabled)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        api_key = excluded.api_key,
        default_database_id = excluded.default_database_id,
        enabled = excluded.enabled
    `);

    for (const accId of targetAccounts) {
      upsert.run(accId, encryptedKey, finalDbId, finalEnabled);
    }

    log.info({ finalEnabled, hasKey: Boolean(plainKey) }, "Cập nhật cấu hình Notion");

    return c.json({
      ok: true,
      hasApiKey: Boolean(plainKey),
      apiKeyMasked: plainKey ? maskSecret(plainKey) : "",
      defaultDatabaseId: finalDbId,
      enabled: Boolean(finalEnabled),
    });
  })

  .post("/test", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { apiKey?: string };
    let token = body.apiKey?.trim();

    if (!token) {
      const current = db.prepare(
        "SELECT api_key FROM notion_config WHERE api_key <> '' LIMIT 1"
      ).get() as { api_key: string } | undefined;
      token = decryptSecretSafe(current?.api_key ?? "");
    }

    if (!token) {
      return c.json({ ok: false, error: "Chưa nhập API key (integration token) của Notion" }, 400);
    }

    try {
      const res = await fetch("https://api.notion.com/v1/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const text = await res.text();
        let errMsg = `Lỗi HTTP ${res.status}`;
        try {
          const j = JSON.parse(text) as { message?: string };
          if (j.message) errMsg = j.message;
        } catch {
          // parse error
        }
        return c.json({ ok: false, error: errMsg }, 400);
      }

      const user = (await res.json()) as { name?: string; type?: string };
      return c.json({
        ok: true,
        botName: user.name ?? "Notion Integration",
        type: user.type,
      });
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });
