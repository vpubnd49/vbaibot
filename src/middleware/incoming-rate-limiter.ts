/**
 * Sliding-window rate limiter cho TIN ĐẾN — chặn spam/lạm dụng.
 *
 * In-memory (Map) — restart bot thì đếm lại từ đầu, hợp lý cho rate limiting.
 * Tự dọn entries cũ mỗi lần check để không leak memory.
 *
 * KHÁC `rate-limiter.ts` (send queue): file đó quản lý hàng đợi GỬI để tránh
 * Zalo đánh spam, file này chặn tin NHẬN đến quá nhanh từ 1 user.
 */

import { getTuning } from "../config/runtime-tuning-settings.js";

/** Mỗi entry lưu mảng timestamps (epoch ms) của các tin gần đây */
const windows = new Map<string, number[]>();

/** Dọn timestamps quá cũ ra khỏi mảng, dọn entry rỗng khỏi Map */
function pruneWindow(key: string, windowMs: number, now: number): number[] {
  const timestamps = windows.get(key);
  if (!timestamps) return [];

  const cutoff = now - windowMs;
  const fresh = timestamps.filter((t) => t > cutoff);

  if (fresh.length === 0) {
    windows.delete(key);
    return [];
  }
  windows.set(key, fresh);
  return fresh;
}

export type RateLimitResult = {
  allowed: boolean;
  /** Số ms chờ trước khi gửi lại được (chỉ khi allowed=false) */
  retryAfterMs?: number;
  /** Số tin còn lại trong window hiện tại */
  remaining: number;
};

/**
 * Kiểm tra rate limit cho 1 sender.
 *
 * Đọc config từ tuning mỗi lần gọi — đổi trên dashboard ăn ngay.
 */
export function checkIncomingRateLimit(accountId: string, senderId: string): RateLimitResult {
  const windowMs = getTuning("RATE_LIMIT_WINDOW_MS");
  const maxMessages = getTuning("RATE_LIMIT_MAX_MESSAGES");

  // Rate limit tắt (max = 0) → luôn cho qua
  if (maxMessages <= 0) return { allowed: true, remaining: 0 };

  const key = `${accountId}:${senderId}`;
  const now = Date.now();
  const fresh = pruneWindow(key, windowMs, now);

  if (fresh.length >= maxMessages) {
    const oldestInWindow = fresh[0]!;
    const retryAfterMs = oldestInWindow + windowMs - now;
    return {
      allowed: false,
      retryAfterMs: Math.max(0, retryAfterMs),
      remaining: 0,
    };
  }

  // Cho qua — ghi timestamp
  fresh.push(now);
  windows.set(key, fresh);

  return {
    allowed: true,
    remaining: maxMessages - fresh.length,
  };
}

/** Xóa hết dữ liệu (cho test) */
export function resetIncomingRateLimiter(): void {
  windows.clear();
}
