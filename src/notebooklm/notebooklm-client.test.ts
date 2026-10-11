import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../shared/test-env-setup.js";

/**
 * Client KHÔNG được throw (tool không bao giờ throw) và phải dịch lỗi máy chủ
 * ra câu người dùng hiểu được.
 */

let dataDir: string;
let client: typeof import("./notebooklm-client.js");
let database: typeof import("../conversation/database.js");
const realFetch = globalThis.fetch;

before(async () => {
  dataDir = setupTestEnv({});
  client = await import("./notebooklm-client.js");
  database = await import("../conversation/database.js");
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

after(() => {
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

const json = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("notebooklm-client", () => {
  it("lấy data từ envelope {success,data}", async () => {
    globalThis.fetch = json({ success: true, data: { authenticated: true } });
    const r = await client.nlmHealth();
    assert.deepEqual(r, { ok: true, data: { authenticated: true } });
  });

  it("success:false -> ok:false kèm lỗi của máy chủ", async () => {
    globalThis.fetch = json({ success: false, error: "No notebook URL provided" }, 500);
    const r = await client.nlmAsk("u", "q");
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.error : "", /No notebook URL/);
  });

  it("máy chủ tắt -> câu dễ hiểu, không throw", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const r = await client.nlmListContent("u");
    assert.deepEqual(r, { ok: false, error: "Máy chủ NotebookLM đang tắt" });
  });

  it("lệnh xếp hàng tuần tự - lệnh sau chỉ chạy khi lệnh trước xong", async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    globalThis.fetch = (async (url: string) => {
      const tag = String(url).includes("/ask") ? "ask" : "list";
      order.push(`start:${tag}`);
      if (tag === "ask") await gate;
      order.push(`end:${tag}`);
      return new Response(JSON.stringify({ success: true, data: {} }));
    }) as unknown as typeof fetch;
    const p1 = client.nlmAsk("u", "q");
    const p2 = client.nlmListContent("u");
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(order, ["start:ask"]);
    release();
    await Promise.all([p1, p2]);
    assert.deepEqual(order, ["start:ask", "end:ask", "start:list", "end:list"]);
  });
});
