import { Hono } from "hono";
import { z } from "zod";
import net from "node:net";
import { db } from "../../conversation/database.js";
import { decryptSecret, encryptSecret, maskSecret } from "../../config/secret-cipher.js";
import { hostnameToAddress, isBlockedHostname, isPublicAddress } from "../../shared/private-address-guard.js";
import { createLogger } from "../../shared/logger.js";
import { listAccounts } from "../../config/account-store.js";
import crypto from "crypto";

const log = createLogger("mcp-routes");

export function decryptSecretSafe(stored: string): string {
  if (!stored) return "";
  try {
    return decryptSecret(stored);
  } catch {
    return stored;
  }
}

export function validateMcpBaseUrl(rawUrl: string): { ok: true; url: string } | { ok: false; error: string } {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "URL phải bắt đầu bằng http:// hoặc https://" };
    }
    const host = hostnameToAddress(parsed.hostname).toLowerCase();
    // Luôn chặn cloud metadata & loopback tới chính cổng dashboard 3900
    if (
      host === "169.254.169.254" ||
      host === "metadata.google.internal" ||
      host === "instance-data" ||
      ((host === "localhost" || host === "127.0.0.1" || host === "::1") && parsed.port === "3900")
    ) {
      return { ok: false, error: "URL nội bộ / metadata bị chặn vì lý do bảo mật (SSRF)" };
    }
    if (process.env.MCP_ALLOW_PRIVATE_NETWORK !== "true") {
      if (isBlockedHostname(host)) {
        return { ok: false, error: "Hostname nội bộ không được phép (đặt MCP_ALLOW_PRIVATE_NETWORK=true nếu dùng mạng LAN/localhost)" };
      }
      if ((net.isIPv4(host) || net.isIPv6(host)) && !isPublicAddress(host)) {
        return { ok: false, error: "Địa chỉ IP nội bộ không được phép (đặt MCP_ALLOW_PRIVATE_NETWORK=true nếu dùng mạng LAN)" };
      }
    }
    return { ok: true, url: parsed.toString().replace(/\/$/, "") };
  } catch {
    return { ok: false, error: "URL không hợp lệ" };
  }
}

// Đảm bảo bảng mcp_servers tồn tại
db.exec(`
  CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    tools_schema TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

interface DbMcpServer {
  id: string;
  account_id: string;
  name: string;
  base_url: string;
  api_key: string;
  enabled: number;
  tools_schema: string;
  created_at: string;
}

const serverSaveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Tên server không được để trống"),
  baseUrl: z.string().url("URL không hợp lệ (cần bắt đầu bằng http:// hoặc https://)"),
  apiKey: z.string().optional(),
  enabled: z.boolean().default(true),
});

export const mcpRoutes = new Hono()
  .get("/", (c) => {
    const rows = db.prepare(
      "SELECT id, account_id, name, base_url, api_key, enabled, tools_schema, created_at FROM mcp_servers ORDER BY created_at DESC"
    ).all() as unknown as DbMcpServer[];

    return c.json({
      items: rows.map((r) => {
        let toolsCount = 0;
        try {
          const parsed = JSON.parse(r.tools_schema || "[]") as unknown[];
          if (Array.isArray(parsed)) toolsCount = parsed.length;
        } catch {
          // ignore
        }
        const plainKey = decryptSecretSafe(r.api_key);

        return {
          id: r.id,
          name: r.name,
          baseUrl: r.base_url,
          hasApiKey: Boolean(plainKey),
          apiKeyMasked: plainKey ? maskSecret(plainKey) : "",
          enabled: Boolean(r.enabled),
          toolsCount,
          createdAt: r.created_at,
        };
      }),
    });
  })

  .post("/servers", async (c) => {
    const parsed = serverSaveSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Dữ liệu không hợp lệ", issues: parsed.error.issues }, 400);
    }

    const { id, name, baseUrl, apiKey, enabled } = parsed.data;
    const urlCheck = validateMcpBaseUrl(baseUrl);
    if (!urlCheck.ok) {
      return c.json({ error: urlCheck.error }, 400);
    }

    const accounts = listAccounts();
    const primaryAccountId = accounts[0]?.id ?? "default";

    const serverId = id?.trim() || `mcp-${crypto.randomUUID().slice(0, 8)}`;

    const existing = db.prepare("SELECT api_key FROM mcp_servers WHERE id = ?").get(serverId) as { api_key: string } | undefined;
    const finalEncryptedKey =
      apiKey !== undefined
        ? apiKey.trim()
          ? encryptSecret(apiKey.trim())
          : ""
        : (existing?.api_key ?? "");

    // Lưu server
    db.prepare(`
      INSERT INTO mcp_servers (id, account_id, name, base_url, api_key, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        base_url = excluded.base_url,
        api_key = excluded.api_key,
        enabled = excluded.enabled
    `).run(serverId, primaryAccountId, name.trim(), urlCheck.url, finalEncryptedKey, enabled ? 1 : 0);

    log.info({ serverId, name }, "Đã lưu MCP server");

    return c.json({ ok: true, id: serverId });
  })

  .delete("/servers/:id", (c) => {
    const id = c.req.param("id");
    db.prepare("DELETE FROM mcp_servers WHERE id = ?").run(id);
    log.info({ id }, "Đã xóa MCP server");
    return c.json({ ok: true });
  })

  .post("/test", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { baseUrl?: string; apiKey?: string };
    const baseUrl = body.baseUrl?.trim();
    if (!baseUrl) {
      return c.json({ ok: false, error: "Thiếu URL của MCP server" }, 400);
    }
    const urlCheck = validateMcpBaseUrl(baseUrl);
    if (!urlCheck.ok) {
      return c.json({ ok: false, error: urlCheck.error }, 400);
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (body.apiKey?.trim()) {
      headers.Authorization = `Bearer ${body.apiKey.trim()}`;
    }

    // Thử gọi /mcp/v1/tools/list hoặc JSON-RPC tools/list
    try {
      // 1. Thử endpoint JSON-RPC
      const endpoint = baseUrl.endsWith("/") ? `${baseUrl}mcp/v1/tools/list` : `${baseUrl}/mcp/v1/tools/list`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        signal: AbortSignal.timeout(8_000),
      });

      if (res.ok) {
        const data = (await res.json()) as { result?: { tools?: { name: string }[] } };
        const tools = data.result?.tools ?? [];
        return c.json({
          ok: true,
          toolsCount: tools.length,
          tools: tools.map((t) => t.name).slice(0, 10),
        });
      }

      // 2. Thử GET endpoint trực tiếp
      const pingRes = await fetch(baseUrl, {
        headers,
        signal: AbortSignal.timeout(5_000),
      });

      if (pingRes.ok || pingRes.status === 404 || pingRes.status === 405) {
        return c.json({
          ok: true,
          toolsCount: 0,
          tools: [],
          hint: "Server đang online nhưng chưa phản hồi đúng chuẩn JSON-RPC tools/list.",
        });
      }

      return c.json({ ok: false, error: `Server trả mã HTTP ${res.status}` }, 400);
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });
