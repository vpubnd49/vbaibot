import { markdownToBlocks } from "./notion-markdown-blocks.js";
import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { db } from "../../conversation/database.js";
import type { ToolContext } from "./index.js";

const log = createLogger("notion-sync");

// Tạo bảng cấu hình Notion
db.exec(`
  CREATE TABLE IF NOT EXISTS notion_config (
    account_id TEXT PRIMARY KEY,
    api_key TEXT NOT NULL DEFAULT '',
    default_database_id TEXT DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

interface NotionConfig {
  apiKey: string;
  defaultDatabaseId: string;
  enabled: boolean;
}

function getNotionConfig(accountId: string): NotionConfig | null {
  const row = db.prepare(
    "SELECT api_key, default_database_id, enabled FROM notion_config WHERE account_id = ?",
  ).get(accountId) as { api_key: string; default_database_id: string; enabled: number } | undefined;
  if (!row || !row.api_key) return null;
  return {
    apiKey: row.api_key,
    defaultDatabaseId: row.default_database_id,
    enabled: !!row.enabled,
  };
}

/**
 * Đồng bộ nội dung lên Notion: tạo page, thêm block, tìm kiếm.
 *
 * API key cấu hình qua DB (notion_config table) hoặc dashboard.
 */
export function createNotionSyncTool(ctx: ToolContext) {
  return tool({
    description:
      'Đồng bộ nội dung lên Notion. Tạo ghi chú, thêm nội dung, tìm kiếm trên Notion. ' +
      'Dùng khi: "ghi vào notion", "lưu lên notion", "tạo trang notion", "tìm trên notion".',
    inputSchema: z.object({
      action: z.enum(["create_page", "append_block", "search"]).describe(
        "create_page = tạo trang mới, append_block = thêm nội dung vào trang, search = tìm kiếm",
      ),
      title: z.string().optional().describe("Tiêu đề trang (cho create_page)"),
      content: z.string().optional().describe("Nội dung markdown (cho create_page hoặc append_block)"),
      pageId: z.string().optional().describe("ID trang Notion (cho append_block)"),
      query: z.string().optional().describe("Từ khóa tìm kiếm (cho search)"),
      databaseId: z.string().optional().describe("ID database Notion (nếu khác mặc định)"),
    }),
    execute: async ({ action, title, content, pageId, query, databaseId }) => {
      try {
        const config = getNotionConfig(ctx.account.id);
        if (!config || !config.apiKey) {
          return ketQuaLoi(
            "Chưa cấu hình Notion API key. " +
            "Cần thêm vào cơ sở dữ liệu: INSERT INTO notion_config (account_id, api_key, default_database_id, enabled) " +
            "VALUES ('...',  'ntn_...',  '...', 1)",
          );
        }
        if (!config.enabled) {
          return ketQuaLoi("Notion đã tắt. Bật lại bằng: UPDATE notion_config SET enabled=1 WHERE account_id='...'");
        }

        const headers: Record<string, string> = {
          Authorization: `Bearer ${config.apiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        };

        if (action === "search") {
          if (!query) return ketQuaLoi("Thiếu từ khóa tìm kiếm.");
          const res = await fetch("https://api.notion.com/v1/search", {
            method: "POST",
            headers,
            body: JSON.stringify({ query, page_size: 5 }),
          });
          if (!res.ok) return ketQuaLoi(`Notion API lỗi: ${res.status} ${await res.text()}`);
          const data = (await res.json()) as {
            results: { id: string; properties?: Record<string, unknown>; url?: string }[];
          };
          const results = data.results.map((r) => ({
            id: r.id,
            url: r.url ?? `https://notion.so/${r.id.replace(/-/g, "")}`,
          }));
          return {
            success: true,
            message: results.length > 0
              ? `Tìm thấy ${results.length} kết quả trên Notion.`
              : "Không tìm thấy kết quả nào.",
            results,
          };
        }

        if (action === "create_page") {
          if (!title) return ketQuaLoi("Thiếu tiêu đề.");
          const parentDb = databaseId ?? config.defaultDatabaseId;

          const body: Record<string, unknown> = {
            parent: parentDb
              ? { type: "database_id", database_id: parentDb }
              : { type: "workspace", workspace: true },
            properties: {
              title: { title: [{ text: { content: title } }] },
            },
          };

          // Thêm nội dung
          if (content) {
            body.children = markdownToBlocks(content);
          }

          const res = await fetch("https://api.notion.com/v1/pages", {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });
          if (!res.ok) return ketQuaLoi(`Notion API lỗi: ${res.status} ${await res.text()}`);
          const page = (await res.json()) as { id: string; url: string };
          log.info({ pageId: page.id, title }, "Đã tạo trang Notion");
          return {
            success: true,
            message: `Đã tạo trang "${title}" trên Notion.`,
            pageId: page.id,
            url: page.url,
          };
        }

        if (action === "append_block") {
          if (!pageId) return ketQuaLoi("Thiếu pageId.");
          if (!content) return ketQuaLoi("Thiếu content.");

          const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ children: markdownToBlocks(content) }),
          });
          if (!res.ok) return ketQuaLoi(`Notion API lỗi: ${res.status} ${await res.text()}`);
          log.info({ pageId }, "Đã thêm nội dung Notion");
          return { success: true, message: "Đã thêm nội dung vào trang Notion." };
        }

        return ketQuaLoi("Hành động không hợp lệ.");
      } catch (err) {
        log.error({ err, action }, "Lỗi Notion sync");
        return ketQuaLoi(`Lỗi Notion: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  });
}
