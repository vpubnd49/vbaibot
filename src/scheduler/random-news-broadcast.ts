import { db } from "../conversation/database.js";
import { botTimeZone } from "../config/runtime-tuning-settings.js";
import { createJob, deleteJob, listJobsForThread } from "./scheduled-job-store.js";
import { listEnabledAccounts } from "../config/account-store.js";
import { createLogger } from "../shared/logger.js";
import type { ParsedSchedule } from "./schedule-parser.js";

const log = createLogger("random-news-broadcast");

const SETTING_KEY = "random_news_broadcast_enabled";
const JOB_PREFIX = "random-news-";

const getSettingStmt = db.prepare("SELECT value FROM runtime_settings WHERE key = ?");
const setSettingStmt = db.prepare(`
  INSERT INTO runtime_settings (key, value, updated_at)
  VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

export function isRandomNewsBroadcastEnabled(): boolean {
  const row = getSettingStmt.get(SETTING_KEY) as { value: string } | undefined;
  if (row) return row.value === "true";
  return false; // Mặc định TẮT
}

export function setRandomNewsBroadcastEnabled(enabled: boolean): void {
  setSettingStmt.run(SETTING_KEY, enabled ? "true" : "false");
}

export type SlotDefinition = {
  slot: "morning" | "afternoon" | "evening";
  label: string;
  minHour: number;
  minMinute: number;
  maxHour: number;
  maxMinute: number;
  prompt: string;
};

export const NEWS_SLOTS: SlotDefinition[] = [
  {
    slot: "morning",
    label: "Bản tin Buổi Sáng",
    minHour: 8,
    minMinute: 0,
    maxHour: 9,
    maxMinute: 30,
    prompt: `Bạn đang gửi bản tin thời sự buổi sáng trực tiếp tới nhóm chat.
QUY TẮC BẮT BUỘC:
- BẮT ĐẦU NGAY BẰNG TIÊU ĐỀ BẢN TIN (ví dụ: "🔥 ĐIỂM TIN THỜI SỰ BUỔI SÁNG" kèm ngày hôm nay).
- TUYỆT ĐỐI KHÔNG viết bất kỳ câu suy nghĩ nội tâm hay lời dẫn dắt nào (như "Đã có dữ liệu...", "Tôi sẽ soạn bản tin...", "Đang tra cứu...").
- BẮT BUỘC mỗi bản tin phải có phong cách, cách mở đầu, cấu trúc trình bày KHÁC NHAU so với những bản tin trước — KHÔNG ĐƯỢC rập khuôn cùng một kiểu tiêu đề, cùng một bố cục, cùng cách chào hỏi mỗi ngày. Hãy sáng tạo!

NỘI DUNG BẢN TIN (sử dụng news_lookup hoặc web_search để lấy tin mới nhất hôm nay):
1) 🌲 TIÊU ĐIỂM LÂM ĐỒNG: 1-2 tin tức nổi bật nhất về kinh tế, nông nghiệp, du lịch, giao thông, chỉ đạo điều hành của tỉnh Lâm Đồng.
2) 📈 KINH TẾ & THỊ TRƯỜNG: Điểm tin khởi động phiên giao dịch, tài chính, đầu tư, chính sách mới.
3) 🛡️ XÃ HỘI & AN NINH QUỐC PHÒNG: Tin tức thời sự quan trọng trong nước.
4) 💡 GÓC NHÌN CÔNG NGHỆ: {{TECH_FOCUS}}

Trình bày dạng bullet points ngắn gọn, súc tích, có emoji sinh động, dễ đọc trên điện thoại. Cuối bản tin ghi nguồn trích dẫn.`,
  },
  {
    slot: "afternoon",
    label: "Bản tin Buổi Chiều",
    minHour: 13,
    minMinute: 30,
    maxHour: 15,
    maxMinute: 0,
    prompt: `Bạn đang gửi bản tin cập nhật thời sự buổi chiều trực tiếp tới nhóm chat.
QUY TẮC BẮT BUỘC:
- BẮT ĐẦU NGAY BẰNG TIÊU ĐỀ BẢN TIN (ví dụ: "⚡ CẬP NHẬT TIN NÓNG BUỔI CHIỀU" kèm ngày hôm nay).
- TUYỆT ĐỐI KHÔNG viết câu dẫn dắt hay suy nghĩ nội tâm nào trước bản tin.
- BẮT BUỘC mỗi bản tin phải có phong cách, cách mở đầu, cấu trúc trình bày KHÁC NHAU — sáng tạo cách viết, KHÔNG rập khuôn!

