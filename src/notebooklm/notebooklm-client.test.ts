import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../shared/test-env-setup.js";

/**
 * Client KHÔNG được throw (tool không bao giờ throw) và phải dịch lỗi máy chủ
 * ra câu người dùng hiểu được. Dùng máy chủ HTTP thật trên cổng ngẫu nhiên vì
 * client gọi bằng node:http (không qua fetch).
 */

let dataDir: string;
let client: typeof import("./notebooklm-client.js");
let settings: typeof import("../config/runtime-notebooklm-settings.js");
let database: typeof import("../conversation/database.js");

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>;
let handler: Handler = (_req, res) => {
  res.end("{}");
};
let server: http.Server;

before(async () => {
  dataDir = setupTestEnv({});
  client = await import("./notebooklm-client.js");
  settings = await import("../config/runtime-notebooklm-settings.js");
  database = await import("../conversation/database.js");
  server = http.createServer((req, res) => void handler(req, res));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  settings.updateNotebooklmSettings({ apiUrl: `http://127.0.0.1:${port}` });
});

afterEach(() => {
  handler = (_req, res) => {
    res.end("{}");
  };
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  database.closeDatabase();
  cleanupTestEnv(dataDir);
});

const json = (body: unknown, status = 200): Handler => (_req, res) => {
  res.statusCode = status;
  res.end(JSON.stringify(body));
};

describe("notebooklm-client", () => {
  it("lấy data từ envelope {success,data}", async () => {
    handler = json({ success: true, data: { authenticated: true } });
    const r = await client.nlmHealth();
    assert.deepEqual(r, { ok: true, data: { authenticated: true } });
  });

  it("success:false -> ok:false kèm lỗi của máy chủ", async () => {
    handler = json({ success: false, error: "No notebook URL provided" }, 500);
    const r = await client.nlmAsk("u", "q");
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.error : "", /No notebook URL/);
  });

  it("gửi body JSON cho lệnh POST", async () => {
    let got = "";
    handler = async (req, res) => {
      for await (const c of req) got += c;
      res.end(JSON.stringify({ success: true, data: { answer: "ok" } }));
    };
    await client.nlmAsk("nb", "câu hỏi");
    assert.equal(JSON.parse(got).question, "câu hỏi");
  });

  it("máy chủ tắt -> câu dễ hiểu, không throw", async () => {
    const saved = settings.getNotebooklmSettings().apiUrl;
    settings.updateNotebooklmSettings({ apiUrl: "http://127.0.0.1:1" });
    try {
      const r = await client.nlmListContent("u");
      assert.deepEqual(r, { ok: false, error: "Máy chủ NotebookLM đang tắt" });
    } finally {
      settings.updateNotebooklmSettings({ apiUrl: saved });
    }
  });

  it("lệnh xếp hàng tuần tự - lệnh sau chỉ chạy khi lệnh trước xong", async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    handler = async (req, res) => {
      const tag = String(req.url).includes("/ask") ? "ask" : "list";
      order.push(`start:${tag}`);
      if (tag === "ask") await gate;
      order.push(`end:${tag}`);
      res.end(JSON.stringify({ success: true, data: {} }));
    };
    const p1 = client.nlmAsk("u", "q");
    const p2 = client.nlmListContent("u");
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(order, ["start:ask"]);
    release();
    await Promise.all([p1, p2]);
    assert.deepEqual(order, ["start:ask", "end:ask", "start:list", "end:list"]);
  });
});
