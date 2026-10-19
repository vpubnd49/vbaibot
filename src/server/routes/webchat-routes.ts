import fs from "node:fs";
import path from "node:path";
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
import { createLogger } from "../../shared/logger.js";
import type { ParsedMessage } from "../../zalo/zalo-message-parser.js";

const log = createLogger("webchat-routes");

const WEBCHAT_EXPORT_DIR = path.join(dataDir, "shared-files", "webchat-exports");
const WEBCHAT_RATE_WINDOW_MS = 60_000;
const WEBCHAT_MAX_REQ_PER_WINDOW = 15;
const ipHits = new Map<string, { count: number; resetAt: number }>();

/** Các công cụ tác động hệ thống/riêng tư bị khóa trên cổng WebChat công khai */
const WEBCHAT_RESTRICTED_TOOLS = [
  "send_email",
  "create_or_update_skill",
  "schedule_task",
  "cancel_schedule",
  "save_memory",
  "delete_memory",
  "propose_shared_knowledge",
  "group_admin",
  "create_poll",
  "recall_message",
  "tag_member",
  "add_reaction",
  "send_sticker",
  "notebooklm",
  "notion_sync",
  "mcp_client",
  "finance_tracker",
  "ocr_folder_to_file",
  "create_image",
  "create_music",
  "create_video",
  "create_voice_summary",
];

function checkWebchatRateLimit(ip: string): boolean {
  const now = Date.now();
  if (ipHits.size > 2000) {
    for (const [k, v] of ipHits) {
      if (v.resetAt <= now) ipHits.delete(k);
    }
  }
  const cur = ipHits.get(ip);
  if (!cur || cur.resetAt <= now) {
    ipHits.set(ip, { count: 1, resetAt: now + WEBCHAT_RATE_WINDOW_MS });
    return true;
  }
  if (cur.count >= WEBCHAT_MAX_REQ_PER_WINDOW) {
    return false;
  }
  cur.count += 1;
  return true;
}

const chatSchema = z.object({
  message: z.string().trim().min(1, "Nội dung câu hỏi không được để trống").max(5000),
  sessionId: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/, "sessionId chỉ gồm chữ cái, chữ số, gạch ngang/dưới")
    .default("guest"),
  senderName: z.string().trim().max(100).optional().default("Người dùng Web"),
});

export type WebchatExportFile = {
  fileName: string;
  downloadUrl: string;
};

/**
 * Tạo mock API Zalo cho các tool gọi an toàn trên WebChat, đồng thời
 * bắt và sao lưu các file tài liệu (.docx, .xlsx, .pptx, .pdf...) trước khi
 * khối finally của tool xóa file tạm.
 */
