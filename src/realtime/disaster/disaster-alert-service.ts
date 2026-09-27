/**
 * disaster-alert-service.ts
 * API layer cho hệ thống cảnh báo thiên tai.
 *
 * Cung cấp:
 * - Lấy tổng hợp cảnh báo cho bot tool
 * - Lấy block cảnh báo để inject vào weather / greeting / bản tin
 * - Dashboard stats
 */
import {
  listActiveAlerts,
  listAlertsByArea,
  getHighestAlertLevel,
  countActiveAlerts,
  type AlertLevel,
  type DisasterAlertRow,
} from "./disaster-alert-store.js";

// ───── Emoji theo mức cảnh báo ──────────────────────────────────────────────

const LEVEL_EMOJI: Record<AlertLevel, string> = {
  green: "🟢",
  yellow: "🟡",
  orange: "🟠",
  red: "🔴",
};

const LEVEL_LABEL: Record<AlertLevel, string> = {
  green: "Bình thường",
  yellow: "Theo dõi",
  orange: "Cảnh báo",
  red: "KHẨN CẤP",
};

const TYPE_LABEL: Record<string, string> = {
  landslide: "🏔️ Sạt lở",
  storm: "🌧️ Mưa bão",
  flood: "🌊 Ngập lụt",
  reservoir: "🚿 Hồ đập / Xả lũ",
  road_block: "🚧 Giao thông đèo",
  general: "⚠️ Thiên tai chung",
};

// ───── Truy vấn cảnh báo cho bot ────────────────────────────────────────────

export type DisasterAlertSummary = {
  highestLevel: AlertLevel;
  totalActive: number;
  alerts: DisasterAlertRow[];
  formattedText: string;
};

/**
 * Lấy tổng hợp cảnh báo thiên tai cho bot trả lời.
 * Nếu có `area`, lọc theo khu vực cụ thể.
 */
export function getDisasterAlertSummary(area?: string): DisasterAlertSummary {
  const alerts = area
    ? listAlertsByArea(area, 10)
    : listActiveAlerts(10);

  const highestLevel = getHighestAlertLevel();
  const totalActive = countActiveAlerts();

  const formattedText = formatAlertSummary(alerts, highestLevel, totalActive, area);

  return { highestLevel, totalActive, alerts, formattedText };
}

/**
 * Format cảnh báo thành text đẹp cho Zalo.
 */
function formatAlertSummary(
  alerts: DisasterAlertRow[],
  highestLevel: AlertLevel,
  totalActive: number,
  area?: string,
): string {
  const emoji = LEVEL_EMOJI[highestLevel];
  const label = LEVEL_LABEL[highestLevel];

  let text = `🚨 **CẢNH BÁO THIÊN TAI${area ? ` — ${area.toUpperCase()}` : " — LÂM ĐỒNG"}**\n`;
  text += `${emoji} **Mức cảnh báo hiện tại: ${label}**`;
  if (totalActive > 0) {
    text += ` (${totalActive} cảnh báo đang hoạt động)`;
  }
  text += `\n\n`;

  if (alerts.length === 0) {
    text += `✅ Hiện tại không có cảnh báo thiên tai nào cho khu vực${area ? ` ${area}` : " toàn tỉnh Lâm Đồng"}.\n`;
    text += `Thời tiết ổn định, không ghi nhận nguy cơ sạt lở, ngập lụt hay xả lũ hồ đập.\n`;
    return text.trim();
  }

  // Nhóm theo loại thiên tai
  const grouped = new Map<string, DisasterAlertRow[]>();
  for (const a of alerts) {
    const key = a.type;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(a);
  }

  for (const [type, items] of grouped) {
    const typeLabel = TYPE_LABEL[type] ?? `⚠️ ${type}`;
    text += `## ${typeLabel}\n`;

    for (const item of items.slice(0, 3)) {
      const levelEmoji = LEVEL_EMOJI[item.level];
      const timeStr = formatTimeAgo(item.publishedAt);

      text += `${levelEmoji} **${item.title}**\n`;
      text += `- Khu vực: **${item.area}**\n`;
      if (item.summary && item.summary !== item.title) {
        const shortSummary = item.summary.length > 200
          ? item.summary.slice(0, 197) + "..."
          : item.summary;
        text += `- ${shortSummary}\n`;
      }
      text += `- Nguồn: *${item.sourceName}* (${timeStr})\n\n`;
    }
  }

  text += `---\n`;
  text += `*Cập nhật liên tục từ Facebook, Báo Lâm Đồng, Cổng TTĐT. Dữ liệu thiên tai CỰC KỲ NHẠY CẢM — chỉ trích dẫn nguồn đã xác minh.*`;

  return text.trim();
}

/**
 * Format thời gian tương đối.
 */
function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

// ───── Block inject cho weather / greeting ───────────────────────────────────

/**
 * Tạo block cảnh báo thiên tai ngắn gọn để inject vào bản tin thời tiết
 * hoặc lời chào sáng. Chỉ hiện khi có cảnh báo vàng trở lên.
 *
 * Trả về null nếu không có cảnh báo nào.
 */
export function getDisasterAlertBlock(): string | null {
  const level = getHighestAlertLevel();
  if (level === "green") return null;

  const alerts = listActiveAlerts(5);
  if (alerts.length === 0) return null;

  const emoji = LEVEL_EMOJI[level];
  const label = LEVEL_LABEL[level];

  let block = `\n⚠️ **CẢNH BÁO THIÊN TAI ${emoji} ${label.toUpperCase()}**\n`;

  for (const a of alerts.slice(0, 3)) {
    const typeLabel = TYPE_LABEL[a.type] ?? "⚠️";
    block += `${typeLabel}: **${a.title}** — ${a.area} (*${a.sourceName}*)\n`;
  }

  if (alerts.length > 3) {
    block += `...và ${alerts.length - 3} cảnh báo khác.\n`;
  }

  block += `Tra cứu chi tiết: hỏi "cảnh báo thiên tai" hoặc "tình hình sạt lở".`;

  return block;
}

// ───── Dashboard stats ──────────────────────────────────────────────────────

export type DisasterDashboardStats = {
  highestLevel: AlertLevel;
  totalActive: number;
  byType: Record<string, number>;
};

export function getDisasterDashboardStats(): DisasterDashboardStats {
  const alerts = listActiveAlerts(50);
  const byType: Record<string, number> = {};

  for (const a of alerts) {
    byType[a.type] = (byType[a.type] ?? 0) + 1;
  }

  return {
    highestLevel: getHighestAlertLevel(),
    totalActive: countActiveAlerts(),
    byType,
  };
}
