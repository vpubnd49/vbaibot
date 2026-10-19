import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { resolveLanguageModel } from "../llm-provider.js";
import { listAgents } from "../../config/agent-store.js";
import { loadAllSkills } from "../../skills/skill-manager.js";
import { createOrUpdateSkillTool, createListSkillsTool } from "./create-skill-tool.js";
import { createWordDocumentTool, createExcelFileTool } from "./create-document-tools.js";
import { createTextDocumentTool } from "./create-text-document-tool.js";
import { createWebSearchTool } from "./web-search-tool.js";
import { createNewsTool } from "./news-tool.js";
import type { ToolContext } from "./tool-catalog-types.js";
import { ketQuaLoi } from "./tool-failure-result.js";
import { createLogger } from "../../shared/logger.js";

const log = createLogger("chief-of-staff-tool");

export interface SubBotRole {
  id: string;
  name: string;
  icon: string;
  rolePrompt: string;
  source: "agent" | "skill" | "system";
}

/**
 * Lấy danh sách đội ngũ Bot thực tế từ chính source & DB của vbaibot:
 * - Các Agent đã cấu hình trong bảng `agents` (listAgents)
 * - Xưởng Skill (quản lý .agents/skill-drafts và .agents/skills)
 * - Các Skill chuyên môn thực tế đang có trong `.agents/skills/` (loadAllSkills)
 */
export function getVbaibotTeamRoles(): SubBotRole[] {
  const roles: SubBotRole[] = [
    {
      id: "xuong-skill",
      name: "Xưởng Skill (Sandbox)",
      icon: "🛠️",
      source: "system",
      rolePrompt:
        "Bạn là Xưởng Skill của hệ thống VBAIBot — chuyên thiết kế, viết mới và kiểm thử các Kỹ năng (SKILL.md) trong `.agents/skill-drafts/` trước khi lưu vào `.agents/skills/`. Khi được giao tạo hoặc đề xuất skill mới: hãy gọi `create_or_update_skill` với `mode='sandbox_draft'`, tự thiết kế dữ liệu mẫu để kiểm thử, ghi lại kết quả vào `sample_test_report`, và báo cáo rõ kết quả chạy thử để xin ý kiến duyệt.",
    },
  ];

  try {
    const dbAgents = listAgents();
    for (const ag of dbAgents) {
      roles.push({
        id: ag.id,
        name: ag.name,
        icon: ag.icon || "🤖",
        source: "agent",
        rolePrompt:
          ag.persona?.trim() ||
          `Bạn là Agent "${ag.name}" (${ag.id}) được cấu hình trong hệ thống VBAIBot. Hãy thực hiện nhiệm vụ đúng theo chuyên môn của bạn.`,
      });
    }
  } catch {
    // Bỏ qua nếu DB chưa sẵn sàng trong unit test độc lập
  }

  try {
    const skills = loadAllSkills();
    for (const sk of skills) {
      roles.push({
        id: sk.id,
        name: sk.name || sk.id,
        icon: "📘",
        source: "skill",
        rolePrompt:
          `Bạn là chuyên gia thực thi kỹ năng "${sk.name}" (ID: ${sk.id}) của hệ thống VBAIBot.\n` +
          `Mô tả nghiệp vụ: ${sk.description}\n\n` +
          `HƯỚNG DẪN CHUYÊN MÔN TỪ SKILL.MD:\n${sk.content.slice(0, 6000)}`,
      });
    }
  } catch {
    // Bỏ qua nếu không đọc được thư mục skill
  }

  return roles;
}

function resolveSubBotRole(targetBot: string): SubBotRole {
  const norm = targetBot.trim().toLowerCase();
  const allRoles = getVbaibotTeamRoles();
  const matched = allRoles.find(
    (r) =>
      r.id.toLowerCase() === norm ||
      r.name.toLowerCase().includes(norm) ||
      norm.includes(r.id.toLowerCase()),
  );
  if (matched) return matched;

  return {
    id: norm.replace(/[^a-z0-9_-]+/g, "-") || "chuyen-vien",
    name: targetBot.trim(),
    icon: "🤖",
    source: "system",
    rolePrompt: `Bạn là chuyên viên AI phụ trách "${targetBot.trim()}" trong hệ thống VBAIBot. Hãy hoàn thành chính xác yêu cầu được giao dựa trên dữ liệu và công cụ của hệ thống.`,
  };
}

