import { getNotebooklmSettings } from "../config/runtime-notebooklm-settings.js";
import { createLogger } from "../shared/logger.js";
import { sendToAdmin } from "../zalo/owner-notifier.js";
import { nlmHealth } from "./notebooklm-client.js";

/**
 * Giám sát máy chủ NotebookLM mỗi 5 phút (chỉ khi Admin đã BẬT tool).
 *
 * Báo Zalo cho Admin khi máy chủ tắt hoặc Google bị đăng xuất - không có cảnh
 * báo này thì chỉ biết hỏng khi người dùng gửi yêu cầu rồi nhận lỗi. Phải xấu
 * 2 lần LIÊN TIẾP mới báo (container restart / VPS reboot mất ~1 phút, không
 * đáng báo), và báo lại một lần khi đã khỏe để Admin biết khỏi phải xử lý.
 */

const log = createLogger("notebooklm-health");
const POLL_MS = 5 * 60_000;

export type NlmState = "ok" | "down" | "logged_out";

export type WatchMemory = { alerted: NlmState; pending: NlmState | null };

/** Quyết định có báo không. Trả state mới + câu báo (null = im lặng) */
export function nextHealthStep(mem: WatchMemory, now: NlmState): { mem: WatchMemory; alert: string | null } {
  if (now === mem.alerted) return { mem: { alerted: mem.alerted, pending: null }, alert: null };
  if (now === "ok") {
    // Khỏi bệnh: báo ngay một lần (không cần chờ xác nhận)
    return { mem: { alerted: "ok", pending: null }, alert: "✅ [NOTEBOOKLM] Máy chủ đã hoạt động lại, Google vẫn đăng nhập." };
  }
  if (mem.pending !== now) return { mem: { alerted: mem.alerted, pending: now }, alert: null };
  const alert =
    now === "down"
      ? "⚠️ [NOTEBOOKLM] Máy chủ NotebookLM trên VPS không phản hồi 10 phút nay. Kiểm tra: docker ps | grep notebooklm"
      : "⚠️ [NOTEBOOKLM] Tài khoản Google của bot đã bị ĐĂNG XUẤT. Vào dashboard → Công cụ → NotebookLM → Cài đặt → \"Đăng nhập Google\".";
  return { mem: { alerted: now, pending: null }, alert };
}

let mem: WatchMemory = { alerted: "ok", pending: null };

export async function checkNotebooklmHealth(): Promise<void> {
  if (!getNotebooklmSettings().enabled) return;
  const h = await nlmHealth();
  const now: NlmState = !h.ok ? "down" : h.data.authenticated ? "ok" : "logged_out";
  const step = nextHealthStep(mem, now);
  if (step.alert) {
    const sent = await sendToAdmin(step.alert);
    if (!sent) return; // giữ mem cũ để lần sau thử báo lại
    log.info({ state: now }, "Đã báo Admin trạng thái NotebookLM");
  }
  mem = step.mem;
}

export function startNotebooklmHealthWatcher(): void {
  const run = () => void checkNotebooklmHealth().catch((err) => log.debug({ err }, "Lỗi kiểm tra NotebookLM"));
  setTimeout(run, 90_000).unref();
  setInterval(run, POLL_MS).unref();
}
