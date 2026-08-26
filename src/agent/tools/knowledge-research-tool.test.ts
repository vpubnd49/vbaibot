import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../../shared/test-env-setup.js";
import { createKnowledgeResearchTool } from "./knowledge-research-tool.js";

let dataDir: string;

before(async () => {
  dataDir = setupTestEnv();
});

after(async () => {
  (await import("../../conversation/database.js")).closeDatabase();
  cleanupTestEnv(dataDir);
});

describe("knowledge-research-tool", () => {
  it("trả về kết quả bọc wrapUntrustedContent khi có dữ liệu", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          query: {
            search: [{ title: "Albert Einstein", snippet: "Nhà vật lý...", pageid: 101, timestamp: "2026-01-01" }],
            pages: { "101": { pageid: 101, title: "Albert Einstein", extract: "Nhà vật lý lý thuyết..." } },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const researchTool = createKnowledgeResearchTool({ fetchFn: mockFetch });
    const mockQuery = { query: "Albert Einstein", source: "wikipedia" as const };

    const result = (await (researchTool as unknown as { execute: (q: unknown, ctx: unknown) => Promise<unknown> }).execute(
      mockQuery,
      {} as unknown,
    )) as string;

    assert.match(result, /^<noi_dung_ngoai /);
    assert.match(result, /<\/noi_dung_ngoai>$/);
    assert.ok(result.includes("Albert Einstein"));
  });

  it("trả về ketQuaLoi khi có lỗi mạng/upstream", async () => {
    const mockFailingFetch: typeof fetch = async () => {
      throw new Error("Network offline");
    };

    const researchTool = createKnowledgeResearchTool({ fetchFn: mockFailingFetch });
    const mockQuery = { query: "Unreachable Query", source: "wikipedia" as const };

    const result = (await (researchTool as unknown as { execute: (q: unknown, ctx: unknown) => Promise<unknown> }).execute(
      mockQuery,
      {} as unknown,
    )) as { ok: boolean; loi: string };

    assert.equal(typeof result, "object");
    assert.equal(result.ok, false);
    assert.ok(result.loi.includes("Tra cứu tri thức thất bại"));
  });
});
