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
import { listAccounts, listEnabledAccounts } from "../../config/account-store.js";
import { dataDir } from "../../config/env.js";
import { appendMessage } from "../../conversation/history-store.js";
import { updateThreadSettings } from "../../conversation/thread-settings-store.js";
import { recordThreadActivity } from "../../conversation/thread-store.js";
import { finishAgentTurn, openAgentTurn } from "../../conversation/usage-store.js";
import { readDocument } from "../../documents/document-reader.js";
import { listSkillDrafts, loadAllSkills, getSkillDraftsRootDir } from "../../skills/skill-manager.js";
import { synthesizeSingleVoiceEdge } from "../../voice/edge-tts.js";
import { saveVoiceFile } from "../../voice/voice-file-store.js";
import { createLogger } from "../../shared/logger.js";
import type { ParsedMessage } from "../../zalo/zalo-message-parser.js";

const log = createLogger("sep-workspace-routes");

const SEP_EXPORT_DIR = path.join(dataDir, "shared-files", "sep-exports");

/** Chỉ chặn các tool đặc thù Zalo group/poll/email trên giao diện Web App Sếp */
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

const WORKSPACE_BOTS = [
  {
    id: "sep-chief",
    name: "🟢 Sếp – Chief of Staff",
    shortName: "Sếp – Chief of Staff",
    icon: "🟢",
    color: "#3b82f6",
    role: "Tổng chỉ huy Multi-Agent (điều phối Radar, Jakie, Linh, Xưởng Skill, Đào Tạo, Marketing)",
  },
  {
    id: "xuong-skill",
    name: "🛠️ Xưởng Skill",
    shortName: "Xưởng Skill",
    icon: "🛠️",
    color: "#8b5cf6",
    role: "Nhà máy chế tạo & kiểm thử Sandbox Skill (.md) trước khi kích hoạt",
  },
  {
    id: "radar-cong-dong",
    name: "🟠 Radar Cộng Đồng FB",
    shortName: "Radar Cộng Đồng FB",
    icon: "🟠",
    color: "#f97316",
    role: "Quét tín hiệu cộng đồng AI, phân tích xu hướng, xuất Excel & Web Dashboard 3 tab",
  },
  {
    id: "jakie-insight",
    name: "🔴 Jakie",
    shortName: "Jakie",
    icon: "🔴",
    color: "#ef4444",
    role: "Chuyên gia bóc tách Insight & Tâm lý học hành vi khách hàng",
  },
  {
    id: "linh-content",
    name: "🩷 Linh",
    shortName: "Linh",
    icon: "🩷",
    color: "#ec4899",
    role: "Biên tập viên Content Viral, Storytelling & Copywriting chuyển đổi cao",
  },
  {
    id: "ebook-ai-thuc-chien",
    name: "🟣 Ebook AI Thực Chiến",
    shortName: "Ebook AI Thực Chiến",
    icon: "🟣",
    color: "#a855f7",
    role: "Đóng gói Ebook, Cẩm nang, Playbook chuyên sâu",
  },
  {
    id: "soan-bai-dao-tao",
    name: "🔵 Soạn Bài Đào Tạo",
    shortName: "Soạn Bài Đào Tạo",
    icon: "🔵",
    color: "#06b6d4",
    role: "Thiết kế giáo án, kịch bản Workshop, bài tập thực hành & rubric",
  },
  {
    id: "leader-marketing",
    name: "🟤 Leader Marketing",
    shortName: "Leader Marketing",
    icon: "🟤",
    color: "#b45309",
    role: "Hoạch định phễu Marketing, GTM, định vị chiến lược & lịch đăng bài",
  },
];

