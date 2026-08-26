import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../shared/test-env-setup.js";
import { executeDeveloperResearch, isBugErrorQuery, isHnTrendQuery, isRepoCodeQuery } from "./developer-research-service.js";

let dataDir: string;

before(async () => {
  dataDir = setupTestEnv();
});

after(async () => {
  (await import("../conversation/database.js")).closeDatabase();
  cleanupTestEnv(dataDir);
});

describe("developer-research heuristic classification", () => {
  it("nhận diện đúng query lỗi lập trình", () => {
    assert.equal(isBugErrorQuery("cách sửa lỗi TypeError: undefined is not a function"), true);
    assert.equal(isBugErrorQuery("CORS error in FastAPI"), true);
    assert.equal(isBugErrorQuery("repo machine learning python"), false);
  });

  it("nhận diện đúng query tìm kiếm repo / thư viện", () => {
    assert.equal(isRepoCodeQuery("repo Multi-Agent Framework python"), true);
    assert.equal(isRepoCodeQuery("github open source react component"), true);
  });

  it("nhận diện đúng query xu hướng Hacker News", () => {
    assert.equal(isHnTrendQuery("thảo luận Cursor vs Copilot trên hacker news"), true);
    assert.equal(isHnTrendQuery("xu hướng AI startup 2026"), true);
  });
});

describe("developer-research mock execution", () => {
  it("tra cứu GitHub Repositories trả về kết quả chuẩn hóa", async () => {
    const mockJson = {
      total_count: 1,
      items: [
        {
          id: 1,
          full_name: "openai/openai-python",
          name: "openai-python",
          html_url: "https://github.com/openai/openai-python",
          description: "The official Python library for the OpenAI API",
          stargazers_count: 25000,
          forks_count: 3500,
          language: "Python",
          topics: ["ai", "llm"],
          updated_at: "2026-08-01T00:00:00Z",
          license: { spdx_id: "Apache-2.0" },
        },
      ],
    };

    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify(mockJson), { status: 200, headers: { "content-type": "application/json" } });

    const res = await executeDeveloperResearch(
      { query: "openai python", source: "github" },
      { fetchFn: mockFetch },
    );
    assert.equal(res.results.length, 1);
    assert.equal(res.results[0]?.source, "github");
    assert.equal(res.results[0]?.metrics?.stars, 25000);
    assert.equal(res.results[0]?.identifiers?.githubFullName, "openai/openai-python");
    assert.ok(res.text.includes("openai/openai-python"));
  });

  it("tra cứu Stack Overflow trả về câu hỏi và attribution", async () => {
    const mockSearchJson = {
      items: [
        {
          question_id: 12345,
          title: "How to fix CORS error in FastAPI?",
          link: "https://stackoverflow.com/questions/12345",
          score: 85,
          answer_count: 3,
          is_answered: true,
          accepted_answer_id: 67890,
          tags: ["python", "fastapi", "cors"],
          owner: { display_name: "AliceDev" },
          creation_date: 1700000000,
        },
      ],
      has_more: false,
      quota_max: 300,
      quota_remaining: 299,
    };

    const mockAnswerJson = {
      items: [
        {
          answer_id: 67890,
          score: 120,
          is_accepted: true,
          body: "<p>Use <code>CORSMiddleware</code> from <code>fastapi.middleware.cors</code>:</p><pre><code>app.add_middleware(CORSMiddleware)</code></pre>",
          owner: { display_name: "BobExpert" },
          creation_date: 1700001000,
        },
      ],
      has_more: false,
      quota_max: 300,
      quota_remaining: 298,
    };

    const mockFetch: typeof fetch = async (url) => {
      const u = String(url);
      if (u.includes("/answers/")) {
        return new Response(JSON.stringify(mockAnswerJson), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify(mockSearchJson), { status: 200, headers: { "content-type": "application/json" } });
    };

    const res = await executeDeveloperResearch(
      { query: "FastAPI CORS", source: "stackoverflow" },
      { fetchFn: mockFetch },
    );
    assert.equal(res.results.length, 1);
    assert.equal(res.results[0]?.source, "stackoverflow");
    assert.equal(res.results[0]?.license, "CC BY-SA 4.0 (Stack Exchange Attribution required)");
    assert.ok(res.text.includes("How to fix CORS error in FastAPI?"));
    assert.ok(res.text.includes("CORSMiddleware"));
  });

  it("tra cứu Hacker News trả về thảo luận và điểm số", async () => {
    const mockJson = {
      hits: [
        {
          objectID: "40001234",
          title: "Show HN: Modern AI Agents",
          url: "https://example.com/modern-agents",
          author: "tech_founder",
          points: 340,
          story_text: "We built a new multi-agent framework.",
          num_comments: 125,
          created_at: "2026-08-20T10:00:00Z",
        },
      ],
      nbHits: 1,
      page: 0,
      nbPages: 1,
      hitsPerPage: 5,
    };

    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify(mockJson), { status: 200, headers: { "content-type": "application/json" } });

    const res = await executeDeveloperResearch(
      { query: "Modern AI Agents", source: "hacker_news" },
      { fetchFn: mockFetch },
    );
    assert.equal(res.results.length, 1);
    assert.equal(res.results[0]?.source, "hacker_news");
    assert.equal(res.results[0]?.metrics?.score, 340);
    assert.equal(res.results[0]?.metrics?.comments, 125);
    assert.ok(res.text.includes("Show HN: Modern AI Agents"));
  });
});
