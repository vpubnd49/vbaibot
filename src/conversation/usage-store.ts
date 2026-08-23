import {
  dayKeyOf,
  monthKeyOf,
  startOfDayUtc,
  startOfMonthUtc,
  startOfWeekUtc,
  startOfYearUtc,
  weekKeyOf,
  yearKeyOf,
} from "../shared/zone-time.js";
import { db } from "./database.js";

export type AgentTurnUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  steps: number;
};

/** 'message' = trả lời tin nhắn tới; 'schedule' = job lịch hẹn tự chạy (không ai đang chờ) */
export type AgentTurnSource = "message" | "schedule";

const openStmt = db.prepare(`
  INSERT INTO agent_turns (account_id, thread_id, source) VALUES (?, ?, ?)
`);

const finishStmt = db.prepare(`
  UPDATE agent_turns
  SET input_tokens = ?, output_tokens = ?, total_tokens = ?, steps = ?
  WHERE id = ?
`);

/**
 * Mở 1 lượt agent và lấy id NGAY, trước khi lượt chạy.
 *
 * Trước đây row chỉ được ghi SAU khi lượt xong, kéo theo hai lỗ:
 * - Lượt ném lỗi không có id nên trace của các step đã chạy bị vứt: lượt chạy
 *   tốt 5 step rồi step 6 gặp 500 là mất sạch phần chẩn đoán được.
 * - Không có id thì log trong lượt không mang nổi correlation id, hai lượt liên
 *   tiếp cùng thread trộn vào nhau và chỉ phân biệt được bằng timestamp.
 *
 * Cột số đều có DEFAULT 0 nên row mở ra là hợp lệ ngay. Process bị kill giữa
 * lượt để lại row 0 token không trace: trang Trace tự lọc (INNER JOIN sang
 * agent_steps), Overview đếm thừa 1 lượt - chấp nhận được, đổi lấy việc lượt
 * hỏng không còn vô hình.
 *
 * `source` mặc định 'message' để MỌI lời gọi hiện có (trước khi có scheduler)
 * không phải sửa gì cả - chỉ lượt do job lịch hẹn tự bắn mới cần truyền 'schedule'.
 */
export function openAgentTurn(
  accountId: string,
  threadId: string,
  source: AgentTurnSource = "message",
): number {
  return Number(openStmt.run(accountId, threadId, source).lastInsertRowid);
}

/**
 * Chốt usage khi lượt xong - nguồn cho cột Context màn Sessions + thống kê chi phí.
 * Lượt ném lỗi vẫn nên gọi (với số đo được tới lúc hỏng) để row không nằm lại ở 0.
 */
export function finishAgentTurn(turnId: number, usage: AgentTurnUsage): void {
  finishStmt.run(usage.inputTokens, usage.outputTokens, usage.totalTokens, usage.steps, turnId);
}

const threadTotalsStmt = db.prepare(`
  SELECT COUNT(*) AS turns, COALESCE(SUM(total_tokens), 0) AS total_tokens
  FROM agent_turns WHERE account_id = ? AND thread_id = ?
`);

export function getThreadUsageTotals(
  accountId: string,
  threadId: string,
): { turns: number; totalTokens: number } {
  const row = threadTotalsStmt.get(accountId, threadId) as { turns: number; total_tokens: number };
  return { turns: row.turns, totalTokens: row.total_tokens };
}

// Trước đây gom bằng `substr(created_at, 1, 10)` ngay trong SQL - tức theo
// NGÀY UTC, lệch 7 tiếng so với ngày VN mà dashboard muốn hiển thị. SQLite
// không biết timezone nên không thể sửa bằng SQL thuần túy (offset cứng
// `datetime(created_at, '+7 hours')` lại sai với zone có DST). Giải pháp: câu
// SQL chỉ còn lo phần nó làm tốt - CHẶN PHẠM VI QUÉT bằng `created_at >= ?` -
// còn việc gộp theo ngày chuyển hẳn sang JS bằng `dayKeyOf` (qua luxon).
// Chi phí chấp nhận được: cửa sổ 7 ngày trên Overview chỉ vài chục dòng.
const dailySinceStmt = db.prepare(`
  SELECT created_at, input_tokens, output_tokens, total_tokens
  FROM agent_turns
  WHERE account_id = ? AND created_at >= ?
  ORDER BY created_at ASC
`);

