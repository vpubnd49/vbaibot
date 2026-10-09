import { env } from "../config/env.js";
import { getAccount, listEnabledAccounts } from "../config/account-store.js";
import { createLogger } from "../shared/logger.js";
import { getRunningAccountApi, getRunningAccounts } from "./account-manager.js";

const log = createLogger("owner-notifier");

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

/** Tìm API của 1 account đang online để gửi tin (ưu tiên account khác nếu target bị ngắt) */
function pickSendingApi(excludeAccountId?: string) {
  const running = getRunningAccounts();
  const candidate = running.find((a) => a.id !== excludeAccountId) ?? running[0];
  if (!candidate) return null;
  const api = getRunningAccountApi(candidate.id);
  return api ? { api, accountId: candidate.id, label: candidate.label } : null;
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

  const sender = pickSendingApi(options?.excludeAccountId);
  if (!sender) {
    log.warn("Không thể gửi tin cho Admin: Không có tài khoản Zalo nào đang online");
    return false;
  }

  let sentCount = 0;
  for (const adminId of adminIds) {
    try {
      await sender.api.sendMessage({ msg: text, quote: undefined }, adminId, 0); // 0 = ThreadType.User
      sentCount++;
    } catch (err) {
      log.error({ adminId, senderAccount: sender.accountId, err }, "Lỗi khi gửi tin cho Admin");
    }
  }

  if (sentCount > 0) {
    log.info({ sentCount, viaAccount: sender.accountId }, "Đã gửi thông báo cho Admin Zalo");
    return true;
  }
  return false;
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
