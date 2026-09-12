import { getTuning } from "../config/runtime-tuning-settings.js";

// Gửi tuần tự theo từng thread + delay ngẫu nhiên trước mỗi lần gửi.
// Mục đích: hành vi giống người, giảm nguy cơ Zalo đánh dấu spam.

const queues = new Map<string, Promise<unknown>>();

/**
 * Số lượt "đang gửi một chuỗi tin" của mỗi thread, tách hẳn khỏi `queues`.
 *
 * Vì sao cần bộ đếm riêng: `sendReplyInParts` xếp hàng TỪNG đoạn một (await
 * xong đoạn này mới xếp đoạn kế), nên ngay sau khi đoạn 1 gửi xong thì `release`
 * đã xóa entry khỏi `queues` - trong khi chuỗi tin VẪN CHƯA gửi hết. Một
 * `dangGuiTren()` hỏi `queues.has()` lúc đó trả `false` đúng vào khe hở mà nó
 * sinh ra để bịt. Bộ đếm này sống suốt cả chuỗi, không nhấp nháy giữa các đoạn.
 */
const dangGuiChuoi = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function randomSendDelay(): number {
  const range = getTuning("SEND_DELAY_MAX_MS") - getTuning("SEND_DELAY_MIN_MS");
  return getTuning("SEND_DELAY_MIN_MS") + Math.floor(Math.random() * (range + 1));
}

export function enqueueSend<T>(threadKey: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(threadKey) ?? Promise.resolve();
  const run = previous.then(async () => {
    await sleep(randomSendDelay());
    return task();
  });

  // Giữ queue sống kể cả khi task lỗi (lỗi vẫn ném về caller của run). Xóa entry
  // khi thread gửi xong hết: bot thường trú gặp hàng nghìn thread, giữ lại mỗi
  // thread 1 promise đã settled là rò rỉ bộ nhớ chậm.
  let tail: Promise<unknown>;
  const release = (): void => {
    if (queues.get(threadKey) === tail) queues.delete(threadKey);
  };
  tail = run.then(release, release);
  queues.set(threadKey, tail);

  return run;
}

/** Số thread đang có việc gửi - dùng cho test rò rỉ bộ nhớ */
export function pendingSendThreadCount(): number {
  return queues.size;
}

/**
 * Thread này đang có tin nào đang gửi/chờ gửi không.
 *
 * Dùng để KHÔNG chen một tin phụ vào giữa chuỗi tin của một câu trả lời đang
 * được cắt làm nhiều đoạn. `sendReplyInParts` xếp hàng TỪNG đoạn một (await
 * xong đoạn này mới xếp đoạn kế), nên giữa hai đoạn hàng đợi rỗng và bất kỳ
 * `enqueueSend` nào khác chèn vào được - người nhắn thấy câu trả lời bị cắt đôi
 * bởi một tin không liên quan.
 */
export function dangGuiTren(threadKey: string): boolean {
  return queues.has(threadKey) || (dangGuiChuoi.get(threadKey) ?? 0) > 0;
}

/** Đánh dấu bắt đầu/kết thúc một chuỗi reply gồm nhiều đoạn. */
export function batDauGuiChuoi(threadKey: string): void {
  dangGuiChuoi.set(threadKey, (dangGuiChuoi.get(threadKey) ?? 0) + 1);
}

export function ketThucGuiChuoi(threadKey: string): void {
  const count = (dangGuiChuoi.get(threadKey) ?? 0) - 1;
  if (count > 0) dangGuiChuoi.set(threadKey, count);
  else dangGuiChuoi.delete(threadKey);
}

/** Dùng cho test/observability; không bao gồm queue đơn lẻ. */
export function pendingReplySequenceCount(): number {
  return dangGuiChuoi.size;
}

/** Xóa trạng thái test/runtime khi cần đóng module. */
export function clearReplySequenceState(): void {
  dangGuiChuoi.clear();
}
