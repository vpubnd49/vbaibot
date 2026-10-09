/**
 * Điểm sức khỏe hệ thống cho thẻ "Hệ thống ổn định" ở Trang chủ.
 *
 * Hàm THUẦN: nhận số liệu, trả điểm + lý do - test được mà không cần DB/VPS.
 * Luật trừ điểm cố ý đơn giản, đọc là hiểu, để chủ bot tin được con số:
 * - Account đang bật mà không online: trừ nặng nhất (bot câm với khách).
 * - Chưa cấu hình LLM: bot online nhưng mọi tin đều trả lỗi.
 * - Lỗi 24 giờ: trừ dần, có trần - vài lỗi lẻ tẻ không nên làm đỏ cả trang.
 * - CPU/RAM/Ổ đĩa vượt ngưỡng.
 */

export type HealthInput = {
  accountsEnabled: number;
  accountsOnline: number;
  llmConfigured: boolean;
  errors24h: number;
  cpuPercent?: number;
  memPercent?: number;
  diskPercent?: number;
};

export type HealthResult = {
  score: number;
  level: "ok" | "warn" | "bad";
  /** Câu ngắn tiếng Việt, rỗng = không có cảnh báo */
  reasons: string[];
};

const NGUONG_TAI_NGUYEN = 90;

export function tinhSucKhoe(input: HealthInput): HealthResult {
  let score = 100;
  const reasons: string[] = [];

  const offline = Math.max(0, input.accountsEnabled - input.accountsOnline);
  if (offline > 0) {
    score -= Math.min(60, offline * 30);
    reasons.push(`${offline} tài khoản Zalo đang mất kết nối`);
  }
  if (!input.llmConfigured) {
    score -= 40;
    reasons.push("Chưa cấu hình model AI");
  }
  if (input.errors24h > 0) {
    score -= Math.min(20, Math.ceil(input.errors24h / 2));
    reasons.push(`${input.errors24h} lỗi trong 24 giờ qua`);
  }
  const taiNguyen: [string, number | undefined][] = [
    ["CPU", input.cpuPercent],
    ["RAM", input.memPercent],
    ["Ổ đĩa", input.diskPercent],
  ];
  for (const [ten, pct] of taiNguyen) {
    if (pct !== undefined && pct >= NGUONG_TAI_NGUYEN) {
      score -= 10;
      reasons.push(`${ten} đang ở mức ${Math.round(pct)}%`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 90 ? "ok" : score >= 60 ? "warn" : "bad";
  return { score, level, reasons };
}
