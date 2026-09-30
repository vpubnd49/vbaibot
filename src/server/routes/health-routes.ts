import { Hono } from "hono";
import { collectHealthReport, formatHealthText } from "../health-report.js";

/** /api/health - Server health report */
export const healthRoutes = new Hono()
  .get("/", (c) => {
    const report = collectHealthReport();
    return c.json(report);
  })
  .get("/text", (c) => {
    const report = collectHealthReport();
    return c.text(formatHealthText(report));
  });
