import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../../shared/test-env-setup.js";
import { createDeveloperResearchTool } from "./developer-research-tool.js";

let dataDir: string;

before(async () => {
  dataDir = setupTestEnv();
});

after(async () => {
  (await import("../../conversation/database.js")).closeDatabase();
  cleanupTestEnv(dataDir);
});

describe("developer-research-tool", () => {
  it("trả về kết quả bọc wrapUntrustedContent khi có dữ liệu", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          total_count: 1,
          items: [
            {
              id: 1,
              full_name: "vpubnd49/vbaibot",
              name: "vbaibot",
              html_url: "https://github.com/vpubnd49/vbaibot",
              description: "Zalo AI Bot",
              stargazers_count: 10,
              forks_count: 2,
              language: "TypeScript",
              updated_at: "2026-08-26T00:00:00Z",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const devTool = createDeveloperResearchTool({ fetchFn: mockFetch });
    const mockQuery = { query: "vbaibot", source: "github" as const };

    const result = (await (devTool as unknown as { execute: (q: unknown, ctx: unknown) => Promise<unknown> }).execute(
      mockQuery,
      {} as unknown,
    )) as string;

    assert.match(result, /^<noi_dung_ngoai /);
    assert.match(result, /<\/noi_dung_ngoai>$/);
    assert.ok(result.includes("vpubnd49/vbaibot"));
  });

  it("trả về ketQuaLoi khi có lỗi mạng/upstream", async () => {
    const mockFailingFetch: typeof fetch = async () => {
      throw new Error("GitHub API rate limit exceeded");
    };

    const devTool = createDeveloperResearchTool({ fetchFn: mockFailingFetch });
    const mockQuery = { query: "fail_query", source: "github" as const };

    const result = (await (devTool as unknown as { execute: (q: unknown, ctx: unknown) => Promise<unknown> }).execute(
      mockQuery,
      {} as unknown,
    )) as { ok: boolean; loi: string };

    assert.equal(typeof result, "object");
    assert.equal(result.ok, false);
    assert.ok(result.loi.includes("Tra cứu kỹ thuật thất bại"));
  });
});
