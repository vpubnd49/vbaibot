import type { IncomingMessage, Server } from "node:http";
import net from "node:net";
import type { Duplex } from "node:stream";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { createLogger } from "../shared/logger.js";
import { verifySessionToken } from "./dashboard-auth.js";

/**
 * Mở màn hình Chrome của máy chủ NotebookLM (noVNC, 127.0.0.1:6080) NGAY
 * TRONG dashboard, sau lớp đăng nhập dashboard - Admin đăng nhập Google mà
 * không cần Tailscale hay SSH.
 *
 * Hai phần: file tĩnh của noVNC đi qua Hono (`/novnc/*`), còn kết nối
 * WebSocket `/novnc/websockify` bắt ở sự kiện `upgrade` của http server rồi
 * nối thẳng TCP tới websockify. Cả hai đều đòi cookie phiên dashboard hợp lệ:
 * ai vào được màn hình này là điều khiển được tài khoản Google của bot.
 */

const log = createLogger("novnc-proxy");
const NOVNC_HOST = "127.0.0.1";
const NOVNC_PORT = 6080;
const SESSION_COOKIE = "dashboard_session";
const WS_PATH = "/novnc/websockify";

export const novncHttpRoutes = new Hono().all("/*", async (c) => {
  if (!verifySessionToken(getCookie(c, SESSION_COOKIE))) {
    return c.text("Chưa đăng nhập dashboard", 401);
  }
  const url = new URL(c.req.url);
  const rest = url.pathname.replace(/^\/novnc/, "") || "/vnc.html";
  try {
    const upstream = await fetch(`http://${NOVNC_HOST}:${NOVNC_PORT}${rest}${url.search}`, {
      signal: AbortSignal.timeout(15_000),
    });
    const headers = new Headers();
    const type = upstream.headers.get("content-type");
    if (type) headers.set("content-type", type);
    headers.set("cache-control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return c.text("Máy chủ Gemini Notebook / NotebookLM (noVNC) đang tắt", 502);
  }
});

function readCookie(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** Chặn trang web lạ mở WebSocket bằng cookie của Admin (CSWSH) */
function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  if (!host) return false;
  if (!origin) return true; // một số trình duyệt/proxy nội bộ không đính kèm Origin khi cùng host
  try {
    const originUrl = new URL(origin);
    const targetHost = String(host).split(",")[0]!.trim();
    return originUrl.host === targetHost || originUrl.hostname === targetHost.split(":")[0];
  } catch {
    return false;
  }
}

function reject(socket: Duplex, code: number, text: string): void {
  socket.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

export function attachNovncUpgrade(server: Server): void {
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!req.url?.startsWith(WS_PATH)) return; // không phải của mình - để yên
    if (!verifySessionToken(readCookie(req, SESSION_COOKIE)) || !sameOrigin(req)) {
      log.warn({ origin: req.headers.origin, host: req.headers.host }, "Từ chối kết nối noVNC WebSocket (cookie/origin)");
      reject(socket, 401, "Unauthorized");
      return;
    }

    const upstream = net.connect(NOVNC_PORT, NOVNC_HOST, () => {
      const lines = [`GET /websockify HTTP/1.1`, `Host: ${NOVNC_HOST}:${NOVNC_PORT}`];
      for (const [k, v] of Object.entries(req.headers)) {
        if (["host", "cookie", "origin"].includes(k.toLowerCase()) || v === undefined) continue;
        lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
      }
      upstream.write(lines.join("\r\n") + "\r\n\r\n");
      if (head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });

    const close = () => {
      upstream.destroy();
      socket.destroy();
    };
    upstream.on("error", (err) => {
      log.warn({ err: err.message }, "noVNC upstream lỗi");
      reject(socket, 502, "Bad Gateway");
      close();
    });
    socket.on("error", close);
    socket.on("close", () => upstream.destroy());
  });
}