export function createDelegateToBotTool(ctx?: ToolContext) {
  return tool({
    description: [
      "Điều phối đa tác tử (Multi-Agent) trên dữ liệu thật của VBAIBot: Giao việc dây chuyền (`sequential_pipeline`) hoặc song song (`parallel_tasks`) cho các Agent trong hệ thống (`listAgents`), các Kỹ năng chuyên môn trong `.agents/skills/` (`loadAllSkills`: soạn VB hành chính NĐ30, VB Đảng HD05, rà soát VBHC, tra cứu hành chính, pháp lý legalkit-vn, kế toán TT99, thuế, ngân hàng, tài chính doanh nghiệp, NotebookLM...) và `Xưởng Skill`.",
      "Dùng khi người dùng yêu cầu phối hợp nhiều bước nghiệp vụ hoặc giao Xưởng Skill tạo/test thử skill mới trong Sandbox trước khi duyệt lưu chính thức.",
    ].join("\n"),
    inputSchema: z.object({
      mode: z
        .enum(["sequential_pipeline", "parallel_tasks"])
        .optional()
        .default("sequential_pipeline")
        .describe(
          "'sequential_pipeline': chạy dây chuyền (kết quả của bước trước chuyển làm đầu vào cho bước sau); 'parallel_tasks': chạy song song nhiều chuyên môn cùng lúc.",
        ),
      tasks: z
        .array(
          z.object({
            bot: z
              .string()
              .min(2)
              .describe(
                "ID hoặc tên Agent / Skill trong hệ thống VBAIBot (ví dụ: 'soan-thao-vb-nd30', 'ra-soat-van-ban-hanh-chinh', 'tra-cuu-tham-quyen-hanh-chinh', 'legalkit-vn', 'vn-accounting', 'vn-tax', 'xuong-skill', hoặc ID agent trong DB)",
              ),
            instruction: z
              .string()
              .min(5)
              .describe("Yêu cầu cụ thể giao cho Agent / Skill này thực hiện"),
          }),
        )
        .min(1)
        .max(6)
        .describe("Danh sách các đầu việc cần điều phối"),
    }),
    execute: async ({ mode = "sequential_pipeline", tasks }) => {
      try {
        const subTools: Record<string, any> = {
          create_or_update_skill: createOrUpdateSkillTool(ctx),
          list_skills: createListSkillsTool(),
          web_search: createWebSearchTool(),
          news_lookup: createNewsTool(),
        };
        if (ctx) {
          subTools.create_excel_file = createExcelFileTool(ctx);
          subTools.create_word_document = createWordDocumentTool(ctx);
          subTools.create_text_document = createTextDocumentTool(ctx);
        }

        const model = resolveLanguageModel(ctx?.agent);
        const logs: { botId: string; botName: string; icon: string; output: string }[] = [];

        if (mode === "parallel_tasks") {
          const results = await Promise.all(
            tasks.map(async (t) => {
              const role = resolveSubBotRole(t.bot);
              const res = await generateText({
                model,
                system: `${role.rolePrompt}\nTrả lời chính xác, bám sát dữ liệu thực tế của hệ thống VBAIBot.`,
                prompt: t.instruction,
                tools: subTools,
                stopWhen: stepCountIs(3),
              });
              return {
                botId: role.id,
                botName: role.name,
                icon: role.icon,
                output: res.text.trim() || "(Đã hoàn thành thao tác công cụ)",
              };
            }),
          );
          logs.push(...results);
        } else {
          let accumulatedContext = "";
          for (const t of tasks) {
            const role = resolveSubBotRole(t.bot);
            const promptText = accumulatedContext
              ? `KẾT QUẢ TỪ BƯỚC TRƯỚC:\n${accumulatedContext}\n\nNHIỆM VỤ CỦA BẠN (${role.name}):\n${t.instruction}`
              : t.instruction;

            const res = await generateText({
              model,
              system: `${role.rolePrompt}\nTrả lời chính xác, rõ ràng kết quả đã thực hiện để chuyển tiếp cho bước sau.`,
              prompt: promptText,
              tools: subTools,
              stopWhen: stepCountIs(3),
            });

            const out = res.text.trim() || "(Đã hoàn thành thao tác công cụ)";
            logs.push({ botId: role.id, botName: role.name, icon: role.icon, output: out });
            accumulatedContext += `\n--- Kết quả từ ${role.icon} ${role.name} ---\n${out}\n`;
          }
        }

        log.info(
          { mode, botCount: logs.length, bots: logs.map((l) => l.botId) },
          "Đã hoàn thành điều phối các Agent/Skill của VBAIBot",
        );

        const header = `💬 Messaged ${logs.map((l) => `${l.icon} ${l.botName}`).join(", ")} (${logs.length} messages with ${logs.length} Bots):`;
        const details = logs
          .map((l, idx) => `### ${idx + 1}. ${l.icon} **${l.botName}** (\`${l.botId}\`):\n${l.output}`)
          .join("\n\n");

        return `${header}\n\n${details}\n\n---\n[CHỈ DẪN TỔNG HỢP]: Hãy tóm tắt kết quả thực tế từ các Agent/Skill vừa chạy, và nếu cần người dùng quyết định bước tiếp theo thì trình bày rõ các lựa chọn **[A]**, **[B]**, **[C]** để người dùng chọn duyệt.`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ err }, "Lỗi khi điều phối multi-agent");
        return ketQuaLoi(`Lỗi khi điều phối công việc giữa các bot: ${msg}`);
      }
    },
  });
}
