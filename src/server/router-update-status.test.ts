import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { formatRouterUpdateAlert, readRouterUpdateStatus, routerStatusLine } from "./router-update-status.js";

const base = { checkedAt: "2026-10-12T03:00:00Z", current: "0.6.0", latest: "0.6.0" };

describe("router-update-status", () => {
  it("đọc file trạng thái hợp lệ, file hỏng trả null", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "r9-"));
    const ok = path.join(dir, "ok.json");
    fs.writeFileSync(ok, JSON.stringify({ ...base, action: "none" }));
    assert.equal(readRouterUpdateStatus(ok)?.current, "0.6.0");
    const bad = path.join(dir, "bad.json");
    fs.writeFileSync(bad, "{not json");
    assert.equal(readRouterUpdateStatus(bad), null);
    assert.equal(readRouterUpdateStatus(path.join(dir, "missing.json")), null);
  });

  it("chỉ báo khi updated/failed, không báo khi none", () => {
    assert.match(formatRouterUpdateAlert({ ...base, action: "updated", from: "0.5.99" })!, /0\.5\.99 → 0\.6\.0/);
    assert.match(formatRouterUpdateAlert({ ...base, action: "failed", current: "0.5.99", error: "chat 500" })!, /THẤT BẠI[\s\S]*chat 500/);
    assert.equal(formatRouterUpdateAlert({ ...base, action: "none" }), null);
  });

  it("dòng báo cáo 8h phản ánh trạng thái", () => {
    assert.match(routerStatusLine({ ...base, action: "none" }), /v0\.6\.0 \(bản mới nhất\)/);
    assert.match(routerStatusLine({ ...base, action: "failed", current: "0.5.99" }), /có bản 0\.6\.0.*thất bại/);
    assert.match(routerStatusLine(null), /chưa có dữ liệu/);
  });
});