NỘI DUNG BẢN TIN (sử dụng news_lookup hoặc web_search để lấy tin nóng vừa diễn ra):
1) 🌲 DIỄN BIẾN MỚI TẠI LÂM ĐỒNG: Tin tức thời sự, sự kiện, đời sống xã hội diễn ra trong ngày tại địa phương.
2) 📊 THỊ TRƯỜNG & KINH DOANH: Cập nhật diễn biến kinh tế, thị trường tài chính phiên sáng/đầu chiều.
3) 🌐 THỜI SỰ NÓNG TRONG NƯỚC & QUỐC TẾ: Các sự kiện an ninh, trật tự, xã hội, công nghệ đáng chú ý nhất.

Trình bày ngắn gọn, sắc nét, có emoji phân loại, dễ đọc trên điện thoại. Cuối bản tin ghi nguồn.`,
  },
  {
    slot: "evening",
    label: "Bản tin Buổi Tối",
    minHour: 19,
    minMinute: 30,
    maxHour: 21,
    maxMinute: 0,
    prompt: `Bạn đang gửi bản tin tổng hợp tiêu điểm buổi tối trực tiếp tới nhóm chat.
QUY TẮC BẮT BUỘC:
- BẮT ĐẦU NGAY BẰNG TIÊU ĐỀ BẢN TIN (ví dụ: "🌙 TỔNG KẾT TIÊU ĐIỂM NGÀY" kèm ngày hôm nay).
- TUYỆT ĐỐI KHÔNG viết bất kỳ câu dẫn dắt nào trước tiêu đề.
- BẮT BUỘC mỗi bản tin phải có phong cách, cách mở đầu, cấu trúc trình bày KHÁC NHAU — sáng tạo cách viết, KHÔNG rập khuôn!

NỘI DUNG BẢN TIN (sử dụng news_lookup hoặc web_search để tổng hợp tiêu điểm trong ngày):
1) 🌲 TIÊU ĐIỂM NỔI BẬT LÂM ĐỒNG: Tổng hợp sự kiện, văn hóa, đời sống xã hội tiêu biểu trong ngày tại Lâm Đồng.
2) 🏆 VĂN HÓA & THỂ THAO: Điểm tin thể thao trong nước/quốc tế, sự kiện văn hóa nghệ thuật hot.
3) 🌍 TIÊU ĐIỂM TOÀN CẢNH: 2-3 tin tức lớn nhất trong ngày về kinh tế, chính sách, khoa học công nghệ.
4) Lời chúc buổi tối thư giãn, an lành tới mọi người trong nhóm.

