import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import type { API } from "zca-js";
import { ThreadType } from "zca-js";
import { runAgentTurn } from "../../agent/agent-loop.js";
import { saveTurnTrace, trongGiaoDich } from "../../agent/agent-trace-store.js";
import type { StepTrace } from "../../agent/agent-step-trace.js";
import { TOOL_DEFINITIONS } from "../../agent/tools/index.js";
import { listAccounts, listEnabledAccounts } from "../../config/account-store.js";
import { listAgents } from "../../config/agent-store.js";
import { dataDir } from "../../config/env.js";
import { appendMessage } from "../../conversation/history-store.js";
import { updateThreadSettings } from "../../conversation/thread-settings-store.js";
import { recordThreadActivity } from "../../conversation/thread-store.js";
import { finishAgentTurn, openAgentTurn } from "../../conversation/usage-store.js";
import { readDocument } from "../../documents/document-reader.js";
import { listSkillDrafts, loadAllSkills, getSkillDraftsRootDir } from "../../skills/skill-manager.js";
import { synthesizeSingleVoiceEdge } from "../../voice/edge-tts.js";
import { saveVoiceFile } from "../../voice/voice-file-store.js";
import { getAccountInsight } from "../group-insight.js";
import { createLogger } from "../../shared/logger.js";
import type { ParsedMessage } from "../../zalo/zalo-message-parser.js";

const log = createLogger("sep-workspace-routes");

const SEP_EXPORT_DIR = path.join(dataDir, "shared-files", "sep-exports");

/** Chỉ chặn các tool đặc thù Zalo group/poll/email trên giao diện Web App */
const SEP_RESTRICTED_TOOLS = [
  "send_email",
  "group_admin",
  "create_poll",
  "recall_message",
  "tag_member",
  "add_reaction",
  "send_sticker",
];

export type SepExportFile = {
  fileName: string;
  downloadUrl: string;
  viewUrl?: string;
  ext: string;
};

export type SepBotBadge = {
  botId: string;
  botName: string;
  icon: string;
  summary: string;
};

export type WorkspaceBotItem = {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  role: string;
  source: "system" | "agent" | "skill";
};

/**
 * Xây dựng danh sách Bot hoàn toàn từ dữ liệu thật của hệ thống VBAIBot:
 * 1. Điều phối viên hệ thống & Xưởng Skill Sandbox
 * 2. Các Agent thực tế đang cấu hình trong bảng `agents` (listAgents)
 * 3. Các Kỹ năng thực tế trong `.agents/skills/` (loadAllSkills)
 */
export function buildWorkspaceBotsFromVbaibot(): WorkspaceBotItem[] {
  const items: WorkspaceBotItem[] = [
    {
      id: "sep-chief",
      name: "🟢 Điều Phối Hệ Thống (VBAIBot)",
      shortName: "Điều Phối Hệ Thống",
      icon: "🟢",
      color: "#3b82f6",
      role: "Tổng điều phối các Agent, Kỹ năng (.agents/skills) và Công cụ thực tế của VBAIBot",
      source: "system",
    },
    {
      id: "xuong-skill",
      name: "🛠️ Xưởng Skill (Sandbox)",
      shortName: "Xưởng Skill",
      icon: "🛠️",
      color: "#8b5cf6",
      role: "Thiết kế, kiểm thử Sandbox (.agents/skill-drafts) và nâng cấp SKILL.md cho VBAIBot",
      source: "system",
    },
  ];

  try {
    const agents = listAgents();
    for (const ag of agents) {
      items.push({
        id: `agent:${ag.id}`,
        name: `${ag.icon || "🤖"} ${ag.name}`,
        shortName: ag.name,
        icon: ag.icon || "🤖",
        color: "#10b981",
        role:
          (ag.persona && ag.persona.trim().slice(0, 140)) ||
          `Agent hệ thống (${ag.modelProvider ?? "mặc định"} · ${ag.accountCount} tài khoản gắn kết)`,
        source: "agent",
      });
    }
  } catch {
    // Bỏ qua nếu DB chưa khởi tạo trong môi trường test cô lập
  }

  try {
    const skills = loadAllSkills();
    for (const sk of skills) {
      items.push({
        id: `skill:${sk.id}`,
        name: `📘 ${sk.name || sk.id}`,
        shortName: sk.name || sk.id,
        icon: "📘",
        color: "#f59e0b",
        role: sk.description ? sk.description.slice(0, 160) : `Kỹ năng chuyên môn (${sk.id})`,
        source: "skill",
      });
    }
  } catch {
    // Bỏ qua nếu thư mục skill chưa có
  }

  return items;
}

