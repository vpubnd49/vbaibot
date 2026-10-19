import { tool } from "ai";
import { z } from "zod";
import {
  saveSkill,
  loadAllSkills,
  saveSkillDraft,
  listSkillDrafts,
  promoteSkillDraft,
} from "../../skills/skill-manager.js";
import { getAdminUserIds } from "../../zalo/owner-notifier.js";
import type { ToolContext } from "./tool-catalog-types.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("create-skill-tool");

const CREATE_SKILL_DESC = [
  "Xưởng Skill — Tự động tạo mới, chạy thử trong thư mục riêng (sandbox) hoặc lưu/duyệt KỸ NĂNG (Skill) vào thư viện chung cho toàn bộ hệ thống bot.",
  "Hỗ trợ 3 chế độ (mode):",
  "1. 'sandbox_draft': Soạn thảo và lưu bản thử vào thư mục riêng (.agents/skill-drafts/<skill_id>/SKILL.md) kèm kết quả tự chạy thử (sample_test_report) để báo cáo và xin ý kiến Admin trước khi lưu vào thư viện chung.",
  "2. 'promote_draft': Khi Admin đồng ý ('Đồng ý, lưu skill' / 'Chốt lưu'), chuyển một hoặc nhiều skill từ thư mục thử nghiệm sang thư viện chung (.agents/skills/) để mọi bot đều dùng được ngay.",
  "3. 'direct_save' (mặc định khi người dùng yêu cầu lưu ngay): Lưu trực tiếp vào thư viện chung (.agents/skills/<skill_id>/SKILL.md).",
].join("\n");

export function createOrUpdateSkillTool(ctx?: ToolContext) {
  return tool({
    description: CREATE_SKILL_DESC,
    inputSchema: z.object({
      mode: z
        .enum(["direct_save", "sandbox_draft", "promote_draft"])
        .optional()
        .default("direct_save")
        .describe(
          "Chế độ: 'sandbox_draft' (lưu bản nháp + báo cáo chạy thử trong thư mục riêng chờ duyệt), 'promote_draft' (duyệt đưa bản nháp vào thư viện chung), 'direct_save' (lưu thẳng vào thư viện chung)",
        ),
      skill_id: z
        .string()
        .min(3)
        .max(50)
        .describe(
          "Định danh kỹ năng (slug chữ thường, gạch nối, ví dụ: 'ai-task-splitter', 'shop-inbox-assistant', 'meeting-minutes-writer')",
        ),
      promote_skill_ids: z
        .array(z.string())
        .optional()
        .describe(
          "Danh sách nhiều skill_id cần duyệt đưa vào thư viện chung cùng lúc khi mode='promote_draft' (ví dụ: ['ai-task-splitter', 'shop-inbox-assistant'])",
        ),
      name: z
        .string()
        .min(3)
        .max(100)
        .optional()
        .describe("Tên hiển thị của kỹ năng (bắt buộc khi tạo mới/cập nhật)"),
      description: z
        .string()
        .min(10)
        .max(500)
        .optional()
        .describe("Mô tả kỹ năng: dùng khi nào, giải quyết bài toán gì"),
      triggers: z
        .array(z.string())
        .optional()
        .describe("Danh sách từ khóa/cụm từ kích hoạt kỹ năng khi người dùng nhắc tới"),
      content: z
        .string()
        .min(20)
        .optional()
        .describe(
          "Nội dung hướng dẫn chi tiết của kỹ năng (SKILL.md): quy tắc thể thức, các bước xử lý, kiểm soát lỗi, ví dụ mẫu đầu vào/đầu ra",
        ),
      sample_test_report: z
        .string()
        .optional()
        .describe(
          "Báo cáo kết quả tự chạy thử trên dữ liệu mẫu (các tình huống đã test, lỗi phát hiện được và cách đã tự khắc phục trong prompt)",
        ),
    }),
    execute: async ({
      mode = "direct_save",
      skill_id,
      promote_skill_ids,
      name,
      description,
      triggers,
      content,
      sample_test_report,
    }) => {
      try {
        if (ctx) {
          if (ctx.isolated) {
            return ketQuaLoi("Không cho phép tạo hoặc cập nhật kỹ năng trong lượt chạy lịch tự động.");
          }
          const admins = getAdminUserIds(ctx.account.id);
          const isAdmin = admins.includes(ctx.message.senderId);
          if (!isAdmin) {
            return ketQuaLoi("Chỉ quản trị viên (Admin) mới có quyền tạo hoặc cập nhật kỹ năng hệ thống.");
          }
        }

        if (mode === "promote_draft") {
          const ids = Array.from(
            new Set([skill_id, ...(promote_skill_ids ?? [])].map((s) => s.trim()).filter(Boolean)),
          );
          const promoted: string[] = [];
          const errors: string[] = [];
          for (const id of ids) {
            const res = promoteSkillDraft(id);
            if (res.success) {
              promoted.push(res.id);
            } else {
              errors.push(`${id}: ${res.error}`);
            }
          }
          if (promoted.length === 0) {
            return ketQuaLoi(`Không thể duyệt lưu kỹ năng: ${errors.join("; ")}`);
          }
          log.info({ promoted }, "Đã duyệt chuyển skill từ Xưởng Skill sang thư viện chung");
          return (
            `Đã lưu chính thức ${promoted.length} kỹ năng vào thư viện chung (.agents/skills/): ${promoted.join(", ")}. ` +
            `Tất cả các bot trong hệ thống hiện đã có thể sử dụng ngay!` +
            (errors.length > 0 ? ` (Lưu ý lỗi một số mục: ${errors.join("; ")})` : "")
          );
        }

        if (!name || !description || !triggers || triggers.length === 0 || !content) {
          return ketQuaLoi(
            "Thiếu thông tin bắt buộc: khi tạo mới hoặc lưu bản thử cần cung cấp đủ name, description, triggers (ít nhất 1 từ khóa) và content.",
          );
        }

        if (mode === "sandbox_draft") {
          const res = saveSkillDraft({
            id: skill_id,
            name,
            description,
            triggers,
            content,
            sampleTestReport: sample_test_report,
          });
          if (!res.success) {
            return ketQuaLoi(`Không thể lưu bản thử kỹ năng: ${res.error || "lỗi không xác định"}`);
          }
          log.info({ skillId: res.id, name, path: res.path }, "Đã lưu bản thử skill trong Xưởng Skill");
          return (
            `Đã hoàn thiện và chạy thử kỹ năng "${name}" (ID: \`${res.id}\`) trong thư mục riêng (.agents/skill-drafts/${res.id}).\n` +
            `- Từ khóa kích hoạt: ${triggers.join(", ")}\n` +
            (sample_test_report ? `- Kết quả chạy thử: ${sample_test_report}\n` : "") +
            `Kỹ năng đang chờ Admin xác nhận trước khi đưa vào thư viện chung (.agents/skills/).`
          );
        }

        const res = saveSkill({
          id: skill_id,
          name,
          description,
          triggers,
          content,
        });

        if (!res.success) {
          return ketQuaLoi(`Không thể lưu kỹ năng: ${res.error || "lỗi không xác định"}`);
        }

        log.info({ skillId: skill_id, name, path: res.path }, "Đã lưu thành công skill mới");
        return `Đã tạo/cập nhật kỹ năng "${name}" (ID: ${skill_id}) thành công vào thư viện chung. Kỹ năng đã sẵn sàng áp dụng ngay khi người dùng nhắc đến các từ khóa: ${triggers.join(", ")}.`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return ketQuaLoi(`Lỗi khi tạo kỹ năng: ${msg}`);
      }
    },
  });
}

