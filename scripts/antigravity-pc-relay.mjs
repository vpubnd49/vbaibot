#!/usr/bin/env node

/**
 * Antigravity Local PC Relay Client
 *
 * Chạy trên máy tính cá nhân (Windows) để nhận lệnh điều khiển từ xa từ Zalo bot.
 * Kết nối qua HTTP Long-Polling lên VPS (không cần mở port, không cần IP tĩnh).
 *
 * Cách chạy:
 *   node scripts/antigravity-pc-relay.mjs
 * hoặc:
 *   npm run relay
 */

import { exec } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

// Cấu hình kết nối
const VPS_BASE_URL = process.env.VBAI_RELAY_URL || "http://103.142.25.252:3900";
const RELAY_KEY = process.env.ANTIGRAVITY_RELAY_KEY || "vbai-antigravity-relay-2026-secret";
const CWD = process.cwd();

console.log("=============================================================");
console.log("🚀 ANTIGRAVITY LOCAL PC RELAY CLIENT");
console.log("=============================================================");
console.log(`🖥️  Thiết bị:   ${os.hostname()} (${os.platform()} ${os.arch()})`);
console.log(`📂  Thư mục:   ${CWD}`);
console.log(`🌐  Kết nối:   ${VPS_BASE_URL}`);
console.log("=============================================================\n");

const clientInfo = {
  os: `${os.platform()} ${os.release()}`,
  hostname: os.hostname(),
  cwd: CWD,
  nodeVersion: process.version,
};

let isRunning = true;
process.on("SIGINT", () => {
  console.log("\n🛑 Đang dừng Antigravity Relay Client...");
  isRunning = false;
  process.exit(0);
});

async function runCommand(cmd) {
  const start = Date.now();
  console.log(`\n💻 [EXEC] ${cmd}`);
  return new Promise((resolve) => {
    exec(
      cmd,
      {
        cwd: CWD,
        timeout: 120_000,
        maxBuffer: 1024 * 1024 * 10, // 10MB
        shell: os.platform() === "win32" ? "powershell.exe" : "/bin/bash",
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - start;
        const out = (stdout || stderr || "").trim();
        const success = !error;
        const exitCode = error ? (error.code ?? 1) : 0;
        console.log(`⏱️  Hoàn tất sau ${durationMs}ms | Exit: ${exitCode}`);
        resolve({
          success,
          output: out || (success ? "(Lệnh thực thi thành công không có output)" : "(Lỗi thực thi)"),
          exitCode,
          durationMs,
          error: error ? error.message : undefined,
        });
      },
    );
  });
}

async function sendResult(taskId, result) {
  try {
    const res = await fetch(`${VPS_BASE_URL}/api/antigravity/result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-relay-key": RELAY_KEY,
      },
      body: JSON.stringify({
        taskId,
        ...result,
      }),
    });
    if (!res.ok) {
      console.error(`❌ Lỗi gửi kết quả về VPS: HTTP ${res.status}`);
    } else {
      console.log(`✅ Đã gửi kết quả task [${taskId}] về Zalo bot`);
    }
  } catch (err) {
    console.error("❌ Lỗi mạng khi gửi kết quả về VPS:", err.message);
  }
}

async function pollLoop() {
  console.log("🟢 Đã kết nối với VPS. Đang lắng nghe lệnh từ Zalo bot...");

  while (isRunning) {
    try {
      const res = await fetch(`${VPS_BASE_URL}/api/antigravity/poll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-relay-key": RELAY_KEY,
        },
        body: JSON.stringify({
          clientInfo,
          waitMs: 20_000,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`⚠️ Server trả về HTTP ${res.status}: ${text}`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      const data = await res.json();
      if (data.empty || !data.task) {
        // Heartbeat bình thường, tiếp tục vòng lặp
        continue;
      }

      const task = data.task;
      console.log(`\n📥 Nhận task mới [${task.id}] (loại: ${task.type})`);

      if (task.type === "cmd") {
        const result = await runCommand(task.command);
        await sendResult(task.id, result);
      } else {
        // Task prompt
        const promptOut = `[Local PC Antigravity Runner]\nĐã nhận: "${task.prompt}" trên ${CWD}`;
        await sendResult(task.id, {
          success: true,
          output: promptOut,
          durationMs: 50,
        });
      }
    } catch (err) {
      console.error("⚠️ Mất kết nối tới VPS, thử kết nối lại sau 5s:", err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

pollLoop().catch((err) => {
  console.error("💥 Lỗi ngoài vòng lặp:", err);
});