const chatSchema = z.object({
  message: z.string().trim().min(1, "Nội dung yêu cầu không được để trống").max(8000),
  botId: z.string().trim().default("sep-chief"),
  sessionId: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_:-]+$/)
    .default("vbaibot_mobile"),
  senderName: z.string().trim().max(100).optional().default("Người dùng"),
  autoVoice: z.boolean().optional().default(false),
  voiceInputDurationSec: z.number().optional(),
});

function createSepMockZaloApi(capturedFiles: SepExportFile[]): API {
  const captureAttachments = (payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const attachments = (payload as { attachments?: unknown }).attachments;
    if (!Array.isArray(attachments)) return;
    fs.mkdirSync(SEP_EXPORT_DIR, { recursive: true });
    for (const item of attachments) {
      if (typeof item !== "string" || !fs.existsSync(item)) continue;
      const base = path.basename(item).replace(/[^a-zA-Z0-9._-]/g, "_");
      const uniqueName = `${Date.now()}_${base}`;
      const destPath = path.join(SEP_EXPORT_DIR, uniqueName);
      try {
        fs.copyFileSync(item, destPath);
        const ext = path.extname(base).toLowerCase();
        capturedFiles.push({
          fileName: path.basename(item),
          downloadUrl: `/api/public/sep/files/${encodeURIComponent(uniqueName)}`,
          viewUrl:
            ext === ".html" || ext === ".md"
              ? `/api/public/sep/view/${encodeURIComponent(uniqueName)}`
              : undefined,
          ext,
        });
      } catch (err) {
        log.warn({ err, item }, "Không thể sao lưu file xuất từ Workspace");
      }
    }
  };

  return {
    sendMessage: async (msg: unknown) => {
      captureAttachments(msg);
      return {};
    },
    sendCustomSticker: async () => ({}),
    sendImage: async () => ({}),
    sendChatVoice: async () => ({}),
    sendFile: async () => ({}),
    addReaction: async () => ({}),
    sendTypingEvent: async () => ({}),
    sendSeenEvent: async () => ({}),
    sendDeliveredEvent: async () => ({}),
  } as unknown as API;
}

