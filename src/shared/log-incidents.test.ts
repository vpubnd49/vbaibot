import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { clearIncidentCache, listIncidents, listLogDays } from "./log-incidents.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vbai-incidents-"));
const T0 = Date.parse("2026-10-08T10:00:00Z");
const line = (o: Record<string, unknown>) => JSON.stringify({ pid: 1, hostname: "h", ...o });

describe("log-incidents", () => {
  beforeEach(() => {
    clearIncidentCache();
    for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
    fs.writeFileSync(
      path.join(dir, "bot.2026-10-08.1.log"),
      [
        line({ level: 30, time: T0, scope: "a", msg: "info bỏ qua" }),
        line({ level: 40, time: T0 + 1000, scope: "rss", msg: "feed chậm" }),
        line({ level: 50, time: T0 + 2000, scope: "agent", msg: "lỗi gọi model", accountId: "acc-1", err: { message: "timeout" } }),
        "{dòng hỏng",
        line({ level: 60, time: T0 + 3000, scope: "boot", msg: "chết" }),
      ].join("\n"),
    );
    fs.writeFileSync(path.join(dir, "pm2-out.log"), line({ level: 50, time: T0, scope: "x", msg: "không đọc file pm2" }));
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("chỉ lấy warn trở lên, mới nhất trước, bỏ dòng hỏng và file không phải bot.*", () => {
    const r = listIncidents(dir, T0 - 1, T0 + 10_000);
    assert.deepEqual(r.map((i) => i.level), [60, 50, 40]);
    assert.equal(r[1]!.accountId, "acc-1");
    assert.equal(r[1]!.detail, "timeout");
  });

  it("lọc đúng khoảng thời gian [since, until)", () => {
    const r = listIncidents(dir, T0 + 1500, T0 + 3000);
    assert.deepEqual(r.map((i) => i.msg), ["lỗi gọi model"]);
  });

  it("file thêm dòng mới thì cache tự đọc lại", () => {
    assert.equal(listIncidents(dir, T0 - 1, T0 + 99_999).length, 3);
    fs.appendFileSync(path.join(dir, "bot.2026-10-08.1.log"), "\n" + line({ level: 50, time: T0 + 5000, scope: "z", msg: "mới" }));
    assert.equal(listIncidents(dir, T0 - 1, T0 + 99_999).length, 4);
  });

  it("thư mục không tồn tại không làm crash", () => {
    assert.deepEqual(listIncidents(path.join(dir, "khong-co"), 0), []);
    assert.deepEqual(listLogDays(path.join(dir, "khong-co")), []);
  });

  it("listLogDays đọc ngày từ tên file", () => {
    assert.deepEqual(listLogDays(dir), ["2026-10-08"]);
  });
});
