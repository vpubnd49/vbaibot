import { tool } from "ai";
import { z } from "zod";
import { saveSkill, loadAllSkills } from "../../skills/skill-manager.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("create-skill-tool");

const CREATE_SKILL_DESC = [
  "Tự động tạo mới hoặc cập nhật một KỸ NĂNG (Skill) chuyên biệt cho hệ thống bot.",
  "Dùng khi người dùng hướng dẫn bot học một mẫu văn bản mới, một quy trình hành chính, quy chuẩn cơ quan, hoặc yêu cầu lưu lại kiến thức thành skill có cấu trúc.",
  "Sau khi lưu, skill được lưu thành file chuẩn .agents/skills/<skill_id>/SKILL.md và tự động kích hoạt cho các lượt hội thoại tiếp theo có từ khóa liên quan.",
].join("\n");

export function createOrUpdateSkillTool() {
  return tool({
    description: CREATE_SKILL_DESC,
    inputSchema: z.object({
      skill_id: z
        .string()
        .min(3)
        .max(50)
        .describe("Định danh kỹ năng (slug dạng chữ thường, gạch nối, ví dụ: 'mau-vb-so-tai-chinh', 'quy-trinh-tiep-nhan-don')"),
      name: z
        .string()
        .min(3)
        .max(100)
        .describe("Tên hiển thị của kỹ năng (ví dụ: 'Soạn văn bản Sở Tài chính tỉnh Lâm Đồng')"),
      description: z
        .string()
        .min(10)
        .max(500)
        .describe("Mô tả kỹ năng: dùng khi nào, giải quyết bài toán gì"),
      triggers: z
        .array(z.string())
        .min(1)
        .describe("Danh sách từ khóa/cụm từ kích hoạt kỹ năng khi người dùng nhắc tới (ví dụ: ['sở tài chính', 'stc', 'tài chính lâm đồng'])"),
      content: z
        .string()
        .min(20)
        .describe("Nội dung hướng dẫn chi tiết của kỹ năng: quy tắc thể thức, cấu trúc các phần, mẫu ví dụ, các lưu ý bắt buộc theo markdown"),
    }),
    execute: async ({ skill_id, name, description, triggers, content }) => {
      try {
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
        return `Đã tạo/cập nhật kỹ năng "${name}" (ID: ${skill_id}) thành công. Kỹ năng đã sẵn sàng áp dụng ngay khi người dùng nhắc đến các từ khóa: ${triggers.join(", ")}.`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return ketQuaLoi(`Lỗi khi tạo kỹ năng: ${msg}`);
      }
    },
  });
}

const LIST_SKILLS_DESC = "Liệt kê danh sách tất cả các kỹ năng (Skills) hiện có trong hệ thống bot cùng các từ khóa kích hoạt.";

export function createListSkillsTool() {
  return tool({
    description: LIST_SKILLS_DESC,
    inputSchema: z.object({
      filter: z.string().optional().describe("Từ khóa lọc tên hoặc mô tả kỹ năng (tùy chọn)"),
    }),
    execute: async ({ filter }) => {
      try {
        const all = loadAllSkills(true);
        let list = all;
        if (filter && filter.trim()) {
          const q = filter.toLowerCase().trim();
          list = all.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.description.toLowerCase().includes(q) ||
              s.triggers.some((t) => t.includes(q)),
          );
        }

        if (list.length === 0) {
          return "Hiện tại không tìm thấy kỹ năng nào phù hợp.";
        }

        const lines = list.map((s, idx) => {
          const trigStr = s.triggers.length > 0 ? ` (Triggers: ${s.triggers.slice(0, 5).join(", ")})` : "";
          return `${idx + 1}. **${s.name}** [ID: \`${s.id}\`]: ${s.description}${trigStr}`;
        });

        return `Danh sách kỹ năng hiện có (${list.length}):\n${lines.join("\n")}`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return ketQuaLoi(`Lỗi khi lấy danh sách kỹ năng: ${msg}`);
      }
    },
  });
}
