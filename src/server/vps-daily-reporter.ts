import { DateTime } from "luxon";
import { botTimeZone } from "../config/runtime-tuning-settings.js";
import { createLogger } from "../shared/logger.js";
import { sendToAdmin } from "../zalo/owner-notifier.js";
import { getHomeSummary } from "./home-summary.js";

const log = createLogger("vps-daily-reporter");

let lastSentDateKey = "";
let reporterInterval: ReturnType<typeof setInterval> | null = null;

/** Soạn nội dung báo cáo VPS và tình trạng bot định kỳ */
export async function buildDailyVpsReportText(): Promise<string> {
  const summary = await getHomeSummary();
  const tz = botTimeZone();
  const now = DateTime.now().setZone(tz);
  const dateStr = now.toFormat("dd/MM/yyyy");
  const timeStr = now.toFormat("HH:mm");

  const vpsCpu = summary.vps.cpu !== undefined ? `${summary.vps.cpu}%` : "N/A";
  const vpsMem = summary.vps.mem !== undefined ? `${summary.vps.mem}%` : "N/A";
  const vpsDisk = summary.vps.disk !== undefined ? `${summary.vps.disk}%` : "N/A";

  const healthStatus =
    summary.health.level === "ok"
      ? "Ổn định"
      : summary.health.level === "warn"
        ? "Cần lưu ý"
        : "Cảnh báo";

  const upcomingList =
    summary.upcoming.length > 0
      ? summary.upcoming
          .slice(0, 3)
          .map((u) => {
            const runDt = DateTime.fromISO(u.nextRunAt).setZone(tz);
            const runTime = runDt.isValid ? runDt.toFormat("HH:mm") : u.nextRunAt.slice(11, 16);
            return `  • [${runTime}] ${u.name} (${u.accountLabel || u.accountId})`;
          })
          .join("\n")
      : "  • Không có lịch hẹn nào sắp chạy";

  return [
    `📊 [BÁO CÁO HỆ THỐNG ĐỊNH KỲ]`,
    `📅 Thời gian: ${dateStr} lúc ${timeStr} (${tz})`,
    ``,
    `🖥️ Hạ tầng VPS:`,
    `• CPU: ${vpsCpu} | RAM: ${vpsMem} | Ổ cứng: ${vpsDisk}`,
    `• Sức khỏe: ${summary.health.score}/100 (${healthStatus})`,
    ``,
    `🤖 Trạng thái Zalo Bot:`,
    `• Tài khoản trực tuyến: ${summary.accounts.online}/${summary.accounts.total}`,
    `• Tin khách hôm nay: ${summary.messagesToday} tin (${summary.turnsToday} lượt AI)`,
    `• Sự cố 24h: ${summary.errors24h} lỗi, ${summary.warnings24h} cảnh báo`,
    ``,
    `⏰ Việc sắp tới:`,
    upcomingList,
    ``,
    `Chúc anh một ngày làm việc hiệu quả! 🌟`,
  ].join("\n");
}

/** Gửi báo cáo định kỳ ngay lập tức */
export async function sendDailyVpsReportNow(): Promise<{ ok: boolean; message?: string }> {
  try {
    const text = await buildDailyVpsReportText();
    const sent = await sendToAdmin(text);
    return { ok: sent, message: sent ? "Đã gửi báo cáo cho Admin" : "Không tìm thấy Admin hoặc tài khoản gửi" };
  } catch (err) {
    log.error({ err }, "Lỗi khi gửi báo cáo định kỳ");
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Vòng lặp kiểm tra giờ gửi báo cáo hàng ngày (mặc định 08:00 sáng theo botTimeZone).
 * Nhịp kiểm tra mỗi 30 giây.
 */
export function startDailyVpsReportLoop(targetHour = 8, targetMinute = 0): void {
  if (reporterInterval) return;

  const checkAndSend = async () => {
    try {
      const tz = botTimeZone();
      const now = DateTime.now().setZone(tz);
      const todayKey = now.toFormat("yyyy-MM-dd");

      // Đã gửi trong ngày hôm nay rồi thì bỏ qua
      if (lastSentDateKey === todayKey) return;

      // Kiểm tra đúng khung giờ
      if (now.hour === targetHour && now.minute === targetMinute) {
        log.info({ targetHour, targetMinute, tz }, "Bắt đầu gửi báo cáo VPS buổi sáng cho Admin");
        const res = await sendDailyVpsReportNow();
        if (res.ok) {
          lastSentDateKey = todayKey;
          log.info({ date: todayKey }, "Báo cáo định kỳ đã gửi thành công");
        }
      }
    } catch (err) {
      log.error({ err }, "Lỗi kiểm tra vòng lặp báo cáo định kỳ");
    }
  };

  reporterInterval = setInterval(checkAndSend, 30_000);
  reporterInterval.unref();
  log.info({ targetHour, targetMinute }, "Vòng lặp báo cáo VPS định kỳ đã kích hoạt");
}

export function stopDailyVpsReportLoop(): void {
  if (reporterInterval) {
    clearInterval(reporterInterval);
    reporterInterval = null;
  }
}
