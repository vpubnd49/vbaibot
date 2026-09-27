/**
 * disaster-alert-broadcast.ts
 * Tự động gửi cảnh báo thiên tai khẩn cấp tới các nhóm chat khi phát hiện
 * mức cảnh báo cam (orange) hoặc đỏ (red).
 *
 * Tích hợp vào disaster-alert-crawler: sau mỗi lượt cào, nếu mức cảnh báo
 * cao nhất >= cam → gửi cảnh báo tới tất cả nhóm đang bật bot.
 *
 * Chống spam: mỗi mức cảnh báo chỉ gửi broadcast 1 lần / 4 giờ.
 */
import { db } from "../conversation/database.js";
import { createLogger } from "../shared/logger.js";
import { listEnabledAccounts } from "../config/account-store.js";
import { getRunningAccountApi } from "../zalo/account-manager.js";
import { deliverChatReply } from "../zalo/deliver-chat-reply.js";
import {
  getHighestAlertLevel,
  listActiveAlerts,
  type AlertLevel,
} from "../realtime/disaster/disaster-alert-store.js";

const log = createLogger("disaster-broadcast");

// ───── Cooldown: tránh spam cùng mức cảnh báo ──────────────────────────────

const BROADCAST_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 giờ

const lastBroadcastAt = new Map<AlertLevel, number>();

function isOnCooldown(level: AlertLevel): boolean {
  const last = lastBroadcastAt.get(level) ?? 0;
  return Date.now() - last < BROADCAST_COOLDOWN_MS;
}

function markBroadcast(level: AlertLevel): void {
  lastBroadcastAt.set(level, Date.now());
}

// ───── Emoji & label ────────────────────────────────────────────────────────

const LEVEL_EMOJI: Record<string, string> = {
  orange: "🟠",
  red: "🔴",
};

const TYPE_LABEL: Record<string, string> = {
  landslide: "🏔️ Sạt lở",
  storm: "🌧️ Mưa bão",
  flood: "🌊 Ngập lụt",
  reservoir: "🚿 Hồ đập / Xả lũ",
  road_block: "🚧 Giao thông đèo",
  general: "⚠️ Thiên tai",
};

// ───── Format tin cảnh báo khẩn ─────────────────────────────────────────────

function formatUrgentAlert(level: AlertLevel): string | null {
  const alerts = listActiveAlerts(5);
  const urgentAlerts = alerts.filter((a) => a.level === "red" || a.level === "orange");

  if (urgentAlerts.length === 0) return null;

  const emoji = LEVEL_EMOJI[level] ?? "⚠️";
  const isRed = level === "red";

  let msg = isRed
    ? `${emoji}${emoji}${emoji} **CẢNH BÁO KHẨN CẤP — THIÊN TAI LÂM ĐỒNG** ${emoji}${emoji}${emoji}\n\n`
    : `${emoji} **CẢNH BÁO THIÊN TAI LÂM ĐỒNG** ${emoji}\n\n`;

  for (const a of urgentAlerts.slice(0, 4)) {
    const typeLabel = TYPE_LABEL[a.type] ?? "⚠️";
    msg += `${typeLabel}: **${a.title}**\n`;
    msg += `📍 Khu vực: **${a.area}**\n`;
    if (a.summary && a.summary !== a.title) {
      const short = a.summary.length > 150 ? a.summary.slice(0, 147) + "..." : a.summary;
      msg += `${short}\n`;
    }
    msg += `🔗 Nguồn: *${a.sourceName}*\n\n`;
  }

  msg += `---\n`;
  msg += isRed
    ? `⛔ **Đề nghị bà con TUYỆT ĐỐI không đi qua khu vực nguy hiểm, theo dõi chỉ đạo của chính quyền địa phương!**\n`
    : `⚠️ *Bà con lưu ý theo dõi diễn biến thời tiết, hạn chế di chuyển qua khu vực nguy cơ.*\n`;
  msg += `Hỏi thêm: gắn thẻ bot và nhắn "cảnh báo thiên tai" hoặc "tình hình sạt lở".`;

  return msg;
}

// ───── Gửi broadcast tới tất cả nhóm ────────────────────────────────────────

async function broadcastToAllGroups(message: string): Promise<{ sent: number; failed: number }> {
  const accounts = listEnabledAccounts();
  let sent = 0;
  let failed = 0;

  for (const acc of accounts) {
    const api = getRunningAccountApi(acc.id);
    if (!api) continue;

    // Lấy tất cả nhóm đang bật bot
    const rows = db
      .prepare("SELECT thread_id FROM threads WHERE account_id = ? AND bot_enabled = 1 AND thread_type = 1")
      .all(acc.id) as { thread_id: string }[];

    for (const row of rows) {
      try {
        const target = {
          api,
          threadKey: `${acc.id}:${row.thread_id}`,
          threadId: row.thread_id,
          threadType: 1 as const,
        };

        const result = await deliverChatReply(target, acc.id, row.thread_id, message);
        if (result.hong) {
          failed++;
        } else {
          sent++;
        }

        // Delay 2s giữa các nhóm để tránh rate limit
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        failed++;
        log.warn({ err, threadId: row.thread_id }, "Lỗi gửi cảnh báo thiên tai tới nhóm");
      }
    }
  }

  return { sent, failed };
}

// ───── Hàm chính: kiểm tra và gửi broadcast ────────────────────────────────

/**
 * Kiểm tra mức cảnh báo hiện tại và gửi broadcast nếu cần.
 * Gọi sau mỗi lượt cào của disaster-alert-crawler.
 *
 * Chỉ gửi khi:
 * 1. Mức cảnh báo >= cam (orange)
 * 2. Chưa gửi broadcast cho mức này trong 4 giờ qua
 */
export async function checkAndBroadcastDisasterAlert(): Promise<void> {
  const level = getHighestAlertLevel();

  // Chỉ broadcast cho mức cam và đỏ
  if (level !== "orange" && level !== "red") return;

  // Chống spam: không gửi lại cùng mức trong 4 giờ
  if (isOnCooldown(level)) {
    log.debug({ level }, "Cảnh báo thiên tai đang trong cooldown — bỏ qua broadcast");
    return;
  }

  const message = formatUrgentAlert(level);
  if (!message) return;

  log.info({ level }, "Phát hiện cảnh báo thiên tai mức cao — bắt đầu broadcast");

  const { sent, failed } = await broadcastToAllGroups(message);

  markBroadcast(level);
  // Nếu đang đỏ, cũng đánh dấu cam để không gửi cam ngay sau đỏ
  if (level === "red") markBroadcast("orange");

  log.info(
    { level, sent, failed },
    `Đã broadcast cảnh báo thiên tai tới ${sent} nhóm (${failed} lỗi)`,
  );
}
