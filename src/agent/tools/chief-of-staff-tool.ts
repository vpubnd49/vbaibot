import { generateText, stepCountIs } from "ai";
import { tool } from "ai";
import { z } from "zod";
import { resolveLanguageModel } from "../llm-provider.js";
import { listAgents } from "../../config/agent-store.js";
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
}

export const BUILTIN_TEAM_BOTS: SubBotRole[] = [
  {
    id: "radar-cong-dong",
    name: "Radar Cộng Đồng FB",
    icon: "🟠",
    rolePrompt:
      "Bạn là bot Radar Cộng Đồng FB — chuyên quét tin tức, các nhóm cộng đồng Facebook, Fanpage đối thủ, X/HackerNews/YouTube để thu thập dữ liệu thực tế, xu hướng, câu hỏi thường gặp, tín hiệu mua và nỗi đau (Pain Point) của người dùng. " +
      "Khi được yêu cầu quét hoặc dựng Dashboard báo cáo, ngoài tóm tắt kết quả, hãy gọi `create_text_document` (format='html', fileName='radar-cong-dong-ai-dashboard.html') để xuất trang Dashboard HTML trực quan gồm 3 khu vực: (1) Bảng cơ hội (Nỗi đau, Tín hiệu mua, Đối thủ làm gì, Xu hướng, Ý tưởng nội dung), (2) Bản đồ nhiệt chủ đề (Heatmap theo nhóm cộng đồng & biểu đồ xếp hạng bình luận), và (3) Phòng chiến lược đối thủ (Bản đồ định vị & Khoảng trống thị trường).",
  },
  {
    id: "jakie-insight",
    name: "Jakie – Phân Tích Insight",
    icon: "🔴",
    rolePrompt:
      "Bạn là Jakie — chuyên gia phân tích dữ liệu từ Radar để dựng Bảng Insight và Pain Point chia theo từng khối/nhóm đối tượng. Khi cần xuất bảng tổng hợp, hãy gọi create_excel_file để tạo file .xlsx (ví dụ: insight-painpoint-YYYY-MM-DD.xlsx).",
  },
  {
    id: "linh-content",
    name: "Linh – Content & Kịch Bản",
    icon: "🩷",
    rolePrompt:
      "Bạn là Linh — chuyên gia sáng tạo nội dung Marketing, viết bài Facebook, kịch bản TikTok và tổng hợp các góc tiếp cận (mỗi góc có hook hấp dẫn) dựa trên bảng Insight của Jakie. Khi có nội dung hoàn chỉnh, có thể gọi create_text_document để xuất file .md.",
  },
  {
    id: "xuong-skill",
    name: "Xưởng Skill",
    icon: "🟢",
    rolePrompt:
      "Bạn là Xưởng Skill — chuyên gia thiết kế, viết mới và kiểm thử các Kỹ năng (SKILL.md) cho hệ thống bot. Khi được giao tạo hoặc đề xuất skill mới: hãy gọi create_or_update_skill với mode='sandbox_draft', tự thiết kế dữ liệu mẫu để kiểm thử, ghi lại các lỗi phát hiện & đã tự khắc phục vào sample_test_report, và báo cáo rõ kết quả chạy thử để xin ý kiến duyệt trước khi lưu vào thư viện chung.",
  },
  {
    id: "ebook-ai-thuc-chien",
    name: "Ebook AI Thực Chiến",
    icon: "🟣",
    rolePrompt:
      "Bạn là bot Ebook AI Thực Chiến — chuyên đề xuất chủ đề, lập dàn ý chi tiết và biên soạn các tài liệu hướng dẫn / mini-ebook thực chiến dễ hiểu cho người học.",
  },
  {
    id: "soan-bai-dao-tao",
    name: "Soạn Bài Đào Tạo",
    icon: "🔵",
    rolePrompt:
      "Bạn là bot Soạn Bài Đào Tạo — chuyên thiết kế slide bài giảng, tài liệu đào tạo (.html / .md / .docx) kèm ví dụ trực quan trước/sau để học viên dễ nắm bắt.",
  },
  {
    id: "leader-marketing",
    name: "Leader Marketing",
    icon: "🟤",
    rolePrompt:
      "Bạn là Leader Marketing — chuyên lập bảng phân công công việc cho từng bot trong team Marketing, rà soát tiến độ chiến dịch và chốt các đầu việc quan trọng với người dùng.",
  },
];

function resolveSubBotRole(targetBot: string): SubBotRole {
  const norm = targetBot.trim().toLowerCase();
  const builtin = BUILTIN_TEAM_BOTS.find(
    (b) => b.id === norm || b.name.toLowerCase().includes(norm) || norm.includes(b.id),
  );
  if (builtin) return builtin;

  try {
    const customAgents = listAgents();
    const matched = customAgents.find(
      (a) => a.id.toLowerCase() === norm || a.name.toLowerCase().includes(norm),
    );
    if (matched) {
      return {
        id: matched.id,
        name: matched.name,
        icon: matched.icon || "🤖",
        rolePrompt: matched.persona || `Bạn là bot chuyên trách ${matched.name}.`,
      };
    }
  } catch {
    // Bỏ qua nếu DB chưa khởi tạo trong môi trường unit test đơn lẻ
  }

  return {
    id: norm.replace(/[^a-z0-9_-]+/g, "-") || "chuyen-vien",
    name: targetBot.trim(),
    icon: "🤖",
    rolePrompt: `Bạn là bot chuyên trách "${targetBot.trim()}" trong đội ngũ AI. Hãy hoàn thành xuất sắc nhiệm vụ được Sếp – Chief of Staff giao.`,
  };
}

