import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { db } from "../../conversation/database.js";
import type { ToolContext } from "./index.js";

const log = createLogger("mcp-client");

// Bảng lưu MCP server configs
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

interface McpServer {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  toolsSchema: string;
}

function listMcpServers(accountId: string): McpServer[] {
  const rows = db.prepare(
    "SELECT id, name, base_url, api_key, enabled, tools_schema FROM mcp_servers WHERE account_id = ? AND enabled = 1",
  ).all(accountId) as {
    id: string; name: string; base_url: string;
    api_key: string; enabled: number; tools_schema: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    baseUrl: r.base_url,
    apiKey: r.api_key,
    enabled: !!r.enabled,
    toolsSchema: r.tools_schema,
  }));
}

/**
 * MCP Client — gọi tools từ MCP servers bên ngoài.
 *
 * Hỗ trợ giao thức MCP qua HTTP (SSE transport hoặc HTTP POST).
 * MCP servers được cấu hình trong DB (bảng mcp_servers).
 */
export function createMcpClientTool(ctx: ToolContext) {
  return tool({
    description:
      'Gọi tool từ MCP server bên ngoài (hệ thống plugin mở rộng). ' +
      'Dùng khi: "gọi MCP", "dùng plugin", "kết nối server", "xem danh sách MCP tools". ' +
      'Danh sách servers cấu hình trong database.',
    inputSchema: z.object({
      action: z.enum(["list_servers", "list_tools", "call_tool"]).describe(
        "list_servers = xem servers, list_tools = xem tools của 1 server, call_tool = gọi tool",
      ),
      serverId: z.string().optional().describe("ID server MCP"),
      toolName: z.string().optional().describe("Tên tool cần gọi (cho call_tool)"),
      arguments: z.record(z.string(), z.unknown()).optional().describe("Arguments truyền cho tool (JSON object)"),
    }),
    execute: async ({ action, serverId, toolName, arguments: args }) => {
      try {
        const servers = listMcpServers(ctx.account.id);

        if (action === "list_servers") {
          if (servers.length === 0) {
            return {
              success: true,
              message: "Chưa có MCP server nào. Thêm bằng SQL:\n" +
                "INSERT INTO mcp_servers (id, account_id, name, base_url, api_key) " +
                "VALUES ('my-server', 'account-id', 'My Server', 'http://localhost:8080', '')",
              servers: [],
            };
          }
          return {
            success: true,
            message: `Có ${servers.length} MCP server(s).`,
            servers: servers.map((s) => ({ id: s.id, name: s.name, url: s.baseUrl })),
          };
        }

        if (action === "list_tools") {
          if (!serverId) return ketQuaLoi("Thiếu serverId.");
          const server = servers.find((s) => s.id === serverId);
          if (!server) return ketQuaLoi(`Không tìm thấy server "${serverId}".`);

          // Gọi MCP list tools
          const tools = await mcpListTools(server);
          // Lưu cache tools schema
          db.prepare("UPDATE mcp_servers SET tools_schema = ? WHERE id = ?")
            .run(JSON.stringify(tools), serverId);

          return {
            success: true,
            message: `Server "${server.name}" có ${tools.length} tools.`,
            tools: tools.map((t: { name: string; description?: string }) => ({
              name: t.name,
              description: t.description ?? "",
            })),
          };
        }

        if (action === "call_tool") {
          if (!serverId) return ketQuaLoi("Thiếu serverId.");
          if (!toolName) return ketQuaLoi("Thiếu toolName.");
          const server = servers.find((s) => s.id === serverId);
          if (!server) return ketQuaLoi(`Không tìm thấy server "${serverId}".`);

          const result = await mcpCallTool(server, toolName, args ?? {});
          log.info({ serverId, toolName }, "MCP tool call thành công");
          return { success: true, result };
        }

        return ketQuaLoi("Hành động không hợp lệ.");
      } catch (err) {
        log.error({ err, action }, "Lỗi MCP client");
        return ketQuaLoi(`Lỗi MCP: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  });
}

/**
 * Gọi MCP server để liệt kê tools (tools/list).
 */
async function mcpListTools(server: McpServer): Promise<{ name: string; description?: string }[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (server.apiKey) headers.Authorization = `Bearer ${server.apiKey}`;

  const res = await fetch(`${server.baseUrl}/mcp/v1/tools/list`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`MCP server trả ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    result?: { tools?: { name: string; description?: string }[] };
  };
  return data.result?.tools ?? [];
}

/**
 * Gọi MCP tool (tools/call).
 */
async function mcpCallTool(
  server: McpServer,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (server.apiKey) headers.Authorization = `Bearer ${server.apiKey}`;

  const res = await fetch(`${server.baseUrl}/mcp/v1/tools/call`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`MCP server trả ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    result?: { content?: unknown[] };
    error?: { message: string };
  };

  if (data.error) throw new Error(data.error.message);
  return data.result?.content ?? data.result;
}