const chatSchema = z.object({
  message: z.string().trim().min(1, "Nội dung yêu cầu không được để trống").max(8000),
  botId: z.string().trim().default("sep-chief"),
  sessionId: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .default("samsung_sep"),
  senderName: z.string().trim().max(100).optional().default("Anh"),
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
        log.warn({ err, item }, "Không thể sao lưu file xuất từ Sếp Workspace");
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
): SepBotBadge[] {
  const badges: SepBotBadge[] = [];
  const seenKey = new Set<string>();

  for (const step of trace) {
    for (const tc of step.toolCalls) {
      if (tc.name === "delegate_to_bot") {
        try {
          const parsed = JSON.parse(tc.input) as {
            bot_id?: string;
            pipeline_bot_ids?: string[];
            task_brief?: string;
          };
          const ids = [
            ...(parsed.bot_id ? [parsed.bot_id] : []),
            ...(Array.isArray(parsed.pipeline_bot_ids) ? parsed.pipeline_bot_ids : []),
          ];
          for (const id of ids) {
            const found = WORKSPACE_BOTS.find((b) => b.id === id);
            const label = found ? found.name : id;
            const icon = found ? found.icon : "🤖";
            const key = `bot:${id}`;
            if (!seenKey.has(key)) {
              seenKey.add(key);
              badges.push({
                botId: id,
                botName: label,
                icon,
                summary: parsed.task_brief?.slice(0, 120) ?? "Đã bàn giao nhiệm vụ chuyên sâu",
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
      }
    }
  }

  // Kiểm tra các bản nháp skill vừa được tạo/cập nhật trong lượt này để đính kèm file .md vào bong bóng chat
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
    return c.json({
      ok: true,
      bots: WORKSPACE_BOTS,
      drafts: listSkillDrafts(),
      activeSkills: loadAllSkills().map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })),
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
      log.error({ err }, "Lỗi tổng hợp giọng nói cho Sếp Workspace");
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
      log.error({ err }, "Lỗi STT trên Sếp Workspace");
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

    const selectedBot = WORKSPACE_BOTS.find((b) => b.id === botId) ?? WORKSPACE_BOTS[0]!;
    const threadId = `sep_${botId}_${sessionId}`;
    const startMs = Date.now();

    updateThreadSettings(account.id, threadId, {
      disabledTools: SEP_RESTRICTED_TOOLS,
    });

    // Định hình vai trò theo bot mà người dùng đang chọn trên thanh pill
    let promptWithPersona = message;
    if (botId === "sep-chief") {
      promptWithPersona =
        `[BỐI CẢNH: Người dùng đang trò chuyện trực tiếp với 🟢 Sếp – Chief of Staff trên ứng dụng di động. ` +
        `Khi cần phân tích sâu theo chuyên môn (Radar Cộng Đồng FB, Jakie Insight, Linh Content, Xưởng Skill, Soạn Bài Đào Tạo, Leader Marketing), hãy chủ động gọi tool \`delegate_to_bot\` hoặc \`create_or_update_skill\` (với mode='sandbox_draft' khi tạo skill mới và trình bày các lựa chọn [A], [B], [C], [D], [E] rõ ràng để người dùng tick chọn duyệt). ` +
        `Nếu người dùng yêu cầu lập bảng hay báo cáo Radar, hãy tạo cả file Excel (\`create_excel_file\`) và nhắc có sẵn Dashboard trực quan tại /radar.]\n\n` +
        message;
    } else if (botId === "xuong-skill") {
      promptWithPersona =
        `[BỐI CẢNH: Người dùng đang làm việc trực tiếp với 🛠️ Xưởng Skill. ` +
        `Khi được giao thiết kế hoặc nâng cấp bộ kỹ năng mới, hãy lưu vào Sandbox trước bằng \`create_or_update_skill\` với \`mode="sandbox_draft"\` kèm \`sample_test_report\`, sau đó liệt kê các phương án [A], [B], [C], [D], [E] ở cuối câu trả lời để người dùng bấm chọn duyệt.]\n\n` +
        message;
    } else {
      promptWithPersona =
        `[BỐI CẢNH: Người dùng đang làm việc trực tiếp với chuyên gia ${selectedBot.name} (${selectedBot.role}). Hãy phản hồi đúng chuyên môn sâu của ${selectedBot.name}.]\n\n` +
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
        replyText = "Em đã ghi nhận yêu cầu của Sếp.";
      }

      const botBadges = extractBotBadgesFromTrace(trace, capturedFiles, startMs);

      // Nếu câu trả lời có nhắc tới Radar hoặc nghiên cứu cộng đồng mà chưa đính kèm link /radar, tự động đính card Web Dashboard
      if (
        (botId === "radar-cong-dong" ||
          botBadges.some((b) => b.botId === "radar-cong-dong") ||
          /radar|bản đồ nhiệt|phòng chiến lược|bảng cơ hội/i.test(replyText)) &&
        !capturedFiles.some((f) => f.ext === ".html")
      ) {
        capturedFiles.push({
          fileName: "ai-community-radar-dashboard.html",
          downloadUrl: "/radar",
          viewUrl: "/radar",
          ext: ".html",
        });
      }

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
          log.warn({ err: ttsErr }, "Không thể tạo voice tự động cho Sếp Workspace");
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
      log.error({ err, sessionId, botId }, "Lỗi xử lý lượt chat trên Sếp Workspace");
      return c.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : "Đã xảy ra lỗi khi xử lý yêu cầu",
        },
        500,
      );
    }
  });
