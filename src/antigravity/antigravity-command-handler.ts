import type { API } from "zca-js";
import type { AccountConfig } from "../config/account-store.js";
import type { ParsedMessage } from "../zalo/zalo-message-parser.js";
import type { ReplyTarget } from "../zalo/send-reply-in-parts.js";
import { deliverChatReply } from "../zalo/deliver-chat-reply.js";
import { finishAgentTurn } from "../conversation/usage-store.js";
import { antigravityBridge, type WorkspaceTarget } from "./antigravity-bridge.js";
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
  const isVbai = text.startsWith("/vbai");
  const isTarget = text.startsWith("/target");
  if (!isCmd && !isAgy && !isVbai && !isTarget) {
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

  const threadId = latest.threadId;
  const currentTarget = antigravityBridge.getActiveTarget(threadId);

  // 2. Xử lý lệnh chọn Workspace đích (/target)
  if (isTarget) {
    const targetArg = text.replace(/^\/target\s*/, "").trim().toLowerCase();
    if (targetArg === "vbai" || targetArg === "legal") {
      antigravityBridge.setActiveTarget(threadId, "vbai");
      const msg = [
        "🎯 **ĐÃ CHUYỂN WORKSPACE ĐÍCH SANG: VBAI (Legal Pro)**",
        "──────────────────────────",
        "• **Website:** https://vbai.tracuu.lamdong.vn",
        "• **Thư mục PC:** `E:\\OneDrive\\HSCV\\Antigravity\\VBAI`",
        "• **Thư mục VPS:** `/var/www/vbai`",
        "",
        "💡 *Từ bây giờ các lệnh `/cmd <lệnh>` và `/agy <yêu cầu>` sẽ tự động thực thi trong source code **VBAI**.*",
        "*(Để chuyển lại bot, gõ: `/target bot`)*",
      ].join("\n");
      await deliverChatReply(replyTarget, config.id, threadId, msg);
      writeBatchToHistory();
      finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
      return { handled: true };
    }

    if (targetArg === "bot" || targetArg === "vbaibot") {
      antigravityBridge.setActiveTarget(threadId, "bot");
      const msg = [
        "🎯 **ĐÃ CHUYỂN WORKSPACE ĐÍCH SANG: VBAIBOT (Zalo Bot & Dashboard)**",
        "──────────────────────────",
        "• **Website:** https://vbaibot.chauphienbanso.com",
        "• **Thư mục PC:** `E:\\OneDrive\\HSCV\\Antigravity\\vbaibot`",
        "• **Thư mục VPS:** `/var/www/vbaibot`",
        "",
        "💡 *Từ bây giờ các lệnh `/cmd <lệnh>` và `/agy <yêu cầu>` sẽ thực thi trong source code **vbaibot**.*",
        "*(Để chuyển sang VBAI, gõ: `/target vbai`)*",
      ].join("\n");
      await deliverChatReply(replyTarget, config.id, threadId, msg);
      writeBatchToHistory();
      finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
      return { handled: true };
    }

    // Hiển thị trạng thái target hiện tại
    const targetName = currentTarget === "vbai" ? "⚖️ VBAI (Legal Pro)" : "🤖 VBAIBot (Zalo Bot)";
    const msg = [
      `🎯 **WORKSPACE ĐANG CHỌN:** ${targetName}`,
      "──────────────────────────",
      "• Chuyển sang VBAI: `/target vbai`",
      "• Chuyển sang VBAIBot: `/target bot`",
      "",
      "📌 *Mẹo: Anh có thể gõ trực tiếp `/vbai <lệnh>` bất cứ lúc nào mà không cần đổi target!*",
    ].join("\n");
    await deliverChatReply(replyTarget, config.id, threadId, msg);
    writeBatchToHistory();
    finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
    return { handled: true };
  }

  // 3. Xử lý lệnh trạng thái chung (/agy status, /cmd status)
  if (text === "/agy status" || text === "/cmd status" || text === "/agy" || text === "/cmd") {
    const isOnline = antigravityBridge.isLocalPcOnline();
    const info = antigravityBridge.getLocalPcInfo();
    const statusMsg = [
      "🚀 **TRẠNG THÁI CẦU NỐI ANTIGRAVITY (HYBRID MULTI-WORKSPACE)**",
      "──────────────────────────",
      `🖥️ **Máy tính cá nhân (Windows):** ${isOnline ? "🟢 ONLINE (Đang kết nối)" : "🔴 OFFLINE"}`,
      isOnline && info
        ? `   • Thiết bị: \`${info.hostname}\` (${info.os})\n   • Workspace VBAI: \`E:\\OneDrive\\HSCV\\Antigravity\\VBAI\`\n   • Workspace Bot: \`E:\\OneDrive\\HSCV\\Antigravity\\vbaibot\``
        : "   • *Máy tính đang tắt hoặc chưa chạy `npm run relay`*",
      `☁️ **Máy chủ VPS (103.142.25.252):** 🟢 ONLINE`,
      `   • Workspace VBAI: \`/var/www/vbai\` (vbai-proxy, vbai-whisper)`,
      `   • Workspace Bot: \`/var/www/vbaibot\` (vbaibot)`,
      `   • Uptime: ${Math.floor(process.uptime() / 60)} phút`,
      "──────────────────────────",
      `🎯 **Workspace hiện tại:** ${currentTarget === "vbai" ? "⚖️ VBAI (Legal Pro)" : "🤖 VBAIBot"}`,
      "",
      "📖 **Cú pháp điều khiển:**",
      "• `/vbai <lệnh>`: Thực thi lệnh trong source VBAI (VD: `/vbai git status`, `/vbai restart`, `/vbai logs`)",
      "• `/vbai agy <yêu cầu>`: Giao việc cho Agent trong source VBAI",
      "• `/cmd <lệnh>`: Chạy lệnh theo workspace hiện tại",
      "• `/target vbai` hoặc `/target bot`: Đổi workspace mặc định",
    ].join("\n");

    await deliverChatReply(replyTarget, config.id, threadId, statusMsg);
    writeBatchToHistory();
    finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
    return { handled: true };
  }

  // 4. Xử lý chuyên biệt cho nhóm lệnh /vbai
  if (isVbai) {
    const vbaiSubCmd = text.replace(/^\/vbai\s*/, "").trim();

    // 4.1. Xem trạng thái VBAI (/vbai hoặc /vbai status)
    if (!vbaiSubCmd || vbaiSubCmd === "status") {
      log.info({ senderId }, "Kiểm tra trạng thái VBAI");
      const result = await antigravityBridge.dispatch({
        type: "cmd",
        command: "pm2 status vbai-proxy vbai-whisper",
        target: "vbai",
        forceVps: true, // PM2 chạy trên VPS
      });

      const replyText = [
        "⚖️ **TRẠNG THÁI HỆ THỐNG VBAI (https://vbai.tracuu.lamdong.vn)**",
        "──────────────────────────",
        "📂 **Source PC:** `E:\\OneDrive\\HSCV\\Antigravity\\VBAI`",
        "📂 **Source VPS:** `/var/www/vbai`",
        "```shell",
        result.output,
        "```",
        "──────────────────────────",
        "💡 **Các lệnh nhanh cho VBAI:**",
        "• `/vbai restart`: Khởi động lại vbai-proxy & vbai-whisper",
        "• `/vbai logs`: Xem 25 dòng nhật ký mới nhất của vbai-proxy",
        "• `/vbai git status`: Kiểm tra thay đổi mã nguồn VBAI",
        "• `/vbai <lệnh bất kỳ>`: Chạy lệnh trong thư mục VBAI",
        "• `/vbai agy <prompt>`: Giao việc cho Agent trong VBAI",
      ].join("\n");

      await deliverChatReply(replyTarget, config.id, threadId, replyText);
      writeBatchToHistory();
      finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
      return { handled: true };
    }

    // 4.2. Khởi động lại VBAI (/vbai restart)
    if (vbaiSubCmd === "restart") {
      log.info({ senderId }, "Khởi động lại dịch vụ VBAI trên VPS");
      const result = await antigravityBridge.dispatch({
        type: "cmd",
        command: "pm2 restart vbai-proxy vbai-whisper",
        target: "vbai",
        forceVps: true,
      });

      const replyText = [
        "🔄 **KẾT QUẢ KHỞI ĐỘNG LẠI DỊCH VỤ VBAI**",
        "```shell",
        result.output,
        "```",
      ].join("\n");

      await deliverChatReply(replyTarget, config.id, threadId, replyText);
      writeBatchToHistory();
      finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
      return { handled: true };
    }

    // 4.3. Xem logs VBAI (/vbai logs)
    if (vbaiSubCmd === "logs" || vbaiSubCmd.startsWith("logs ")) {
      const lines = vbaiSubCmd.split(" ")[1] || "30";
      log.info({ senderId, lines }, "Xem logs VBAI trên VPS");
      const result = await antigravityBridge.dispatch({
        type: "cmd",
        command: `pm2 logs vbai-proxy --lines ${lines} --nostream`,
        target: "vbai",
        forceVps: true,
      });

      const replyText = [
        `📋 **NHẬT KÝ VBAI PROXY (${lines} dòng gần nhất)**`,
        "```shell",
        result.output,
        "```",
      ].join("\n");

      await deliverChatReply(replyTarget, config.id, threadId, replyText);
      writeBatchToHistory();
      finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
      return { handled: true };
    }

    // 4.4. Giao việc cho Agent trong source VBAI (/vbai agy <prompt>)
    if (vbaiSubCmd.startsWith("agy ") || vbaiSubCmd === "agy") {
      const prompt = vbaiSubCmd.replace(/^agy\s*/, "").trim();
      if (!prompt) {
        await deliverChatReply(replyTarget, config.id, threadId, "⚠️ Vui lòng nhập yêu cầu sau `/vbai agy`. Ví dụ: `/vbai agy kiểm tra lỗi build webapp`");
        writeBatchToHistory();
        finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
        return { handled: true };
      }

      log.info({ senderId, prompt }, "Giao việc cho Antigravity Agent trong VBAI");
      const result = await antigravityBridge.dispatch({
        type: "agy",
        prompt,
        target: "vbai",
      });

      const sourceName = result.source === "pc" ? "🖥️ Máy tính cá nhân (Windows)" : "☁️ VPS Server (103.142.25.252)";
      const replyText = [
        `🤖 **ANTIGRAVITY AGENT [VBAI]** [${sourceName}]`,
        `⏱️ Thời gian: ${result.durationMs}ms`,
        `📂 Thư mục: \`${result.executedCwd || ""}\``,
        result.output,
      ].join("\n");

      await deliverChatReply(replyTarget, config.id, threadId, replyText);
      writeBatchToHistory();
      finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
      return { handled: true };
    }

    // 4.5. Thực thi lệnh terminal bất kỳ trong thư mục VBAI (/vbai <lệnh>)
    log.info({ senderId, cmd: vbaiSubCmd }, "Thực thi lệnh shell trong workspace VBAI");
    const result = await antigravityBridge.dispatch({
      type: "cmd",
      command: vbaiSubCmd,
      target: "vbai",
    });

    const sourceName = result.source === "pc" ? "🖥️ Máy tính cá nhân (Windows)" : "☁️ VPS Server (103.142.25.252)";
    const icon = result.success ? "✅" : "❌";
    const replyText = [
      `${icon} **KẾT QUẢ THỰC THI [VBAI]** [${sourceName}]`,
      `⏱️ Thời gian: ${result.durationMs}ms | Exit: ${result.exitCode ?? 0}`,
      `📂 Thư mục: \`${result.executedCwd || ""}\``,
      `💻 Lệnh: \`${vbaiSubCmd}\``,
      "```shell",
      result.output,
      "```",
    ].join("\n");

    await deliverChatReply(replyTarget, config.id, threadId, replyText);
    writeBatchToHistory();
    finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
    return { handled: true };
  }

  // 5. Xử lý lệnh chạy terminal shell (/cmd <command>)
  if (isCmd) {
    let cmdString = text.replace(/^\/cmd\s+/, "").trim();
    let targetWorkspace: WorkspaceTarget = currentTarget;

    // Cho phép cờ nhanh: /cmd -vbai <lệnh> hoặc /cmd -bot <lệnh>
    if (cmdString.startsWith("-vbai ") || cmdString === "-vbai") {
      targetWorkspace = "vbai";
      cmdString = cmdString.replace(/^-vbai\s*/, "").trim();
    } else if (cmdString.startsWith("-bot ") || cmdString === "-bot") {
      targetWorkspace = "bot";
      cmdString = cmdString.replace(/^-bot\s*/, "").trim();
    }

    if (!cmdString) {
      await deliverChatReply(replyTarget, config.id, threadId, "⚠️ Vui lòng nhập lệnh sau `/cmd`. Ví dụ: `/cmd git status` hoặc `/vbai git status`");
      writeBatchToHistory();
      finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
      return { handled: true };
    }

    log.info({ senderId, cmd: cmdString, target: targetWorkspace }, "Thực thi lệnh shell Antigravity");
    const result = await antigravityBridge.dispatch({
      type: "cmd",
      command: cmdString,
      target: targetWorkspace,
    });

    const sourceName = result.source === "pc" ? "🖥️ Máy tính cá nhân (Windows)" : "☁️ VPS Server (103.142.25.252)";
    const targetTag = targetWorkspace === "vbai" ? "[VBAI]" : "[BOT]";
    const icon = result.success ? "✅" : "❌";
    const replyText = [
      `${icon} **KẾT QUẢ THỰC THI ${targetTag}** [${sourceName}]`,
      `⏱️ Thời gian: ${result.durationMs}ms | Exit: ${result.exitCode ?? 0}`,
      `📂 Thư mục: \`${result.executedCwd || ""}\``,
      `💻 Lệnh: \`${cmdString}\``,
      "```shell",
      result.output,
      "```",
    ].join("\n");

    await deliverChatReply(replyTarget, config.id, threadId, replyText);
    writeBatchToHistory();
    finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
    return { handled: true };
  }

  // 6. Xử lý lệnh giao việc cho Agent (/agy <prompt>)
  if (isAgy) {
    let promptString = text.replace(/^\/agy\s+/, "").trim();
    let targetWorkspace: WorkspaceTarget = currentTarget;

    if (promptString.startsWith("-vbai ") || promptString === "-vbai") {
      targetWorkspace = "vbai";
      promptString = promptString.replace(/^-vbai\s*/, "").trim();
    } else if (promptString.startsWith("-bot ") || promptString === "-bot") {
      targetWorkspace = "bot";
      promptString = promptString.replace(/^-bot\s*/, "").trim();
    }

    if (!promptString) {
      await deliverChatReply(replyTarget, config.id, threadId, "⚠️ Vui lòng nhập yêu cầu sau `/agy`. Ví dụ: `/agy kiểm tra git diff` hoặc `/vbai agy kiểm tra mã nguồn`");
      writeBatchToHistory();
      finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
      return { handled: true };
    }

    log.info({ senderId, prompt: promptString, target: targetWorkspace }, "Giao việc cho Antigravity Agent");
    const result = await antigravityBridge.dispatch({
      type: "agy",
      prompt: promptString,
      target: targetWorkspace,
    });

    const sourceName = result.source === "pc" ? "🖥️ Máy tính cá nhân (Windows)" : "☁️ VPS Server (103.142.25.252)";
    const targetTag = targetWorkspace === "vbai" ? "[VBAI]" : "[BOT]";
    const replyText = [
      `🤖 **ANTIGRAVITY AGENT ${targetTag}** [${sourceName}]`,
      `⏱️ Thời gian: ${result.durationMs}ms`,
      `📂 Thư mục: \`${result.executedCwd || ""}\``,
      result.output,
    ].join("\n");

    await deliverChatReply(replyTarget, config.id, threadId, replyText);
    writeBatchToHistory();
    finishAgentTurn(turnId, { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 1 }, Date.now() - turnStartMs);
    return { handled: true };
  }

  return { handled: false };
}