const DELEGATE_DESC = [
  "Sếp – Chief of Staff / Leader điều phối đa tác tử (Multi-Agent): Giao việc dây chuyền hoặc song song cho các Bot chuyên trách trong đội ngũ (`Radar Cộng Đồng FB`, `Jakie`, `Linh`, `Xưởng Skill`, `Ebook AI Thực Chiến`, `Soạn Bài Đào Tạo`, `Leader Marketing`, hoặc bất kỳ Agent nào đang có).",
  "Dùng khi người dùng yêu cầu:",
  "- Điều phối nhiều bot làm việc với nhau (ví dụ: Radar quét pain point -> Jakie dựng bảng Insight Excel -> Linh viết content -> Xưởng Skill đề xuất & chạy thử skill mới).",
  "- Giao việc cho Xưởng Skill viết và test thử các skill mới trong thư mục riêng trước khi hỏi người dùng duyệt lưu vào thư viện chung.",
  "- Lập bảng giao việc cho từng bot rồi tổng hợp báo cáo và hỏi người dùng duyệt các mục tiếp theo (A, B, C, D...).",
].join("\n");

export function createDelegateToBotTool(ctx?: ToolContext) {
  return tool({
    description: DELEGATE_DESC,
    inputSchema: z.object({
      mode: z
        .enum(["sequential_pipeline", "parallel_tasks"])
        .optional()
        .default("sequential_pipeline")
        .describe(
          "'sequential_pipeline': chạy dây chuyền (kết quả của bot trước tự động chuyển tiếp làm đầu vào cho bot sau, giống quy trình Radar -> Jakie -> Linh -> Xưởng Skill); 'parallel_tasks': giao việc song song cho nhiều bot cùng lúc.",
        ),
      tasks: z
        .array(
          z.object({
            bot: z
              .string()
              .min(2)
              .describe(
                "Tên hoặc ID bot nhận việc (ví dụ: 'Radar Cộng Đồng FB', 'Jakie', 'Linh', 'Xưởng Skill', 'Ebook AI Thực Chiến', 'Soạn Bài Đào Tạo', 'Leader Marketing')",
              ),
            instruction: z
              .string()
              .min(5)
              .describe("Yêu cầu cụ thể giao cho bot này thực hiện"),
          }),
        )
        .min(1)
        .max(6)
        .describe("Danh sách các đầu việc cần điều phối cho các bot chuyên trách"),
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
        const logs: { botName: string; icon: string; output: string }[] = [];

        if (mode === "parallel_tasks") {
          const results = await Promise.all(
            tasks.map(async (t) => {
              const role = resolveSubBotRole(t.bot);
              const res = await generateText({
                model,
                system: `${role.rolePrompt}\nTrả lời ngắn gọn, súc tích, tập trung vào kết quả công việc để báo cáo lại cho Sếp – Chief of Staff.`,
                prompt: t.instruction,
                tools: subTools,
                stopWhen: stepCountIs(3),
              });
              return {
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
              ? `BỐI CẢNH / KẾT QUẢ TỪ CÁC BOT TRƯỚC:\n${accumulatedContext}\n\nNHIỆM VỤ CỦA BẠN (${role.name}):\n${t.instruction}`
              : t.instruction;

            const res = await generateText({
              model,
              system: `${role.rolePrompt}\nTrả lời ngắn gọn, rõ ràng kết quả đã làm để chuyển tiếp cho bước tiếp theo và báo cáo Sếp – Chief of Staff.`,
              prompt: promptText,
              tools: subTools,
              stopWhen: stepCountIs(3),
            });

            const out = res.text.trim() || "(Đã hoàn thành thao tác công cụ)";
            logs.push({ botName: role.name, icon: role.icon, output: out });
            accumulatedContext += `\n--- Kết quả từ ${role.icon} ${role.name} ---\n${out}\n`;
          }
        }

        log.info(
          { mode, botCount: logs.length, bots: logs.map((l) => l.botName) },
          "Chief of Staff đã hoàn thành điều phối các bot chuyên trách",
        );

        const header = `💬 Messaged ${logs.map((l) => `${l.icon} ${l.botName}`).join(", ")} (${logs.length} messages with ${logs.length} Bots):`;
        const details = logs
          .map((l, idx) => `### ${idx + 1}. ${l.icon} **${l.botName}** báo cáo:\n${l.output}`)
          .join("\n\n");

        return `${header}\n\n${details}\n\n---\n[CHỈ DẪN CHO SẾP – CHIEF OF STAFF]: Hãy tóm tắt mạch lạc những gì các bot vừa hoàn thành (nêu rõ dòng chảy công việc từ bot nào sang bot nào), liệt kê bảng giao việc (nếu có) và đặt câu hỏi kèm các phương án lựa chọn rõ ràng **[A]**, **[B]**, **[C]**, **[D]** để người dùng bấm/chọn duyệt bước tiếp theo!`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ err }, "Lỗi khi điều phối multi-agent");
        return ketQuaLoi(`Lỗi khi điều phối công việc giữa các bot: ${msg}`);
      }
    },
  });
}