const LIST_SKILLS_DESC =
  "Liệt kê danh sách tất cả các kỹ năng (Skills) trong thư viện chung và các bản thử đang chờ duyệt trong Xưởng Skill.";

export function createListSkillsTool() {
  return tool({
    description: LIST_SKILLS_DESC,
    inputSchema: z.object({
      filter: z.string().optional().describe("Từ khóa lọc tên hoặc mô tả kỹ năng (tùy chọn)"),
      include_drafts: z
        .boolean()
        .optional()
        .default(true)
        .describe("Có hiển thị cả các bản thử đang chờ duyệt trong Xưởng Skill hay không"),
    }),
    execute: async ({ filter, include_drafts = true }) => {
      try {
        const all = loadAllSkills(true);
        const drafts = include_drafts ? listSkillDrafts() : [];
        const q = filter?.toLowerCase().trim() || "";

        const matchFn = (s: { name: string; description: string; triggers: string[]; id: string }) =>
          !q ||
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.triggers.some((t) => t.includes(q));

        const list = all.filter(matchFn);
        const draftList = drafts.filter(matchFn);

        if (list.length === 0 && draftList.length === 0) {
          return "Hiện tại không tìm thấy kỹ năng nào phù hợp.";
        }

        const parts: string[] = [];
        if (list.length > 0) {
          const lines = list.map((s, idx) => {
            const trigStr = s.triggers.length > 0 ? ` (Triggers: ${s.triggers.slice(0, 5).join(", ")})` : "";
            return `${idx + 1}. **${s.name}** [ID: \`${s.id}\`]: ${s.description}${trigStr}`;
          });
          parts.push(`📚 **Thư viện kỹ năng chung (${list.length})**:\n${lines.join("\n")}`);
        }

        if (draftList.length > 0) {
          const dLines = draftList.map((d, idx) => {
            const trigStr = d.triggers.length > 0 ? ` (Triggers: ${d.triggers.slice(0, 5).join(", ")})` : "";
            return `${idx + 1}. 🧪 **[Bản thử chờ duyệt] ${d.name}** [ID: \`${d.id}\`]: ${d.description}${trigStr}`;
          });
          parts.push(`🛠️ **Xưởng Skill - Bản thử đang chờ duyệt (${draftList.length})**:\n${dLines.join("\n")}`);
        }

        return parts.join("\n\n");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return ketQuaLoi(`Lỗi khi lấy danh sách kỹ năng: ${msg}`);
      }
    },
  });
}

