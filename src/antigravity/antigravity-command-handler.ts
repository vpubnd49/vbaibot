import type { API } from "zca-js";
import type { AccountConfig } from "../config/account-store.js";
import type { ParsedMessage } from "../zalo/zalo-message-parser.js";
import type { ReplyTarget } from "../zalo/send-reply-in-parts.js";
import { deliverChatReply } from "../zalo/deliver-chat-reply.js";
import { finishAgentTurn } from "../conversation/usage-store.js";
import { antigravityBridge } from "./antigravity-bridge.js";
import { createLogger } from "../shared/logger.js";

const log = createLogger("antigravity-command-handler");

export async function handleAntigravityCommand(params: {
  api?: API;
  config: AccountConfig;
  latest: ParsedMessage;
  text: string;
  replyTarget: ReplyTarget;
  turnId: number;
  turnStartMs: number;
  writeBatchToHistory: () => void;
}): Promise<{ handled: boolean }> {
  const { config, latest, text, replyTarget, turnId, turnStartMs, writeBatchToHistory } = params;

  const isCmd = text.startsWith("/cmd");
  const isAgy = text.startsWith("/agy");
  if (!isCmd && !isAgy) {
    return { handled: false };
  }

  // 1. Kiểm tra quyền Admin
  const senderId = latest.senderId;
  const isAdmin = antigravityBridge.isAuthorizedAdmin(senderId);
  if (!isAdmin) {
    log.warn({ senderId, senderName: latest.senderName, text }, "Từ chối lệnh Antigravity từ người không có quyền");
    const rejectMsg = "⛔ **Quyền truy cập bị từ chối**: Bạn không nằm trong danh sách Quản trị viên được phép thực thi lệnh Antigravity.";
    await deliverChatReply(replyTarget, config.id, latest.threadId, rejectMsg);
    writeBatchToHistory();
    finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
    return { handled: true };
  }

  // 2. Xử lý lệnh kiểm tra trạng thái
  if (text === "/agy status" || text === "/cmd status" || text === "/agy" || text === "/cmd") {
    const isOnline = antigravityBridge.isLocalPcOnline();
    const info = antigravityBridge.getLocalPcInfo();
    const statusMsg = [
      "🚀 **TRẠNG THÁI CẦU NỐI ANTIGRAVITY (HYBRID)**",
      "──────────────────────────",
      `🖥️ **Máy tính cá nhân (Windows):** ${isOnline ? "🟢 ONLINE (Đang kết nối)" : "🔴 OFFLINE"}`,
      isOnline && info
        ? `   • Thiết bị: \`${info.hostname}\` (${info.os})\n   • Thư mục: \`${info.cwd}\``
        : "   • *Máy tính đang tắt hoặc chưa chạy `npm run relay`*",
      `☁️ **Máy chủ VPS (103.142.25.252):** 🟢 ONLINE`,
      `   • Thư mục: \`${process.cwd()}\``,
      `   • Uptime: ${Math.floor(process.uptime() / 60)} phút`,
      "──────────────────────────",
      "⚡ **Cơ chế điều phối:** Ưu tiên Máy tính cá nhân -> Tự động Fallback sang VPS khi PC offline.",
      "",
      "📖 **Cú pháp sử dụng:**",
      "• `/cmd <lệnh shell>`: Chạy lệnh terminal (VD: `/cmd git status`, `/cmd pm2 status`, `/cmd df -h`)",
      "• `/agy <yêu cầu>`: Giao việc cho Agent Antigravity",
      "• `/agy status`: Xem lại trạng thái kết nối này",
    ].join("\n");

    await deliverChatReply(replyTarget, config.id, latest.threadId, statusMsg);
    writeBatchToHistory();
    finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
    return { handled: true };
  }

  // 3. Xử lý lệnh chạy terminal shell (/cmd <command>)
  if (isCmd) {
    const cmdString = text.replace(/^\/cmd\s+/, "").trim();
    if (!cmdString) {
      await deliverChatReply(replyTarget, config.id, latest.threadId, "⚠️ Vui lòng nhập lệnh sau `/cmd`. Ví dụ: `/cmd git status`");
      writeBatchToHistory();
      finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
      return { handled: true };
    }

    log.info({ senderId, cmd: cmdString }, "Thực thi lệnh shell Antigravity");
    const result = await antigravityBridge.dispatch({
      type: "cmd",
      command: cmdString,
    });

    const sourceName = result.source === "pc" ? "🖥️ Máy tính cá nhân (Windows)" : "☁️ VPS Server (103.142.25.252)";
    const icon = result.success ? "✅" : "❌";
    const replyText = [
      `${icon} **KẾT QUẢ THỰC THI** [${sourceName}]`,
      `⏱️ Thời gian: ${result.durationMs}ms | Exit: ${result.exitCode ?? 0}`,
      `💻 Lệnh: \`${cmdString}\``,
      "```shell",
      result.output,
      "```",
    ].join("\n");

    await deliverChatReply(replyTarget, config.id, latest.threadId, replyText);
    writeBatchToHistory();
    finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
    return { handled: true };
  }

  // 4. Xử lý lệnh giao việc cho Agent (/agy <prompt>)
  if (isAgy) {
    const promptString = text.replace(/^\/agy\s+/, "").trim();
    if (!promptString) {
      await deliverChatReply(replyTarget, config.id, latest.threadId, "⚠️ Vui lòng nhập yêu cầu sau `/agy`. Ví dụ: `/agy kiểm tra git diff`");
      writeBatchToHistory();
      finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
      return { handled: true };
    }

    log.info({ senderId, prompt: promptString }, "Giao việc cho Antigravity Agent");
    const result = await antigravityBridge.dispatch({
      type: "agy",
      prompt: promptString,
    });

    const sourceName = result.source === "pc" ? "🖥️ Máy tính cá nhân (Windows)" : "☁️ VPS Server (103.142.25.252)";
    const replyText = [
      `🤖 **ANTIGRAVITY AGENT** [${sourceName}]`,
      `⏱️ Thời gian: ${result.durationMs}ms`,
      result.output,
    ].join("\n");

    await deliverChatReply(replyTarget, config.id, latest.threadId, replyText);
    writeBatchToHistory();
    finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
    return { handled: true };
  }

  return { handled: false };
}
