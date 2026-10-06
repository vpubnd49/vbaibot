import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import fs from "node:fs/promises";
import { createLogger } from "../shared/logger.js";

const execAsync = promisify(exec);
const log = createLogger("vps-monitor");

export interface VpsServiceStatus {
  name: string;
  type: "pm2" | "docker" | "systemd";
  status: "online" | "stopped" | "errored" | "unknown";
  pid?: number;
  cpu?: number;
  memoryBytes?: number;
  uptime?: number;
  restarts?: number;
  extra?: string;
}

export interface VpsProcessItem {
  pid: number;
  name: string;
  cpuPercent: number;
  memPercent: number;
}

export interface VpsMetrics {
  timestamp: number;
  system: {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    uptimeSeconds: number;
    uptimeFormatted: string;
    serverTime: string;
  };
  cpu: {
    model: string;
    cores: number;
    usagePercent: number;
    loadAvg: [number, number, number];
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    availableBytes: number;
    buffersCachedBytes: number;
    usagePercent: number;
    swapTotalBytes: number;
    swapUsedBytes: number;
    swapUsagePercent: number;
  };
  disk: {
    filesystem: string;
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
    mountPoint: string;
  };
  services: VpsServiceStatus[];
  topProcesses: VpsProcessItem[];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d} ngày`);
  if (h > 0 || d > 0) parts.push(`${h} giờ`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m} phút`);
  parts.push(`${s} giây`);
  return parts.join(" ");
}

/**
 * Đọc /proc/meminfo để lấy số liệu RAM chính xác trên Linux (bao gồm Available & Buffers/Cache)
 */
async function getLinuxMemInfo() {
  try {
    const raw = await fs.readFile("/proc/meminfo", "utf8");
    const lines = raw.split("\n");
    const map: Record<string, number> = {};
    for (const line of lines) {
      const parts = line.split(":");
      if (parts.length === 2) {
        const key = parts[0]?.trim();
        const valStr = parts[1]?.trim().split(/\s+/)[0];
        if (key && valStr) {
          map[key] = parseInt(valStr, 10) * 1024; // KB to Bytes
        }
      }
    }

    const total = map["MemTotal"] || os.totalmem();
    const available = map["MemAvailable"] || os.freemem();
    const free = map["MemFree"] || os.freemem();
    const buffers = map["Buffers"] || 0;
    const cached = map["Cached"] || 0;
    const swapTotal = map["SwapTotal"] || 0;
    const swapFree = map["SwapFree"] || 0;
    const used = total - available;

    return {
      totalBytes: total,
      usedBytes: used,
      freeBytes: free,
      availableBytes: available,
      buffersCachedBytes: buffers + cached,
      usagePercent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
      swapTotalBytes: swapTotal,
      swapUsedBytes: swapTotal - swapFree,
      swapUsagePercent: swapTotal > 0 ? Math.round(((swapTotal - swapFree) / swapTotal) * 1000) / 10 : 0,
    };
  } catch {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return {
      totalBytes: total,
      usedBytes: used,
      freeBytes: free,
      availableBytes: free,
      buffersCachedBytes: 0,
      usagePercent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
      swapTotalBytes: 0,
      swapUsedBytes: 0,
      swapUsagePercent: 0,
    };
  }
}

/**
 * Đo CPU usage %
 */
let lastCpuMeasure = { idle: 0, total: 0, time: 0, percent: 0 };
function getCpuUsage(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += (cpu.times as Record<string, number>)[type] || 0;
    }
    idle += cpu.times.idle;
  }

  const now = Date.now();
  if (lastCpuMeasure.time > 0 && now - lastCpuMeasure.time < 30000) {
    const idleDiff = idle - lastCpuMeasure.idle;
    const totalDiff = total - lastCpuMeasure.total;
    if (totalDiff > 0) {
      const usage = Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 1000) / 10));
      lastCpuMeasure = { idle, total, time: now, percent: usage };
      return usage;
    }
  }

  lastCpuMeasure = { idle, total, time: now, percent: lastCpuMeasure.percent };
  // Fallback từ loadavg
  const load = os.loadavg()[0] || 0;
  return Math.min(100, Math.round((load / Math.max(1, cpus.length)) * 1000) / 10);
}

/**
 * Đọc thông tin đĩa `/`
 */
async function getDiskUsage() {
  try {
    const { stdout } = await execAsync("df -k / | tail -n 1");
    const parts = stdout.trim().split(/\s+/);
    if (parts.length >= 6) {
      const filesystem = parts[0] || "/dev/root";
      const total = parseInt(parts[1] || "0", 10) * 1024;
      const used = parseInt(parts[2] || "0", 10) * 1024;
      const avail = parseInt(parts[3] || "0", 10) * 1024;
      const mount = parts[5] || "/";
      const pct = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
      return {
        filesystem,
        totalBytes: total,
        usedBytes: used,
        availableBytes: avail,
        usagePercent: pct,
        mountPoint: mount,
      };
    }
  } catch {
    // ignore
  }
  return {
    filesystem: "/",
    totalBytes: 30 * 1024 * 1024 * 1024,
    usedBytes: 15 * 1024 * 1024 * 1024,
    availableBytes: 15 * 1024 * 1024 * 1024,
    usagePercent: 50,
    mountPoint: "/",
  };
}

/**
 * Lấy trạng thái PM2 & Docker & Caddy
 */
