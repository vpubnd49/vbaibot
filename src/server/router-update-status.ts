import fs from "node:fs";
import path from "node:path";
import { dataDir } from "../config/env.js";
import { createLogger } from "../shared/logger.js";
import { sendToAdmin } from "../zalo/owner-notifier.js";

/**
 * Trạng thái tự cập nhật 9router trên VPS.
 *
 * Script cron `/opt/9router-build/auto-update.sh` (chạy 03:00) ghi kết quả ra
 * `data/9router-update.json`. Bot chỉ ĐỌC file này: báo Zalo cho Admin ngay khi
 * có cập nhật / lỗi, và thêm một dòng vào báo cáo VPS 8h sáng.
 * File đánh dấu `.notified` giữ `checkedAt` đã báo để không báo trùng sau restart.
 */

const log = createLogger("router-update-status");
const POLL_MS = 5 * 60_000;

export type RouterUpdateStatus = {
  checkedAt: string;
  action: "updated" | "none" | "failed";
  current: string;
  latest: string;
  from?: string;
  error?: string;
};

const statusPath = () => path.join(dataDir, "9router-update.json");
const notifiedPath = () => path.join(dataDir, "9router-update.notified");

export function readRouterUpdateStatus(file = statusPath()): RouterUpdateStatus | null {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<RouterUpdateStatus>;
    if (!raw.checkedAt || !raw.action || !raw.current) return null;
    return {
      checkedAt: raw.checkedAt,
      action: raw.action,
      current: raw.current,
      latest: raw.latest ?? raw.current,
      from: raw.from,
      error: raw.error,
    };
  } catch {
    return null;
  }
}

/** Câu thông báo Zalo; null khi không có gì đáng báo (action = none) */
export function formatRouterUpdateAlert(s: RouterUpdateStatus): string | null {
  if (s.action === "updated") {
    return [
      `🔄 [9ROUTER] ĐÃ TỰ CẬP NHẬT`,
      `Phiên bản: ${s.from ?? "?"} → ${s.current}`,
      `Đã chạy thử AI chat thành công trước khi chuyển. Dữ liệu cũ đã sao lưu.`,
    ].join("\n");
  }
  if (s.action === "failed") {
    return [
      `⚠️ [9ROUTER] CẬP NHẬT THẤT BẠI`,
      `Bản mới ${s.latest} chưa đạt kiểm thử, vẫn giữ bản ${s.current} đang chạy ổn định.`,
      `Lý do: ${(s.error ?? "không rõ").slice(0, 200)}`,
    ].join("\n");
  }
  return null;
}

/** Một dòng cho báo cáo 8h sáng */
export function routerStatusLine(s: RouterUpdateStatus | null): string {
  if (!s) return "• 9router: chưa có dữ liệu tự cập nhật";
  const upToDate = s.current === s.latest ? "bản mới nhất" : `có bản ${s.latest}`;
  const fail = s.action === "failed" ? " ⚠️ lần cập nhật gần nhất thất bại" : "";
  return `• 9router: v${s.current} (${upToDate})${fail}`;
}

export async function checkAndNotifyRouterUpdate(): Promise<boolean> {
  const s = readRouterUpdateStatus();
  if (!s) return false;
  let notified = "";
  try {
    notified = fs.readFileSync(notifiedPath(), "utf8").trim();
  } catch {
    /* chưa từng báo */
  }
  if (notified === s.checkedAt) return false;

  const text = formatRouterUpdateAlert(s);
  if (text) {
    const ok = await sendToAdmin(text);
    if (!ok) return false; // để lần poll sau thử lại
    log.info({ action: s.action, current: s.current }, "Đã báo Admin kết quả tự cập nhật 9router");
  }
  fs.writeFileSync(notifiedPath(), s.checkedAt);
  return Boolean(text);
}

export function startRouterUpdateWatcher(): void {
  const run = () => void checkAndNotifyRouterUpdate().catch((err) => log.debug({ err }, "Không đọc được trạng thái 9router"));
  setTimeout(run, 60_000).unref();
  setInterval(run, POLL_MS).unref();
}