Trình bày mạch lạc, súc tích, đẹp mắt trên điện thoại. Cuối bản tin ghi nguồn.`,
  },
];

/**
 * Danh sách các góc nhìn công nghệ xoay vòng ngẫu nhiên.
 * Mỗi nhóm, mỗi ngày được chọn 1 góc nhìn khác nhau thay vì luôn là
 * "chuyển đổi số, CNTT" → tránh mọi nhóm đều nhận tin 5G giống nhau.
 */
const TECH_FOCUS_POOL = [
  "Trí tuệ nhân tạo (AI), ứng dụng GenAI trong công việc và đời sống — tránh lặp tin 5G/viễn thông.",
  "An toàn thông tin, cảnh báo lừa đảo trực tuyến, bảo mật tài khoản ngân hàng, email.",
  "Chuyển đổi số doanh nghiệp, dịch vụ công trực tuyến, hóa đơn điện tử, ứng dụng Chính phủ số.",
  "Nông nghiệp thông minh, công nghệ xanh, năng lượng tái tạo, bảo vệ môi trường.",
  "Xu hướng thiết bị công nghệ tiêu dùng mới nhất, mẹo công nghệ hữu ích hàng ngày.",
  "Giáo dục số, EdTech, học trực tuyến, ứng dụng công nghệ trong trường học.",
  "Thương mại điện tử, fintech, thanh toán không tiền mặt, ví điện tử, ngân hàng số.",
  "Phần mềm và ứng dụng mới hữu ích cho công việc văn phòng, quản lý dự án, tăng năng suất.",
  "Y tế số, telemedicine, ứng dụng công nghệ trong chăm sóc sức khỏe cộng đồng.",
  "Hạ tầng số, viễn thông, mạng 5G, vệ tinh, cáp quang — chọn tin CỤ THỂ, TRÁNH lặp tin cũ đã quen.",
];

/** Chọn ngẫu nhiên 1 chủ đề công nghệ */
function pickRandomTechFocus(): string {
  return TECH_FOCUS_POOL[Math.floor(Math.random() * TECH_FOCUS_POOL.length)]!;
}

/** Thay {{TECH_FOCUS}} trong prompt bằng chủ đề ngẫu nhiên */
function resolvePromptVariables(prompt: string): string {
  return prompt.replace("{{TECH_FOCUS}}", pickRandomTechFocus());
}

/**
 * Sinh số ngẫu nhiên trong khoảng [min, max]
 */
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sinh giờ ngẫu nhiên (dạng cron minute hour) cho 1 slot
 */
export function generateRandomTimeForSlot(slot: SlotDefinition): { hour: number; minute: number; cronExpr: string } {
  const minTotalMinutes = slot.minHour * 60 + slot.minMinute;
  const maxTotalMinutes = slot.maxHour * 60 + slot.maxMinute;
  const randomMinutes = getRandomInt(minTotalMinutes, maxTotalMinutes);

  const hour = Math.floor(randomMinutes / 60);
  const minute = randomMinutes % 60;
  const cronExpr = `${minute} ${hour} * * *`;

  return { hour, minute, cronExpr };
}

/**
 * Đồng bộ các scheduled jobs ngẫu nhiên cho tất cả các nhóm của 1 account
 */
export function syncRandomNewsJobs(accountId: string): void {
  if (!isRandomNewsBroadcastEnabled()) {
    log.info({ accountId }, "Random news broadcast đang tắt - bỏ qua sync");
    return;
  }

  const stmt = db.prepare(
    "SELECT thread_id FROM threads WHERE account_id = ? AND bot_enabled = 1 AND thread_type = 1"
  );
  const rows = stmt.all(accountId) as { thread_id: string }[];

  let synced = 0;

  for (const slotDef of NEWS_SLOTS) {
    for (const row of rows) {
      // Sinh giờ ngẫu nhiên RIÊNG cho từng nhóm — trước đây nằm ngoài vòng lặp
      // khiến tất cả nhóm cùng chạy đúng 1 giờ, nhận cùng 1 kết quả RSS.
      const { cronExpr, hour, minute } = generateRandomTimeForSlot(slotDef);
      const threadId = row.thread_id;
      const jobName = `${JOB_PREFIX}${slotDef.slot}-${threadId}`;

      const jobs = listJobsForThread(accountId, threadId);
      const existingJob = jobs.find((j) => j.name === jobName);

      // Nếu chưa có job thì tạo mới
      if (!existingJob) {
        const schedule: ParsedSchedule = { kind: "cron", expr: cronExpr, timeZone: botTimeZone() };
        createJob({
          accountId,
          threadId,
          threadType: 1,
          name: jobName,
          kind: "agent",
          payload: resolvePromptVariables(slotDef.prompt),
          schedule,
          createdBy: "system",
        });
        log.info({ slot: slotDef.slot, threadId, time: `${hour}:${minute.toString().padStart(2, "0")}` }, "Tạo job bản tin cho nhóm");
        synced++;
      }
    }
  }

  if (synced > 0) {
    log.info({ accountId, synced, totalGroups: rows.length }, "Đã đồng bộ các job bản tin ngẫu nhiên cho nhóm");
  }
}

/**
 * Tái sinh thời gian ngẫu nhiên hàng ngày cho tất cả các nhóm (gọi mỗi ngày lúc 00:05)
 */
export function refreshDailyRandomNewsSchedules(accountId: string): void {
  if (!isRandomNewsBroadcastEnabled()) return;

  const stmt = db.prepare(
    "SELECT thread_id FROM threads WHERE account_id = ? AND bot_enabled = 1 AND thread_type = 1"
  );
  const rows = stmt.all(accountId) as { thread_id: string }[];

  for (const slotDef of NEWS_SLOTS) {
    for (const row of rows) {
      const { cronExpr } = generateRandomTimeForSlot(slotDef);
      const threadId = row.thread_id;
      const jobName = `${JOB_PREFIX}${slotDef.slot}-${threadId}`;

      const jobs = listJobsForThread(accountId, threadId);
      const existingJob = jobs.find((j) => j.name === jobName);

      if (existingJob) {
        deleteJob(accountId, threadId, existingJob.id);
      }

      const schedule: ParsedSchedule = { kind: "cron", expr: cronExpr, timeZone: botTimeZone() };
      createJob({
        accountId,
        threadId,
        threadType: 1,
        name: jobName,
        kind: "agent",
        payload: resolvePromptVariables(slotDef.prompt),
        schedule,
        createdBy: "system",
      });
    }
  }

  log.info({ accountId }, "Đã tái sinh mốc giờ ngẫu nhiên cho ngày mới");
}

export function syncAllAccountsRandomNews(): void {
  const accounts = listEnabledAccounts();
  for (const acc of accounts) {
    syncRandomNewsJobs(acc.id);
  }
}

export function removeAllRandomNewsJobs(accountId: string): void {
  const stmt = db.prepare(
    "SELECT thread_id FROM threads WHERE account_id = ? AND thread_type = 1"
  );
  const rows = stmt.all(accountId) as { thread_id: string }[];

  let removed = 0;
  for (const row of rows) {
    const threadId = row.thread_id;
    const jobs = listJobsForThread(accountId, threadId);

    for (const job of jobs) {
      if (job.name.startsWith(JOB_PREFIX)) {
        deleteJob(accountId, threadId, job.id);
        removed++;
      }
    }
  }

  if (removed > 0) {
    log.info({ accountId, removed }, "Đã xóa toàn bộ job bản tin ngẫu nhiên");
  }
}
