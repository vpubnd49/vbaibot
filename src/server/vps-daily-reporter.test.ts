import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDailyVpsReportText, sendDailyVpsReportNow } from "./vps-daily-reporter.js";

describe("vps-daily-reporter", () => {
  it("soạn được nội dung báo cáo VPS định kỳ đầy đủ cấu trúc", async () => {
    const text = await buildDailyVpsReportText();
    assert.ok(typeof text === "string");
    assert.match(text, /BÁO CÁO HỆ THỐNG ĐỊNH KỲ/);
    assert.match(text, /Hạ tầng VPS/);
    assert.match(text, /Trạng thái Zalo Bot/);
    assert.match(text, /Việc sắp tới/);
  });

  it("sendDailyVpsReportNow trả về đối tượng kết quả an toàn", async () => {
    const res = await sendDailyVpsReportNow();
    assert.ok("ok" in res);
    assert.ok("message" in res);
  });
});
