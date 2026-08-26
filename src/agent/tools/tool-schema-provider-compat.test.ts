import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../../shared/test-env-setup.js";
import { createDeveloperResearchTool } from "./developer-research-tool.js";
import { createKnowledgeResearchTool } from "./knowledge-research-tool.js";
import { listAvailableTools, TOOL_DEFINITIONS } from "./tool-registry.js";

let dataDir: string;

before(async () => {
  dataDir = setupTestEnv();
});

after(async () => {
  (await import("../../conversation/database.js")).closeDatabase();
  cleanupTestEnv(dataDir);
});

describe("tool schema & provider compatibility", () => {
  it("mọi tool trong catalog đều có description và execute hợp lệ", () => {
    for (const def of TOOL_DEFINITIONS) {
      assert.ok(def.key, "tool phải có key");
      assert.ok(def.label, `tool ${def.key} phải có label`);
      assert.ok(def.description, `tool ${def.key} phải có description`);
      assert.ok(typeof def.build === "function", `tool ${def.key} phải có build function`);
    }
  });

  it("knowledge_research và developer_research có defaultEnabled = false và runsInScheduledTurn = false", () => {
    const kr = TOOL_DEFINITIONS.find((t) => t.key === "knowledge_research");
    const dr = TOOL_DEFINITIONS.find((t) => t.key === "developer_research");

    assert.ok(kr);
    assert.equal(kr.defaultEnabled, false);
    assert.equal(kr.runsInScheduledTurn, false);

    assert.ok(dr);
    assert.equal(dr.defaultEnabled, false);
    assert.equal(dr.runsInScheduledTurn, false);
  });

  it("listAvailableTools loại bỏ 2 tool mới trong lượt chạy theo lịch (isolated: true)", () => {
    const scope = {
      account: { disabledTools: [] },
      agent: { disabledTools: [] },
    };
    const scheduledTools = listAvailableTools(scope, { isolated: true });
    const keys = scheduledTools.map((t) => t.key);

    assert.equal(keys.includes("knowledge_research"), false);
    assert.equal(keys.includes("developer_research"), false);
  });

  it("listAvailableTools loại bỏ tool khi nằm trong disabledTools của account hoặc agent", () => {
    const scope1 = {
      account: { disabledTools: ["knowledge_research"] },
      agent: { disabledTools: [] },
    };
    const tools1 = listAvailableTools(scope1);
    assert.equal(tools1.some((t) => t.key === "knowledge_research"), false);

    const scope2 = {
      account: { disabledTools: [] },
      agent: { disabledTools: ["developer_research"] },
    };
    const tools2 = listAvailableTools(scope2);
    assert.equal(tools2.some((t) => t.key === "developer_research"), false);
  });

  it("knowledge_research bọc kết quả bằng wrapUntrustedContent ở mọi độ dài", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          query: {
            search: [{ title: "Test Title", snippet: "Short snippet", pageid: 1, timestamp: "2026-01-01" }],
            pages: { "1": { pageid: 1, title: "Test Title", extract: "Short snippet" } },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const tool = createKnowledgeResearchTool({ fetchFn: mockFetch });
    const res = (await (tool as unknown as { execute: (q: unknown, ctx: unknown) => Promise<unknown> }).execute(
      { query: "Test", source: "wikipedia" },
      {} as unknown,
    )) as string;

    assert.match(res, /^<noi_dung_ngoai /);
    assert.match(res, /<\/noi_dung_ngoai>$/);
  });

  it("developer_research bọc kết quả bằng wrapUntrustedContent ở mọi độ dài", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          hits: [{ objectID: "123", title: "HN Title", author: "alice", points: 10, num_comments: 2, created_at: "2026-01-01" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const tool = createDeveloperResearchTool({ fetchFn: mockFetch });
    const res = (await (tool as unknown as { execute: (q: unknown, ctx: unknown) => Promise<unknown> }).execute(
      { query: "Test HN", source: "hacker_news" },
      {} as unknown,
    )) as string;

    assert.match(res, /^<noi_dung_ngoai /);
    assert.match(res, /<\/noi_dung_ngoai>$/);
  });
});