/**
 * Thống kê theo ngày (theo `timeZone`, không phải UTC) từ mốc `sinceUtcIso` -
 * cho trang Overview. `sinceUtcIso` nên tính bằng `startOfDayUtc` lùi N ngày
 * để không lọt mất giờ đầu ngày VN (xem `overview-routes.ts`).
 */
export function getDailyUsage(
  accountId: string,
  sinceUtcIso: string,
  timeZone: string,
): { day: string; turns: number; inputTokens: number; outputTokens: number }[] {
  type Row = { created_at: string; input_tokens: number; output_tokens: number };
  const rows = dailySinceStmt.all(accountId, sinceUtcIso) as unknown as Row[];

  const byDay = new Map<string, { turns: number; inputTokens: number; outputTokens: number }>();
  for (const r of rows) {
    const day = dayKeyOf(r.created_at, timeZone);
    const agg = byDay.get(day) ?? { turns: 0, inputTokens: 0, outputTokens: 0 };
    agg.turns += 1;
    agg.inputTokens += r.input_tokens;
    agg.outputTokens += r.output_tokens;
    byDay.set(day, agg);
  }

  // Giữ nguyên thứ tự DESC (mới nhất trước) như hành vi cũ của câu SQL
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, agg]) => ({ day, ...agg }));
}

// ─── Thống kê Token theo Ngày / Tuần / Tháng / Năm ──────────────────────────

export type TokenMetric = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  turns: number;
};

export type TokenSummary = {
  today: TokenMetric;
  thisWeek: TokenMetric;
  thisMonth: TokenMetric;
  thisYear: TokenMetric;
  allTime: TokenMetric;
};

const tokenSummaryStmt = db.prepare(`
  SELECT
    COALESCE(SUM(CASE WHEN created_at >= ? THEN input_tokens ELSE 0 END), 0) AS today_input,
    COALESCE(SUM(CASE WHEN created_at >= ? THEN output_tokens ELSE 0 END), 0) AS today_output,
    COALESCE(SUM(CASE WHEN created_at >= ? THEN total_tokens ELSE 0 END), 0) AS today_total,
    COUNT(CASE WHEN created_at >= ? THEN 1 END) AS today_turns,

    COALESCE(SUM(CASE WHEN created_at >= ? THEN input_tokens ELSE 0 END), 0) AS week_input,
    COALESCE(SUM(CASE WHEN created_at >= ? THEN output_tokens ELSE 0 END), 0) AS week_output,
    COALESCE(SUM(CASE WHEN created_at >= ? THEN total_tokens ELSE 0 END), 0) AS week_total,
    COUNT(CASE WHEN created_at >= ? THEN 1 END) AS week_turns,

    COALESCE(SUM(CASE WHEN created_at >= ? THEN input_tokens ELSE 0 END), 0) AS month_input,
    COALESCE(SUM(CASE WHEN created_at >= ? THEN output_tokens ELSE 0 END), 0) AS month_output,
    COALESCE(SUM(CASE WHEN created_at >= ? THEN total_tokens ELSE 0 END), 0) AS month_total,
    COUNT(CASE WHEN created_at >= ? THEN 1 END) AS month_turns,

    COALESCE(SUM(CASE WHEN created_at >= ? THEN input_tokens ELSE 0 END), 0) AS year_input,
    COALESCE(SUM(CASE WHEN created_at >= ? THEN output_tokens ELSE 0 END), 0) AS year_output,
    COALESCE(SUM(CASE WHEN created_at >= ? THEN total_tokens ELSE 0 END), 0) AS year_total,
    COUNT(CASE WHEN created_at >= ? THEN 1 END) AS year_turns,

    COALESCE(SUM(input_tokens), 0) AS all_input,
    COALESCE(SUM(output_tokens), 0) AS all_output,
    COALESCE(SUM(total_tokens), 0) AS all_total,
    COUNT(*) AS all_turns
  FROM agent_turns
  WHERE account_id = ?
`);

