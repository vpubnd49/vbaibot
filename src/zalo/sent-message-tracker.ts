/**
 * Nhớ id các tin BOT đã gửi theo từng thread, để tool `recall_message` thu hồi
 * đúng tin của bot.
 *
 * Hai nguồn ghi nhận, gộp theo `msgId`:
 *  1. Kết quả `sendMessage` (chỉ có `msgId`, không có `cliMsgId`) - phủ ngay khi
 *     gửi chữ, kể cả khi listener chưa kịp báo về.
 *  2. Sự kiện tin của CHÍNH MÌNH từ listener (`selfListen: true`) - có đủ
 *     `msgId` + `cliMsgId` và phủ MỌI loại tin bot gửi (file, ảnh, sticker, tin do
 *     tool tự gửi) vì chúng không đi qua `sendMessage` của đường trả lời chữ.
 *
 * `cliMsgId` cần cho `api.undo`; thiếu thì thu hồi dùng 0 (xem recall tool).
 *
 * Bền qua restart khi `initSentMessageTracker(file)` được gọi lúc boot: lưu JSON
 * (debounce), nạp lại và bỏ tin quá hạn. Không gọi init thì chỉ nằm trong RAM -
 * test không đụng ổ đĩa.
 */
import fs from "node:fs";
import path from "node:path";

/** Zalo chỉ cho thu hồi tin trong vòng 1 giờ */
export const RECALL_WINDOW_MS = 60 * 60 * 1000;

const MAX_PER_THREAD = 10;
const SAVE_DEBOUNCE_MS = 2000;

export type SentMessageRef = {
  msgId: string;
  /** Có khi tin được listener báo về; thiếu thì thu hồi dùng 0 */
  cliMsgId?: string;
  sentAt: number;
};

const sentByThread = new Map<string, SentMessageRef[]>();

let persistFile: string | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function schedulePersist(): void {
  if (!persistFile || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    flushSentMessageTracker();
  }, SAVE_DEBOUNCE_MS);
  saveTimer.unref?.();
}

/** Ghi ngay xuống đĩa (gọi khi tắt process). Không có file persist thì no-op. */
export function flushSentMessageTracker(): void {
  if (!persistFile) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  try {
    const data: Record<string, SentMessageRef[]> = {};
    for (const [key, list] of sentByThread) data[key] = list;
    fs.mkdirSync(path.dirname(persistFile), { recursive: true });
    const tmp = `${persistFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), "utf8");
    fs.renameSync(tmp, persistFile);
  } catch {
    // Mất file này chỉ làm bot quên tin cũ sau restart - không đáng làm hỏng gì khác
  }
}

/** Bật lưu bền và nạp lại tin còn trong hạn thu hồi. Gọi MỘT lần lúc boot. */
export function initSentMessageTracker(file: string, now: number = Date.now()): void {
  persistFile = file;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, SentMessageRef[]>;
    for (const [key, list] of Object.entries(raw)) {
      if (!Array.isArray(list)) continue;
      const fresh = list.filter(
        (m) => m && typeof m.msgId === "string" && now - Number(m.sentAt) < RECALL_WINDOW_MS,
      );
      if (fresh.length > 0) sentByThread.set(key, fresh.slice(-MAX_PER_THREAD));
    }
  } catch {
    // Chưa có file hoặc file hỏng: bắt đầu từ trống
  }
}

/** Rút `msgId` từ kết quả `sendMessage` của zca-js (hoặc bỏ qua nếu không có). */
export function extractSentMsgId(response: unknown): string | undefined {
  const r = response as {
    message?: { msgId?: number | string } | null;
    attachment?: { msgId?: number | string }[];
  } | null;
  const id = r?.message?.msgId ?? r?.attachment?.[0]?.msgId;
  return id === undefined || id === null ? undefined : String(id);
}

/** Thêm mới hoặc bổ sung `cliMsgId` cho tin đã có (khóa theo msgId). */
function upsert(threadKey: string, ref: SentMessageRef): void {
  const list = sentByThread.get(threadKey) ?? [];
  const existing = list.find((m) => m.msgId === ref.msgId);
  if (existing) {
    if (ref.cliMsgId && !existing.cliMsgId) existing.cliMsgId = ref.cliMsgId;
  } else {
    list.push(ref);
    while (list.length > MAX_PER_THREAD) list.shift();
  }
  sentByThread.set(threadKey, list);
  schedulePersist();
}

/** Ghi nhận tin bot vừa gửi. Không có msgId thì bỏ qua (không có gì để thu hồi). */
export function recordSentMessage(
  threadKey: string,
  response: unknown,
  now: number = Date.now(),
): void {
  const msgId = extractSentMsgId(response);
  if (!msgId) return;
  upsert(threadKey, { msgId, sentAt: now });
}

/**
 * Ghi nhận tin của CHÍNH MÌNH do listener báo về (cần `selfListen: true`).
 * `cliMsgId` rỗng/"0" coi như không có.
 */
export function recordSelfMessage(
  threadKey: string,
  msgId: string,
  cliMsgId: string,
  now: number = Date.now(),
): void {
  if (!msgId) return;
  const cli = cliMsgId && cliMsgId !== "0" ? cliMsgId : undefined;
  upsert(threadKey, { msgId, cliMsgId: cli, sentAt: now });
}

/** Tin bot gửi gần nhất còn trong hạn thu hồi, MỚI NHẤT TRƯỚC. */
export function recentSentMessages(
  threadKey: string,
  now: number = Date.now(),
): SentMessageRef[] {
  const list = (sentByThread.get(threadKey) ?? []).filter(
    (m) => now - m.sentAt < RECALL_WINDOW_MS,
  );
  if (list.length === 0) sentByThread.delete(threadKey);
  else sentByThread.set(threadKey, list);
  return [...list].reverse();
}

/** Bỏ một tin khỏi danh sách sau khi đã thu hồi để lần sau không thu hồi lại nó. */
export function forgetSentMessage(threadKey: string, msgId: string): void {
  const list = sentByThread.get(threadKey);
  if (!list) return;
  const next = list.filter((m) => m.msgId !== msgId);
  if (next.length === 0) sentByThread.delete(threadKey);
  else sentByThread.set(threadKey, next);
  schedulePersist();
}

/** Chỉ test dùng: xóa RAM và tắt persist */
export function resetSentMessageTracker(): void {
  sentByThread.clear();
  persistFile = undefined;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
}
