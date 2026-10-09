import { Hono } from "hono";
import { getHomeSummary } from "../home-summary.js";
import { addDays, getJournalDays, isDateKey } from "../journal-days.js";
import { getJournalEvents } from "../journal-events.js";
import { getReport } from "../report-summary.js";
import { sendDailyVpsReportNow } from "../vps-daily-reporter.js";

/**
 * Trang chủ / Báo cáo / Nhật ký kiểu "chủ bot xem nhanh" (mobile-first).
 */
export const homeRoutes = new Hono()
  .get("/home", async (c) => c.json(await getHomeSummary()))
  .get("/reports", (c) => c.json(getReport(Number(c.req.query("days")))))
  .post("/reports/send-vps-report", async (c) => {
    const res = await sendDailyVpsReportNow();
    return c.json(res, res.ok ? 200 : 400);
  })
  .get("/journal", (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (!isDateKey(from)) return c.json({ error: "Thiếu hoặc sai 'from' (YYYY-MM-DD)" }, 400);
    return c.json(getJournalDays(from, isDateKey(to) ? to : addDays(from, 30)));
  })
  .get("/journal/events", (c) => {
    const date = c.req.query("date");
    if (!isDateKey(date)) return c.json({ error: "Thiếu hoặc sai 'date' (YYYY-MM-DD)" }, 400);
    return c.json({ date, events: getJournalEvents(date) });
  });

