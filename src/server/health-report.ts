import os from "node:os";
import { execSync } from "node:child_process";


export interface HealthReport {
  timestamp: string;
  uptime: string;
  cpu: { usage: string; loadAvg: string };
  memory: { total: string; used: string; free: string; usedPercent: string };
  disk: { total: string; used: string; free: string; usedPercent: string };
  process: { pid: number; memoryMB: string; uptimeMin: string };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

/**
 * Thu thập thông tin sức khỏe server.
 */
export function collectHealthReport(): HealthReport {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const cpuUsage = ((loadAvg[0] / cpuCount) * 100).toFixed(1);

  // Disk info (Linux)
  let diskTotal = "N/A";
  let diskUsed = "N/A";
  let diskFree = "N/A";
  let diskPercent = "N/A";
  try {
    const dfOutput = execSync("df -B1 / | tail -1", { timeout: 5000 }).toString().trim();
    const parts = dfOutput.split(/\s+/);
    if (parts.length >= 5) {
      const total = parseInt(parts[1], 10);
      const used = parseInt(parts[2], 10);
      const free = parseInt(parts[3], 10);
      diskTotal = formatBytes(total);
      diskUsed = formatBytes(used);
      diskFree = formatBytes(free);
      diskPercent = ((used / total) * 100).toFixed(1);
    }
  } catch {
    // Non-linux hoặc lỗi
  }

  const proc = process.memoryUsage();

  return {
    timestamp: new Date().toISOString(),
    uptime: formatUptime(os.uptime()),
    cpu: {
      usage: `${cpuUsage}%`,
      loadAvg: loadAvg.map((v) => v.toFixed(2)).join(", "),
    },
    memory: {
      total: formatBytes(totalMem),
      used: formatBytes(usedMem),
      free: formatBytes(freeMem),
      usedPercent: `${memPercent}%`,
    },
    disk: {
      total: diskTotal,
      used: diskUsed,
      free: diskFree,
      usedPercent: `${diskPercent}%`,
    },
    process: {
      pid: process.pid,
      memoryMB: (proc.rss / 1048576).toFixed(1),
      uptimeMin: (process.uptime() / 60).toFixed(0),
    },
  };
}

/**
 * Tạo text tóm tắt health report.
 */
export function formatHealthText(report: HealthReport): string {
  return [
    `📊 Server Health Report`,
    `⏰ ${report.timestamp}`,
    ``,
    `💻 CPU: ${report.cpu.usage} (load: ${report.cpu.loadAvg})`,
    `🧠 RAM: ${report.memory.used}/${report.memory.total} (${report.memory.usedPercent})`,
    `💾 Disk: ${report.disk.used}/${report.disk.total} (${report.disk.usedPercent})`,
    `⏱️ Uptime: ${report.uptime}`,
    `🤖 Bot PID ${report.process.pid}: ${report.process.memoryMB} MB RSS, ${report.process.uptimeMin} min`,
  ].join("\n");
}
