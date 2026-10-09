import test from "node:test";
import assert from "node:assert/strict";
import { tool } from "ai";
import { z } from "zod";
import { bocToolAnToan } from "./safe-tool-wrapper.js";
import { laKetQuaLoi } from "./tool-failure-result.js";

const opts = (signal?: AbortSignal) =>
  ({ toolCallId: "t", messages: [], context: {} as never, abortSignal: signal }) as never;

test("exception lọt lưới thành ketQuaLoi, không lộ chi tiết nội bộ", async () => {
  const t = bocToolAnToan(
    "demo",
    tool({
      description: "x",
      inputSchema: z.object({}),
      execute: async (): Promise<string> => {
        throw new Error("SQLITE_BUSY C:\\secret\\path");
      },
    }),
  );
  const kq = await t.execute!({}, opts());
  assert.ok(laKetQuaLoi(kq));
  assert.ok(!JSON.stringify(kq).includes("secret"));
});

test("kết quả thành công đi qua nguyên vẹn", async () => {
  const t = bocToolAnToan(
    "demo",
    tool({ description: "x", inputSchema: z.object({}), execute: async () => "ok" }),
  );
  assert.equal(await t.execute!({}, opts()), "ok");
});

test("lượt đã hủy thì vẫn ném để agent loop dừng", async () => {
  const ac = new AbortController();
  ac.abort();
  const t = bocToolAnToan(
    "demo",
    tool({
      description: "x",
      inputSchema: z.object({}),
      execute: async (): Promise<string> => {
        throw new Error("aborted");
      },
    }),
  );
  await assert.rejects(async () => t.execute!({}, opts(ac.signal)));
});