/**
 * Thống kê tổng hợp số lượng token và lượt theo: Hôm nay, Tuần này, Tháng này, Năm này, Toàn thời gian.
 */
export function getTokenSummary(
  accountId: string,
  timeZone: string,
  now: Date = new Date(),
): TokenSummary {
  const startToday = startOfDayUtc(timeZone, now);
  const startWeek = startOfWeekUtc(timeZone, now);
  const startMonth = startOfMonthUtc(timeZone, now);
  const startYear = startOfYearUtc(timeZone, now);

  type Raw = {
    today_input: number;
    today_output: number;
    today_total: number;
    today_turns: number;
    week_input: number;
    week_output: number;
    week_total: number;
    week_turns: number;
    month_input: number;
    month_output: number;
    month_total: number;
    month_turns: number;
    year_input: number;
    year_output: number;
    year_total: number;
    year_turns: number;
    all_input: number;
    all_output: number;
    all_total: number;
    all_turns: number;
  };

  const row = tokenSummaryStmt.get(
    startToday,
    startToday,
    startToday,
    startToday,
    startWeek,
    startWeek,
    startWeek,
    startWeek,
    startMonth,
    startMonth,
    startMonth,
    startMonth,
    startYear,
    startYear,
    startYear,
    startYear,
    accountId,
  ) as Raw;

  return {
    today: {
      inputTokens: row.today_input,
      outputTokens: row.today_output,
      totalTokens: row.today_total,
      turns: row.today_turns,
    },
    thisWeek: {
      inputTokens: row.week_input,
      outputTokens: row.week_output,
      totalTokens: row.week_total,
      turns: row.week_turns,
    },
    thisMonth: {
      inputTokens: row.month_input,
      outputTokens: row.month_output,
      totalTokens: row.month_total,
      turns: row.month_turns,
    },
    thisYear: {
      inputTokens: row.year_input,
      outputTokens: row.year_output,
      totalTokens: row.year_total,
      turns: row.year_turns,
    },
    allTime: {
      inputTokens: row.all_input,
      outputTokens: row.all_output,
      totalTokens: row.all_total,
      turns: row.all_turns,
    },
  };
}

export type UsageGranularity = "day" | "week" | "month" | "year";

export type GroupedUsageItem = {
  periodKey: string;
  label: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

/**
 * Thống kê chuỗi thời gian gom nhóm theo Ngày, Tuần, Tháng, Năm.
 */
export function getGroupedUsage(
  accountId: string,
  granularity: UsageGranularity,
  sinceUtcIso: string,
  timeZone: string,
): GroupedUsageItem[] {
  type Row = { created_at: string; input_tokens: number; output_tokens: number; total_tokens: number };
  const rows = dailySinceStmt.all(accountId, sinceUtcIso) as unknown as Row[];

  const byPeriod = new Map<
    string,
    { label: string; turns: number; inputTokens: number; outputTokens: number; totalTokens: number }
  >();

  for (const r of rows) {
    let key: string;
    let label: string;
    if (granularity === "day") {
      key = dayKeyOf(r.created_at, timeZone);
      label = key;
    } else if (granularity === "week") {
      const w = weekKeyOf(r.created_at, timeZone);
      key = w.key;
      label = w.label;
    } else if (granularity === "month") {
      const m = monthKeyOf(r.created_at, timeZone);
      key = m.key;
      label = m.label;
    } else {
      const y = yearKeyOf(r.created_at, timeZone);
      key = y.key;
      label = y.label;
    }

    const agg = byPeriod.get(key) ?? {
      label,
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    agg.turns += 1;
    agg.inputTokens += r.input_tokens;
    agg.outputTokens += r.output_tokens;
    agg.totalTokens += r.input_tokens + r.output_tokens;
    byPeriod.set(key, agg);
  }

  // Sắp xếp tăng dần theo thời gian cho hiển thị biểu đồ & bảng
  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodKey, agg]) => ({ periodKey, ...agg }));
}