async function getServices(): Promise<VpsServiceStatus[]> {
  const services: VpsServiceStatus[] = [];

  // 1. PM2 processes
  try {
    const { stdout } = await execAsync("pm2 jlist");
    const list = JSON.parse(stdout) as Array<{
      name: string;
      pid?: number;
      pm_id?: number;
      monit?: { memory?: number; cpu?: number };
      pm2_env?: {
        status?: string;
        pm_uptime?: number;
        restart_time?: number;
      };
    }>;

    for (const item of list) {
      const rawStatus = item.pm2_env?.status || "unknown";
      const status: VpsServiceStatus["status"] =
        rawStatus === "online" ? "online" : rawStatus === "stopped" ? "stopped" : "errored";

      services.push({
        name: item.name,
        type: "pm2",
        status,
        pid: item.pid,
        cpu: item.monit?.cpu ?? 0,
        memoryBytes: item.monit?.memory ?? 0,
        uptime: item.pm2_env?.pm_uptime ? Date.now() - item.pm2_env.pm_uptime : 0,
        restarts: item.pm2_env?.restart_time ?? 0,
        extra: `PM2 #${item.pm_id ?? 0}`,
      });
    }
  } catch (err) {
    log.warn({ err }, "Không đọc được pm2 jlist");
  }

  // 2. Docker containers
  try {
    const { stdout } = await execAsync("docker ps --format '{{json .}}'");
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const doc = JSON.parse(line) as {
          Names?: string;
          Image?: string;
          Status?: string;
          Ports?: string;
          State?: string;
        };
        const name = doc.Names || "container";
        const state = (doc.State || "").toLowerCase();
        services.push({
          name: name.replace(/^\//, ""),
          type: "docker",
          status: state === "running" ? "online" : "stopped",
          extra: `${doc.Image || ""} | ${doc.Status || ""}`,
        });
      } catch {
        // ignore
      }
    }
  } catch {
    // Docker có thể không có hoặc permission
  }

  // 3. Caddy
  try {
    const { stdout } = await execAsync("systemctl is-active caddy");
    const active = stdout.trim() === "active";
    services.push({
      name: "caddy",
      type: "systemd",
      status: active ? "online" : "stopped",
      extra: "Web Server & Reverse Proxy (SSL)",
    });
  } catch {
    // Có thể caddy chạy binary riêng
  }

  return services;
}

/**
 * Lấy top 6 tiến trình theo RAM/CPU
 */
async function getTopProcesses(): Promise<VpsProcessItem[]> {
  try {
    const { stdout } = await execAsync("ps -eo pid,%mem,%cpu,comm --sort=-%mem | head -n 7");
    const lines = stdout.trim().split("\n").slice(1);
    const items: VpsProcessItem[] = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        items.push({
          pid: parseInt(parts[0] || "0", 10),
          memPercent: parseFloat(parts[1] || "0") || 0,
          cpuPercent: parseFloat(parts[2] || "0") || 0,
          name: parts.slice(3).join(" ") || "proc",
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * Tổng hợp toàn bộ metrics VPS
 */
export async function getVpsMetrics(): Promise<VpsMetrics> {
  const [mem, disk, services, topProcs] = await Promise.all([
    getLinuxMemInfo(),
    getDiskUsage(),
    getServices(),
    getTopProcesses(),
  ]);

  const uptimeSec = Math.floor(os.uptime());
  const cpus = os.cpus();

  return {
    timestamp: Date.now(),
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: uptimeSec,
      uptimeFormatted: formatUptime(uptimeSec),
      serverTime: new Date().toISOString(),
    },
    cpu: {
      model: cpus[0]?.model || "CPU",
      cores: cpus.length,
      usagePercent: getCpuUsage(),
      loadAvg: os.loadavg() as [number, number, number],
    },
    memory: mem,
    disk,
    services,
    topProcesses: topProcs,
  };
}

/**
 * Thực hiện khởi động lại VPS một cách an toàn
 */
export async function executeVpsReboot(): Promise<{ ok: boolean; message: string }> {
  log.warn("🚨🚨🚨 YÊU CẦU REBOOT TOÀN BỘ VPS ĐƯỢC KÍCH HOẠT TỪ DASHBOARD! 🚨🚨🚨");

  // Đặt timeout 1.5 giây để phản hồi HTTP kịp trả về cho trình duyệt
  setTimeout(() => {
    log.warn("Đang gọi lệnh /usr/sbin/reboot...");
    exec("sync && (/usr/sbin/reboot || /usr/sbin/shutdown -r now || sudo reboot)", (err) => {
      if (err) {
        log.error({ err }, "Lỗi khi gọi lệnh reboot");
      }
    });
  }, 1500);

  return {
    ok: true,
    message: "Hệ thống đang khởi động lại VPS. Vui lòng chờ 30 - 60 giây và tải lại trang.",
  };
}

/**
 * Khởi động lại 1 service cụ thể (PM2 hoặc Docker)
 */
export async function restartSpecificService(name: string): Promise<{ ok: boolean; message: string }> {
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "");
  log.info({ service: sanitized }, "Yêu cầu restart service");

  try {
    if (sanitized === "9router" || sanitized === "vbai-mongo") {
      await execAsync(`docker restart ${sanitized}`);
    } else if (sanitized === "caddy") {
      await execAsync("systemctl restart caddy");
    } else {
      await execAsync(`pm2 restart ${sanitized}`);
    }
    return { ok: true, message: `Đã khởi động lại dịch vụ ${sanitized} thành công.` };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error({ err, service: sanitized }, "Lỗi khi restart service");
    return { ok: false, message: `Khởi động lại thất bại: ${errorMsg}` };
  }
}
