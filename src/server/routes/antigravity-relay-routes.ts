import { Hono } from "hono";
import { antigravityBridge, type LocalPcClientInfo } from "../../antigravity/antigravity-bridge.js";

export const antigravityRelayRoutes = new Hono();

/**
 * Endpoint cho Local PC polling nhận nhiệm vụ (Long-Polling tối đa 25s)
 */
antigravityRelayRoutes.post("/poll", async (c) => {
  const relayKey = c.req.header("x-relay-key") || "";
  let body: { clientInfo?: LocalPcClientInfo; waitMs?: number } = {};
  try {
    body = await c.req.json();
  } catch {
    // Không có body json
  }

  const clientInfo: LocalPcClientInfo = body.clientInfo ?? {
    os: "unknown",
    hostname: "client",
    cwd: "",
    ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown",
  };

  try {
    const task = await antigravityBridge.handleClientPoll(clientInfo, relayKey, body.waitMs ?? 20_000);
    if (!task) {
      return c.json({ empty: true });
    }
    return c.json({ empty: false, task });
  } catch (err: any) {
    return c.json({ error: err.message || "Lỗi xác thực" }, 401);
  }
});

/**
 * Endpoint cho Local PC nộp kết quả thực thi task về cho VPS
 */
antigravityRelayRoutes.post("/result", async (c) => {
  const relayKey = c.req.header("x-relay-key") || "";
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Yêu cầu body JSON" }, 400);
  }

  const { taskId, success, output, exitCode, durationMs, error } = body;
  if (!taskId) {
    return c.json({ error: "Thiếu taskId" }, 400);
  }

  try {
    const ok = antigravityBridge.handleClientResult(
      {
        taskId,
        success: Boolean(success),
        output: String(output ?? ""),
        exitCode: typeof exitCode === "number" ? exitCode : 0,
        durationMs: typeof durationMs === "number" ? durationMs : 0,
        error: error ? String(error) : undefined,
      },
      relayKey,
    );
    return c.json({ ok });
  } catch (err: any) {
    return c.json({ error: err.message || "Lỗi xác thực" }, 401);
  }
});

/**
 * Endpoint kiểm tra trạng thái hoạt động của cầu nối Antigravity
 */
antigravityRelayRoutes.get("/status", (c) => {
  const isOnline = antigravityBridge.isLocalPcOnline();
  const pcInfo = antigravityBridge.getLocalPcInfo();
  const lastSeen = antigravityBridge.getLastSeen();

  return c.json({
    vps: {
      online: true,
      botCwd: process.cwd(),
      vbaiCwd: antigravityBridge.resolveVpsCwd("vbai"),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    localPc: {
      online: isOnline,
      lastSeenMsAgo: lastSeen > 0 ? Date.now() - lastSeen : null,
      info: pcInfo,
    },
    hybridMode: "Local PC First -> Fallback VPS (Multi-workspace: VBAIBot + VBAI)",
  });
});

/**
 * Endpoint điều phối thực thi nhiệm vụ (Hỗ trợ gọi trực tiếp với x-relay-key)
 */
antigravityRelayRoutes.post("/dispatch", async (c) => {
  const relayKey = c.req.header("x-relay-key") || "";
  if (!antigravityBridge.verifyRelayKey(relayKey)) {
    return c.json({ error: "Mã xác thực relay key không hợp lệ" }, 401);
  }

  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Yêu cầu body JSON" }, 400);
  }

  const { type = "cmd", command, prompt, target, subDir, forceVps } = body;
  try {
    const result = await antigravityBridge.dispatch({
      type: type === "agy" ? "agy" : "cmd",
      command,
      prompt,
      target: target === "vbai" ? "vbai" : "bot",
      subDir,
      forceVps: Boolean(forceVps),
    });
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message || "Lỗi thực thi" }, 500);
  }
});


