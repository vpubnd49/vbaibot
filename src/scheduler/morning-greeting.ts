import { db } from "../conversation/database.js";
import { botTimeZone } from "../config/runtime-tuning-settings.js";
import { createJob, deleteJob, listJobsForThread } from "./scheduled-job-store.js";
import { listEnabledAccounts } from "../config/account-store.js";
import { createLogger } from "../shared/logger.js";
import type { ParsedSchedule } from "./schedule-parser.js";

const log = createLogger("morning-greeting");

const SETTING_KEY = "morning_greeting_enabled";
export const MORNING_GREETING_CRON = "30 6 * * *"; // 6:30 AM mỗi ngày

const getSettingStmt = db.prepare("SELECT value FROM runtime_settings WHERE key = ?");
const setSettingStmt = db.prepare(`
  INSERT INTO runtime_settings (key, value, updated_at)
  VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

export function isMorningGreetingEnabled(): boolean {
  const row = getSettingStmt.get(SETTING_KEY) as { value: string } | undefined;
  if (row) return row.value === "true";
  return false; // Mặc định TẮT
}

export function setMorningGreetingEnabled(enabled: boolean): void {
  setSettingStmt.run(SETTING_KEY, enabled ? "true" : "false");
}

const GREETING_PROMPT = `Bạn đang gửi tin nhắn chào buổi sáng trực tiếp tới nhóm chat.
QUY TẮC BẮT BUỘC:
- BẮT ĐẦU NGAY BẰNG LỜI CHÀO (ví dụ: "🌅 CHÀO BUỔI SÁNG CẢ NHÀ!" hoặc "☀️ Chào buổi sáng mọi người!").
- TUYỆT ĐỐI KHÔNG viết bất kỳ câu dẫn dắt, suy nghĩ, hay thông báo chuẩn bị nào trước lời chào (như "Đã có đầy đủ dữ liệu...", "Tôi sẽ soạn bản tin...", "Đang tra cứu...").

NỘI DUNG BẢN TIN:
1) Lời chào buổi sáng thật năng lượng, thân thiện, có emoji vui tươi phù hợp với nhóm.
2) Dự báo thời tiết hôm nay theo thời gian thực (tra cứu bằng weather_lookup).
3) Điểm nhanh 1-2 tin tức thời sự/kinh tế nổi bật hoặc giá vàng/ngoại tệ hôm nay nếu phù hợp.
4) Lời chúc ngày mới làm việc tràn đầy hứng khởi, may mắn và đạt nhiều thành công.

Trình bày ngắn gọn, súc tích, đẹp mắt, dễ đọc trên điện thoại.`;

const GREETING_NAME_PREFIX = "morning-greeting-";

export function syncMorningGreetingJobs(accountId: string): void {
  if (!isMorningGreetingEnabled()) {
    log.info({ accountId }, "Morning greeting đang tắt - bỏ qua sync");
    return;
  }

  const stmt = db.prepare(
    "SELECT thread_id FROM threads WHERE account_id = ? AND bot_enabled = 1 AND thread_type = 1"
  );
  const rows = stmt.all(accountId) as { thread_id: string }[];

  let synced = 0;
  for (const row of rows) {
    const threadId = row.thread_id;
    const name = `${GREETING_NAME_PREFIX}${threadId}`;

    const jobs = listJobsForThread(accountId, threadId);
    const existingJob = jobs.find((j) => j.name.startsWith(GREETING_NAME_PREFIX));

    // Nếu đã có job nhưng cron expression khác 6:30 -> xóa tạo lại để cập nhật
    if (existingJob) {
      if (existingJob.cronExpr !== MORNING_GREETING_CRON || existingJob.payload !== GREETING_PROMPT) {
        deleteJob(accountId, threadId, existingJob.id);
      } else {
        continue; // Đã đúng lịch 6:30 và nội dung, giữ nguyên
      }
    }

    const schedule: ParsedSchedule = { kind: "cron", expr: MORNING_GREETING_CRON, timeZone: botTimeZone() };
    createJob({
      accountId,
      threadId,
      threadType: 1,
      name,
      kind: "agent",
      payload: GREETING_PROMPT,
      schedule,
      createdBy: "system",
    });
    synced++;
  }

  if (synced > 0) {
    log.info({ accountId, synced, totalGroups: rows.length }, `Đã đồng bộ job chào sáng 6:30 cho các nhóm`);
  }
}

export function syncAllAccountsMorningGreeting(): void {
  const accounts = listEnabledAccounts();
  for (const acc of accounts) {
    syncMorningGreetingJobs(acc.id);
  }
}

export function removeMorningGreetingJobs(accountId: string): void {
  const stmt = db.prepare(
    "SELECT thread_id FROM threads WHERE account_id = ? AND thread_type = 1"
  );
  const rows = stmt.all(accountId) as { thread_id: string }[];

  let removed = 0;
  for (const row of rows) {
    const threadId = row.thread_id;
    const jobs = listJobsForThread(accountId, threadId);

    for (const job of jobs) {
      if (job.name.startsWith(GREETING_NAME_PREFIX)) {
        deleteJob(accountId, threadId, job.id);
        removed++;
      }
    }
  }

  if (removed > 0) {
    log.info({ accountId, removed }, "Đã xóa tất cả job chào sáng");
  }
}
