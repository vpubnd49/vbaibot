import { env } from "../config/env.js";
import { getAccount, listEnabledAccounts } from "../config/account-store.js";
import { createLogger } from "../shared/logger.js";
import { getRunningAccountApi, getRunningAccounts } from "./account-manager.js";

const log = createLogger("owner-notifier");

import { db } from "../conversation/database.js";

/** Cooldown chống dội bom tin nhắn (15 phút cho disconnect, 30 phút cho error surge) */
const COOLDOWN_DISCONNECT_MS = 15 * 60_000;
const COOLDOWN_ERROR_SURGE_MS = 30 * 60_000;

const disconnectAlertState = new Map<string, { alerted: boolean; at: number }>();
let lastErrorSurgeAlertAt = 0;

/** Tìm danh sách Admin ID từ cấu hình account hoặc biến môi trường */
export function getAdminUserIds(preferredAccountId?: string): string[] {
  const ids = new Set<string>();

  if (preferredAccountId) {
    const acc = getAccount(preferredAccountId);
    if (acc?.adminUserIds) {
      for (const id of acc.adminUserIds) if (id.trim()) ids.add(id.trim());
    }
  }

  for (const acc of listEnabledAccounts()) {
    if (acc.adminUserIds) {
      for (const id of acc.adminUserIds) if (id.trim()) ids.add(id.trim());
    }
  }

  const envAdmins = (env.ANTIGRAVITY_ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const id of envAdmins) ids.add(id);

  return [...ids];
}

/** Tìm tài khoản Zalo đã có sẵn hội thoại với user ID này để ưu tiên gửi */
function findAccountWithThread(threadId: string): string | null {
  try {
    const row = db
      .prepare("SELECT account_id FROM threads WHERE thread_id = ? ORDER BY last_message_at DESC LIMIT 1")
      .get(threadId) as { account_id: string } | undefined;
    return row?.account_id ?? null;
  } catch {
    return null;
  }
}

/** Gửi tin nhắn trực tiếp đến Admin Zalo */
export async function sendToAdmin(
  text: string,
  options?: { preferredAccountId?: string; excludeAccountId?: string },
): Promise<boolean> {
  const adminIds = getAdminUserIds(options?.preferredAccountId);
  if (adminIds.length === 0) {
    log.warn("Không thể gửi tin cho Admin: Chưa cấu hình adminUserIds hoặc ANTIGRAVITY_ADMIN_USER_IDS");
    return false;
  }

  const running = getRunningAccounts().filter((a) => a.id !== options?.excludeAccountId);
  if (running.length === 0) {
    log.warn("Không thể gửi tin cho Admin: Không có tài khoản Zalo nào đang online");
    return false;
  }

  let sentCount = 0;
  for (const adminId of adminIds) {
    // Sắp xếp: Ưu tiên account đã có hội thoại với adminId -> preferredAccountId -> còn lại
    const threadAccId = findAccountWithThread(adminId);
    const sorted = [...running].sort((a, b) => {
      if (a.id === threadAccId) return -1;
      if (b.id === threadAccId) return 1;
      if (a.id === options?.preferredAccountId) return -1;
      if (b.id === options?.preferredAccountId) return 1;
      return 0;
    });

    let sent = false;
    let lastErr: unknown = null;
    for (const sender of sorted) {
      const api = getRunningAccountApi(sender.id);
      if (!api) continue;
      try {
        await api.sendMessage({ msg: text, quote: undefined }, adminId, 0); // 0 = ThreadType.User
        sent = true;
        sentCount++;
        log.info({ adminId, viaAccount: sender.id }, "Đã gửi thông báo cho Admin Zalo");
        break;
      } catch (err) {
        lastErr = err;
        log.debug({ adminId, senderAccount: sender.id, err }, "Gửi qua account này không thành công, thử tài khoản tiếp theo");
      }
    }

    if (!sent) {
      log.error({ adminId, err: lastErr }, "Lỗi khi gửi tin cho Admin (đã thử qua mọi tài khoản online)");
    }
  }

  return sentCount > 0;
}

/** Cảnh báo khi tài khoản Zalo bị ngắt kết nối (có cooldown chống spam) */
export async function notifyAccountDisconnect(accountId: string, reason?: string): Promise<boolean> {
  const now = Date.now();
  const state = disconnectAlertState.get(accountId);

  if (state?.alerted && now - state.at < COOLDOWN_DISCONNECT_MS) {
    log.debug({ accountId }, "Bỏ qua cảnh báo disconnect (đang trong thời gian cooldown)");
    return false;
  }

  const acc = getAccount(accountId);
  const label = acc?.label ?? accountId;
  const timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  const msg = [
    `🚨 [CẢNH BÁO] TÀI KHOẢN ZALO MẤT KẾT NỐI`,
    `Tài khoản: "${label}" (${accountId})`,
    `Tình trạng: ${reason || "Mất kết nối hoặc phiên đăng nhập bị hủy"}`,
    `Thời gian: ${timeStr}`,
    `👉 Vui lòng truy cập Dashboard để kiểm tra hoặc quét lại mã QR.`,
  ].join("\n");

  const ok = await sendToAdmin(msg, { excludeAccountId: accountId });
  disconnectAlertState.set(accountId, { alerted: true, at: now });
  return ok;
}

/** Thông báo khi tài khoản kết nối lại thành công sau sự cố */
export async function notifyAccountRecovered(accountId: string): Promise<boolean> {
  const state = disconnectAlertState.get(accountId);
  if (!state?.alerted) return false;

  const acc = getAccount(accountId);
  const label = acc?.label ?? accountId;
  const timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  const msg = [
    `✅ [PHỤC HỒI] TÀI KHOẢN ĐÃ KẾT NỐI LẠI`,
    `Tài khoản "${label}" (${accountId}) đã kết nối trực tuyến trở lại bình thường lúc ${timeStr}.`,
  ].join("\n");

  disconnectAlertState.delete(accountId);
  return sendToAdmin(msg);
}

/** Cảnh báo lỗi tăng đột biến */
export async function notifyErrorSurge(count: number, recentSample: string): Promise<boolean> {
  const now = Date.now();
  if (now - lastErrorSurgeAlertAt < COOLDOWN_ERROR_SURGE_MS) return false;

  lastErrorSurgeAlertAt = now;
  const msg = [
    `⚠️ [CẢNH BÁO] TỶ LỆ LỖI HỆ THỐNG TĂNG ĐỘT BIẾN`,
    `Ghi nhận ${count} lỗi trong vòng 15 phút vừa qua.`,
    `Mẫu lỗi gần nhất: ${recentSample.slice(0, 150)}`,
    `👉 Vui lòng kiểm tra mục Nhật ký sự cố trên Dashboard.`,
  ].join("\n");

  return sendToAdmin(msg);
}

/** Reset bộ đếm trạng thái (cho unit test) */
export function resetAlertStatesForTest(): void {
  disconnectAlertState.clear();
  lastErrorSurgeAlertAt = 0;
}