function extractBotBadgesFromTrace(
  trace: StepTrace[],
  capturedFiles: SepExportFile[],
  turnStartMs: number,
  workspaceBots: WorkspaceBotItem[],
): SepBotBadge[] {
  const badges: SepBotBadge[] = [];
  const seenKey = new Set<string>();

  for (const step of trace) {
    for (const tc of step.toolCalls) {
      if (tc.name === "delegate_to_bot") {
        try {
          const parsed = JSON.parse(tc.input) as {
            tasks?: { bot?: string; instruction?: string }[];
          };
          const taskList = Array.isArray(parsed.tasks) ? parsed.tasks : [];
          for (const t of taskList) {
            const rawBot = t.bot?.trim() || "agent";
            const found = workspaceBots.find(
              (b) =>
                b.id === rawBot ||
                b.id === `skill:${rawBot}` ||
                b.id === `agent:${rawBot}` ||
                b.shortName.toLowerCase().includes(rawBot.toLowerCase()),
            );
            const label = found ? found.name : rawBot;
            const icon = found ? found.icon : "🤖";
            const key = `bot:${rawBot}`;
            if (!seenKey.has(key)) {
              seenKey.add(key);
              badges.push({
                botId: rawBot,
                botName: label,
                icon,
                summary: t.instruction?.slice(0, 120) ?? "Đã thực thi nhiệm vụ chuyên môn",
              });
            }
          }
        } catch {
          // ignore JSON parse issues
        }
      } else if (tc.name === "create_or_update_skill") {
        const key = "bot:xuong-skill";
        if (!seenKey.has(key)) {
          seenKey.add(key);
          badges.push({
            botId: "xuong-skill",
            botName: "🛠️ Xưởng Skill",
            icon: "🛠️",
            summary: "Đóng gói SKILL.md & chạy Sandbox Test",
          });
        }
      } else {
        const toolDef = TOOL_DEFINITIONS.find((d) => d.key === tc.name);
        if (toolDef) {
          const key = `tool:${tc.name}`;
          if (!seenKey.has(key)) {
            seenKey.add(key);
            badges.push({
              botId: tc.name,
              botName: `⚙️ ${toolDef.label}`,
              icon: "⚙️",
              summary: toolDef.description,
            });
          }
        }
      }
    }
  }

  // Kiểm tra các bản nháp skill vừa được tạo/cập nhật trong lượt này để đính kèm file .md
  try {
    const drafts = listSkillDrafts();
    const dateTag = new Date().toISOString().slice(0, 10);
    fs.mkdirSync(SEP_EXPORT_DIR, { recursive: true });
    for (const d of drafts) {
      const updatedMs =
        d.updatedAt instanceof Date
          ? d.updatedAt.getTime()
          : d.updatedAt
            ? Date.parse(String(d.updatedAt))
            : 0;
      if (Number.isFinite(updatedMs) && updatedMs >= turnStartMs - 5000) {
        const draftDir = path.join(getSkillDraftsRootDir(), d.id);
        const skillMdPath = path.join(draftDir, "SKILL.md");
        const samplePath = path.join(draftDir, "sample-test.md");
        if (fs.existsSync(skillMdPath)) {
          const displayName = `skill-${d.id}-${dateTag}.md`;
          const uniqueName = `${Date.now()}_${displayName}`;
          fs.copyFileSync(skillMdPath, path.join(SEP_EXPORT_DIR, uniqueName));
          capturedFiles.push({
            fileName: displayName,
            downloadUrl: `/api/public/sep/files/${encodeURIComponent(uniqueName)}`,
            viewUrl: `/api/public/sep/view/${encodeURIComponent(uniqueName)}`,
            ext: ".md",
          });
        }
        if (fs.existsSync(samplePath)) {
          const displayName = `${d.id}-sample-test-${dateTag}.md`;
          const uniqueName = `${Date.now()}_${displayName}`;
          fs.copyFileSync(samplePath, path.join(SEP_EXPORT_DIR, uniqueName));
          capturedFiles.push({
            fileName: displayName,
            downloadUrl: `/api/public/sep/files/${encodeURIComponent(uniqueName)}`,
            viewUrl: `/api/public/sep/view/${encodeURIComponent(uniqueName)}`,
            ext: ".md",
          });
        }
      }
    }
  } catch (err) {
    log.warn({ err }, "Không thể quét skill drafts sau lượt chạy");
  }

  return badges;
}

