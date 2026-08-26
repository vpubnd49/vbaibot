import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  fetchJson,
  fetchWithPolicy,
  fetchXml,
  resetCircuitBreakersForTesting,
} from "./research-http-client.js";
import { ResearchProviderError } from "./research-provider-errors.js";

describe("research-http-client", () => {
  beforeEach(() => {
    resetCircuitBreakersForTesting();
  });

  it("parse JSON thành công khi status 200", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ message: "hello" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const res = await fetchJson<{ message: string }>("test", "https://api.example.com", {
      fetchFn: mockFetch,
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.message, "hello");
  });

  it("parse XML thành công với fast-xml-parser", async () => {
    const mockXml = `<feed><entry><title>Test arXiv</title><id>123</id></entry></feed>`;
    const mockFetch: typeof fetch = async () =>
      new Response(mockXml, {
        status: 200,
        headers: { "content-type": "application/xml" },
      });

    const res = await fetchXml<{ feed: { entry: { title: string; id: string } } }>(
      "test",
      "https://api.example.com/atom",
      { fetchFn: mockFetch },
    );
    assert.equal(res.status, 200);
    assert.equal(res.data.feed.entry.title, "Test arXiv");
    assert.equal(res.data.feed.entry.id, "123");
  });

  it("ném ResearchProviderError dạng rate_limited khi gặp 429", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response("Too Many Requests", {
        status: 429,
        headers: { "retry-after": "5" },
      });

    await assert.rejects(
      () => fetchWithPolicy("test_429", "https://api.example.com", { fetchFn: mockFetch, retry: false }),
      (err: unknown) => {
        assert.ok(err instanceof ResearchProviderError);
        assert.equal(err.kind, "rate_limited");
        assert.equal(err.status, 429);
        assert.equal(err.retryAfterSeconds, 5);
        return true;
      },
    );
  });

  it("ném ResearchProviderError dạng auth_required khi gặp 401 hoặc 403", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response("Unauthorized", { status: 401 });

    await assert.rejects(
      () => fetchWithPolicy("test_auth", "https://api.example.com", { fetchFn: mockFetch, retry: false }),
      (err: unknown) => {
        assert.ok(err instanceof ResearchProviderError);
        assert.equal(err.kind, "auth_required");
        assert.equal(err.status, 401);
        return true;
      },
    );
  });

  it("ném ResearchProviderError dạng no_results khi fetchJson gặp 404", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response("Not Found", { status: 404 });

    await assert.rejects(
      () => fetchJson("test_404", "https://api.example.com", { fetchFn: mockFetch, retry: false }),
      (err: unknown) => {
        assert.ok(err instanceof ResearchProviderError);
        assert.equal(err.kind, "no_results");
        return true;
      },
    );
  });
});