function createMockZaloApi(capturedFiles: WebchatExportFile[]): API {
  const captureAttachments = (payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const attachments = (payload as { attachments?: unknown }).attachments;
    if (!Array.isArray(attachments)) return;
    fs.mkdirSync(WEBCHAT_EXPORT_DIR, { recursive: true });
    for (const item of attachments) {
      if (typeof item !== "string" || !fs.existsSync(item)) continue;
      const base = path.basename(item).replace(/[^a-zA-Z0-9._-]/g, "_");
      const uniqueName = `${Date.now()}_${base}`;
      const destPath = path.join(WEBCHAT_EXPORT_DIR, uniqueName);
      try {
        fs.copyFileSync(item, destPath);
        capturedFiles.push({
          fileName: path.basename(item),
          downloadUrl: `/api/public/webchat/files/${encodeURIComponent(uniqueName)}`,
        });
      } catch (err) {
        log.warn({ err, item }, "Không thể sao lưu file xuất từ WebChat");
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

export const webchatRoutes = new Hono()
  .use(
    "/*",
    cors({
      origin: (origin) => {
        if (!origin) return "*";
        return origin; // Mở CORS an toàn cho webapp VBAI
      },
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  )

  // Trạng thái server bot webchat
  .get("/", (c) => {
    return c.json({
      ok: true,
      service: "VBAIBot WebChat API",
      status: "online",
      version: "2.1",
      description: "Trợ lý AI Pháp luật & Hành chính Việt Nam",
    });
  })

  // Tải file tài liệu do WebChat sinh ra
  .get("/files/:fileName", (c) => {
    const rawName = c.req.param("fileName") || "";
    const safeName = path.basename(rawName);
    if (!safeName || safeName !== rawName) {
      return c.json({ ok: false, error: "Tên file không hợp lệ" }, 400);
    }
    const fullPath = path.join(WEBCHAT_EXPORT_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      return c.json({ ok: false, error: "File không tồn tại hoặc đã hết hạn" }, 404);
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

  // Nhận tin nhắn và trả lời trực tiếp
  .post("/chat", async (c) => {
    const clientIp =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";
    if (!checkWebchatRateLimit(clientIp)) {
      return c.json(
        { ok: false, error: "Bạn gửi yêu cầu quá nhanh. Vui lòng chờ khoảng 1 phút rồi thử lại." },
        429,
      );
    }

    const rawBody = await c.req.json().catch(() => null);
    const parsed = chatSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, 400);
    }

    const { message, sessionId, senderName } = parsed.data;
    const account = listEnabledAccounts()[0] ?? listAccounts()[0];
    if (!account) {
      return c.json({ ok: false, error: "Hệ thống chưa cấu hình tài khoản bot" }, 500);
    }

    const threadId = `web_${sessionId}`;
    const startMs = Date.now();

    // Khóa các tool tác động hệ thống/riêng tư trên phiên WebChat công khai
    updateThreadSettings(account.id, threadId, {
      disabledTools: WEBCHAT_RESTRICTED_TOOLS,
    });

    const parsedMessage: ParsedMessage = {
      accountId: account.id,
      threadId,
      threadType: ThreadType.User,
      isGroup: false,
      senderId: `web_user_${sessionId}`,
      senderName,
      text: message,
      images: [],
      msgId: `web_msg_${startMs}`,
      cliMsgId: `web_cli_${startMs}`,
      isSelf: false,
      mentionsMe: true,
      rawData: {},
    };

    const turnId = openAgentTurn(account.id, threadId, "message");
    const trace: StepTrace[] = [];
    const daGuiBoiTool: string[] = [];
    const capturedFiles: WebchatExportFile[] = [];
    const ghiNhanDaGui = (noiDung: string): void => {
      if (noiDung.trim()) daGuiBoiTool.push(noiDung.trim());
    };

    log.info({ sessionId, threadId, clientIp, messageLength: message.length }, "Bắt đầu lượt chat từ Web VBAI");

    try {
      // 1. Chạy agent loop
      const result = await runAgentTurn({
        api: createMockZaloApi(capturedFiles),
        account,
        batch: [parsedMessage],
        trace,
        ghiNhanDaGui,
      });

      // 2. Chốt số token và lưu trace
      trongGiaoDich(() => {
        finishAgentTurn(turnId, result.usage, Date.now() - startMs);
        if (trace.length > 0) saveTurnTrace(turnId, trace);
      });

      // 3. Xác định câu trả lời cuối cùng
      let replyText = result.text.trim();
      if (!replyText && daGuiBoiTool.length > 0) {
        replyText = daGuiBoiTool.join("\n\n");
      }
      if (capturedFiles.length > 0) {
        const links = capturedFiles
          .map((f) => `- 📎 [${f.fileName}](${f.downloadUrl})`)
          .join("\n");
        replyText = `${replyText}\n\n📥 **Tài liệu đã tạo sẵn sàng tải về:**\n${links}`.trim();
      }
      if (!replyText) {
        replyText = "Tôi đã ghi nhận yêu cầu của bạn nhưng chưa có nội dung phản hồi cụ thể.";
      }

      // 4. Lưu vào lịch sử hội thoại để bot nhớ ngữ cảnh ở các câu sau
      appendMessage(account.id, threadId, {
        role: "user",
        content: message,
        senderName,
        senderId: `web_user_${sessionId}`,
      });
      appendMessage(account.id, threadId, {
        role: "assistant",
        content: replyText,
      });

      // 5. Ghi nhận phiên vào bảng threads để hiển thị tại trang "Phiên trò chuyện" trên Dashboard
      recordThreadActivity({
        accountId: account.id,
        threadId,
        threadType: ThreadType.User,
        displayName: `🌐 Web: ${senderName}`,
        lastSenderName: senderName,
      });

      log.info({ sessionId, replyLength: replyText.length, files: capturedFiles.length, steps: trace.length }, "Hoàn tất lượt chat Web VBAI");

      return c.json({
        ok: true,
        reply: replyText,
        files: capturedFiles,
        sessionId,
        steps: trace.length,
      });
    } catch (err) {
      trongGiaoDich(() => {
        finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: trace.length }, Date.now() - startMs);
        if (trace.length > 0) saveTurnTrace(turnId, trace);
      });
      log.error({ err, sessionId }, "Lỗi khi xử lý tin nhắn từ WebChat");
      return c.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : "Đã xảy ra lỗi khi trợ lý AI xử lý câu hỏi",
        },
        500,
      );
    }
  });