export const sepWorkspaceRoutes = new Hono()
  .use(
    "/*",
    cors({
      origin: (origin) => origin || "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  )

  .get("/bots", (c) => {
    const bots = buildWorkspaceBotsFromVbaibot();
    const accounts = listAccounts().map((a) => ({
      id: a.id,
      label: a.label,
      enabled: a.enabled,
      agentId: a.agentId,
    }));
    const insight = getAccountInsight("all", 30);
    return c.json({
      ok: true,
      bots,
      accounts,
      drafts: listSkillDrafts(),
      activeSkills: loadAllSkills().map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        triggers: s.triggers,
      })),
      toolsCount: TOOL_DEFINITIONS.length,
      stats30d: {
        totalThreads: insight.totalThreads,
        totalTurns: insight.totalTurns,
        totalTokens: insight.totalTokens,
        averageResponseTimeMs: insight.averageResponseTimeMs,
      },
    });
  })

  .get("/files/:fileName", (c) => {
    const rawName = c.req.param("fileName") || "";
    const safeName = path.basename(rawName);
    if (!safeName || safeName !== rawName) {
      return c.json({ ok: false, error: "Tên file không hợp lệ" }, 400);
    }
    const fullPath = path.join(SEP_EXPORT_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      return c.json({ ok: false, error: "File không tồn tại" }, 404);
    }
    const buf = fs.readFileSync(fullPath);
    const displayName = safeName.replace(/^\d+_/, "");
    return new Response(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(displayName)}"`,
      },
    });
  })

  .get("/view/:fileName", (c) => {
    const rawName = c.req.param("fileName") || "";
    const safeName = path.basename(rawName);
    if (!safeName || safeName !== rawName) {
      return c.text("Tên file không hợp lệ", 400);
    }
    const fullPath = path.join(SEP_EXPORT_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      return c.text("File không tồn tại", 404);
    }
    const ext = path.extname(safeName).toLowerCase();
    const content = fs.readFileSync(fullPath, "utf-8");
    if (ext === ".html") {
      return c.html(content);
    }
    const escaped = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return c.html(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName.replace(/^\d+_/, "")}</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;padding:20px;line-height:1.6;max-width:860px;margin:0 auto}pre{white-space:pre-wrap;word-break:break-word;background:#1e293b;padding:16px;border-radius:12px;border:1px solid #334155}</style></head><body><h2>📄 ${safeName.replace(/^\d+_/, "")}</h2><pre>${escaped}</pre></body></html>`);
  })

  .post("/tts", async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      text?: string;
      voiceName?: string;
    } | null;
    const rawText = body?.text?.trim() ?? "";
    if (!rawText) {
      return c.json({ ok: false, error: "Thiếu nội dung text cần đọc" }, 400);
    }
    try {
      const mp3Buffer = await synthesizeSingleVoiceEdge(rawText, body?.voiceName);
      const saved = await saveVoiceFile("sep", "sep_web", mp3Buffer, "mp3");
      return c.json({
        ok: true,
        voiceUrl: `/voice/sep/${encodeURIComponent(saved.filename)}`,
      });
    } catch (err) {
      log.error({ err }, "Lỗi tổng hợp giọng nói cho Workspace");
      return c.json(
        { ok: false, error: err instanceof Error ? err.message : "Lỗi TTS" },
        500,
      );
    }
  })

  .post("/stt", async (c) => {
    try {
      const formData = await c.req.formData();
      const audio = formData.get("audio");
      if (!audio || !(audio instanceof File)) {
        return c.json({ ok: false, error: "Không tìm thấy file âm thanh" }, 400);
      }
      const arrayBuf = await audio.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const ext = path.extname(audio.name || ".webm") || ".webm";
      const tmpFile = path.join(
        os.tmpdir(),
        `sep_stt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`,
      );
      fs.writeFileSync(tmpFile, buf);
      try {
        const doc = await readDocument(tmpFile);
        return c.json({
          ok: true,
          text: doc.text.trim(),
        });
      } finally {
        try {
          fs.unlinkSync(tmpFile);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      log.error({ err }, "Lỗi STT trên Workspace");
      return c.json(
        { ok: false, error: err instanceof Error ? err.message : "Không nhận diện được giọng nói" },
        500,
      );
    }
  })

  .post("/chat", async (c) => {
    const rawBody = await c.req.json().catch(() => null);
    const parsed = chatSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
        400,
      );
    }

    const { message, botId, sessionId, senderName, autoVoice } = parsed.data;
    const account = listEnabledAccounts()[0] ?? listAccounts()[0];
    if (!account) {
      return c.json({ ok: false, error: "Hệ thống chưa cấu hình tài khoản bot" }, 500);
    }

    const workspaceBots = buildWorkspaceBotsFromVbaibot();
    const selectedBot = workspaceBots.find((b) => b.id === botId) ?? workspaceBots[0]!;
    const safeBotThreadKey = botId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const threadId = `sep_${safeBotThreadKey}_${sessionId}`;
    const startMs = Date.now();

    updateThreadSettings(account.id, threadId, {
      disabledTools: SEP_RESTRICTED_TOOLS,
    });

    let promptWithPersona = message;
    if (botId === "sep-chief") {
      promptWithPersona =
        `[BỐI CẢNH: Người dùng đang làm việc trực tiếp với Điều Phối Hệ Thống VBAIBot trên ứng dụng di động. ` +
        `Khi cần phối hợp nhiều kỹ năng thực tế trong hệ thống (.agents/skills) hoặc tạo/kiểm thử kỹ năng mới trong Xưởng Skill, hãy gọi \`delegate_to_bot\` hoặc \`create_or_update_skill\` (với mode='sandbox_draft' khi tạo skill mới và trình bày các lựa chọn [A], [B], [C] để người dùng chọn duyệt).]\n\n` +
        message;
    } else if (botId === "xuong-skill") {
      promptWithPersona =
        `[BỐI CẢNH: Người dùng đang làm việc trực tiếp với 🛠️ Xưởng Skill của VBAIBot. ` +
        `Khi được giao thiết kế hoặc nâng cấp bộ kỹ năng mới, hãy lưu vào Sandbox trước bằng \`create_or_update_skill\` với \`mode="sandbox_draft"\` kèm \`sample_test_report\`, sau đó liệt kê các phương án [A], [B] ở cuối câu trả lời để người dùng bấm chọn duyệt.]\n\n` +
        message;
    } else if (botId.startsWith("skill:")) {
      const skillId = botId.slice("skill:".length);
      promptWithPersona =
        `[BỐI CẢNH: Người dùng đang chọn làm việc chuyên sâu với Kỹ năng "${selectedBot.shortName}" (ID: \`${skillId}\`) của hệ thống VBAIBot. Hãy áp dụng đúng quy chuẩn nghiệp vụ của kỹ năng này.]\n\n` +
        message;
    } else {
      promptWithPersona =
        `[BỐI CẢNH: Người dùng đang làm việc trực tiếp với ${selectedBot.name} (${selectedBot.role}) trong hệ thống VBAIBot.]\n\n` +
        message;
    }

    const parsedMessage: ParsedMessage = {
      accountId: account.id,
      threadId,
      threadType: ThreadType.User,
      isGroup: false,
      senderId: `sep_user_${sessionId}`,
      senderName,
      text: promptWithPersona,
      images: [],
      msgId: `sep_msg_${startMs}`,
      cliMsgId: `sep_cli_${startMs}`,
      isSelf: false,
      mentionsMe: true,
      rawData: {},
    };

    const turnId = openAgentTurn(account.id, threadId, "message");
    const trace: StepTrace[] = [];
    const daGuiBoiTool: string[] = [];
    const capturedFiles: SepExportFile[] = [];
    const ghiNhanDaGui = (noiDung: string): void => {
      if (noiDung.trim()) daGuiBoiTool.push(noiDung.trim());
    };

    try {
      const result = await runAgentTurn({
        api: createSepMockZaloApi(capturedFiles),
        account,
        batch: [parsedMessage],
        trace,
        ghiNhanDaGui,
      });

      trongGiaoDich(() => {
        finishAgentTurn(turnId, result.usage, Date.now() - startMs);
        if (trace.length > 0) saveTurnTrace(turnId, trace);
      });

      let replyText = result.text.trim();
      if (!replyText && daGuiBoiTool.length > 0) {
        replyText = daGuiBoiTool.join("\n\n");
      }
      if (!replyText) {
        replyText = "Đã ghi nhận yêu cầu của bạn.";
      }

      const botBadges = extractBotBadgesFromTrace(trace, capturedFiles, startMs, workspaceBots);

      appendMessage(account.id, threadId, {
        role: "user",
        content: message,
        senderName,
        senderId: `sep_user_${sessionId}`,
      });
      appendMessage(account.id, threadId, {
        role: "assistant",
        content: replyText,
      });

      recordThreadActivity({
        accountId: account.id,
        threadId,
        threadType: ThreadType.User,
        displayName: `${selectedBot.icon} ${selectedBot.shortName}: ${senderName}`,
        lastSenderName: senderName,
      });

      let voiceUrl: string | undefined;
      if (autoVoice) {
        try {
          const mp3Buf = await synthesizeSingleVoiceEdge(replyText.slice(0, 750));
          const saved = await saveVoiceFile("sep", threadId, mp3Buf, "mp3");
          voiceUrl = `/voice/sep/${encodeURIComponent(saved.filename)}`;
        } catch (ttsErr) {
          log.warn({ err: ttsErr }, "Không thể tạo voice tự động cho Workspace");
        }
      }

      return c.json({
        ok: true,
        bot: selectedBot,
        reply: replyText,
        files: capturedFiles,
        botBadges,
        voiceUrl,
        sessionId,
        steps: trace.length,
      });
    } catch (err) {
      trongGiaoDich(() => {
        finishAgentTurn(
          turnId,
          { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: trace.length },
          Date.now() - startMs,
        );
        if (trace.length > 0) saveTurnTrace(turnId, trace);
      });
      log.error({ err, sessionId, botId }, "Lỗi xử lý lượt chat trên Workspace");
      return c.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : "Đã xảy ra lỗi khi xử lý yêu cầu",
        },
        500,
      );
    }
  });
