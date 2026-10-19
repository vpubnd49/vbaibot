import { Hono } from "hono";
import { z } from "zod";
import { TOOL_DEFINITIONS } from "../../agent/tools/index.js";
import {
  getFetchSettingsForApi,
  getSearchSettingsForApi,
  updateFetchSettings,
  updateSearchSettings,
} from "../../config/runtime-tool-settings.js";
import { deleteSkill, loadAllSkills, saveSkill } from "../../skills/skill-manager.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("tool-routes");

const searchUpdateSchema = z.object({
  provider: z.enum(["duckduckgo", "brave"]).optional(),
  // Bỏ trống = giữ key cũ; chuỗi rỗng tường minh = xóa key. Key đi 1 chiều
  // lên server, lưu DB mã hóa, không bao giờ trả về nguyên văn.
  braveApiKey: z.string().optional(),
});

const fetchUpdateSchema = z.object({
  fallbackEnabled: z.boolean().optional(),
  jinaApiKey: z.string().optional(),
});

const skillSaveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  triggers: z.array(z.string()).default([]),
  content: z.string().min(1),
});

/**
 * /api/tools - catalog tool + cấu hình chuỗi nguồn cho web_search/web_fetch + quản lý Skills.
 * Một nguồn duy nhất từ tool-registry (giống reaction-icons) - frontend không
 * chép lại. Trạng thái bật/tắt tool per account nằm trong GET /api/accounts.
 */
export const toolRoutes = new Hono()

  .get("/", (c) =>
    c.json({
      items: TOOL_DEFINITIONS.map((t) => {
        // available = hạ tầng đã sẵn sàng chưa (khác với bật/tắt per account).
        // Thiếu cờ này thì UI hiện tool bật sẵn trong khi model không hề nhận
        // được nó - người dùng tưởng bot có khả năng đó mà không có.
        const available = t.available ? t.available() : true;
        return {
          key: t.key,
          label: t.label,
          description: t.description,
          group: t.group,
          hasSettings: Boolean(t.hasSettings),
          available,
          unavailableHint: available ? undefined : t.unavailableHint,
        };
      }),
      search: getSearchSettingsForApi(),
      fetch: getFetchSettingsForApi(),
    }),
  )

  .get("/skills", (c) => {
    const coreIds = new Set([
      "soan-thao-vb-nd30",
      "soan-thao-vb-dang-hd05",
      "ra-soat-van-ban-hanh-chinh",
      "tra-cuu-tham-quyen-hanh-chinh",
      "legalkit-vn",
      "vn-accounting",
      "vn-banking",
      "vn-corporate-finance",
      "vn-finance-app-builder",
      "vn-finance-core",
      "vn-tax",
      "zalo-agent-notebooklm",
    ]);
    const items = loadAllSkills(true).map((s) => ({
      name: s.id,
      displayName: s.name,
      description: s.description,
      triggers: s.triggers,
      contentPreview: s.content.slice(0, 300),
      contentLength: s.content.length,
      isSystem: coreIds.has(s.id),
    }));
    return c.json({ items });
  })

  .post("/skills", async (c) => {
    const parsed = skillSaveSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Dữ liệu skill không hợp lệ", issues: parsed.error.issues }, 400);
    }
    const { id, name, description, triggers, content } = parsed.data;
    const res = saveSkill({ id: id || name, name, description, triggers, content });
    if (!res.success) {
      return c.json({ error: res.error || "Không thể lưu skill" }, 400);
    }
    log.info({ name, path: res.path }, "Tạo/cập nhật skill từ Dashboard");
    return c.json({ ok: true, name });
  })

  .delete("/skills/:name", (c) => {
    const name = decodeURIComponent(c.req.param("name"));
    const deleted = deleteSkill(name);
    if (!deleted.success) {
      return c.json({ error: deleted.error || "Không thể xóa skill hệ thống hoặc không tìm thấy skill" }, 400);
    }
    return c.json({ ok: true });
  })

  .patch("/search", async (c) => {
    const parsed = searchUpdateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Dữ liệu không hợp lệ", issues: parsed.error.issues }, 400);
    }

    try {
      const search = updateSearchSettings(parsed.data);
      // Audit: ghi field nào đổi, KHÔNG ghi giá trị key
      log.info(
        { provider: search.provider, changedKey: parsed.data.braveApiKey !== undefined },
        "Đổi cấu hình web search từ dashboard",
      );
      return c.json({ ok: true, search: getSearchSettingsForApi() });
    } catch (err) {
      // Chọn brave mà chưa có key - lỗi của người dùng, không phải lỗi server
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  })

  .patch("/fetch", async (c) => {
    const parsed = fetchUpdateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Dữ liệu không hợp lệ", issues: parsed.error.issues }, 400);
    }

    updateFetchSettings(parsed.data);
    log.info(
      {
        fallbackEnabled: parsed.data.fallbackEnabled,
        changedKey: parsed.data.jinaApiKey !== undefined,
      },
      "Đổi cấu hình web fetch từ dashboard",
    );
    return c.json({ ok: true, fetch: getFetchSettingsForApi() });
  });
