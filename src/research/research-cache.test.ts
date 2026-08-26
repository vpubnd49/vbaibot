import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cleanupTestEnv, setupTestEnv } from "../shared/test-env-setup.js";

let dataDir: string;
let cache: typeof import("./research-cache.js");

before(async () => {
  dataDir = setupTestEnv();
  cache = await import("./research-cache.js");
});

after(async () => {
  (await import("../conversation/database.js")).closeDatabase();
  cleanupTestEnv(dataDir);
});

describe("research-cache", () => {
  it("lưu và đọc cache chính xác", () => {
    const key = "test-query";
    const data = [{ title: "Item 1" }];
    cache.setResearchCache("wikipedia", key, data, 60);

    const cached = cache.getResearchCache<typeof data>("wikipedia", key);
    assert.ok(cached);
    assert.equal(cached.isStale, false);
    assert.deepEqual(cached.data, data);
  });

  it("không tìm thấy cache với key chưa có", () => {
    const cached = cache.getResearchCache("arxiv", "not-found-query");
    assert.equal(cached, null);
  });

  it("phục vụ stale cache khi allowStale=true và chưa quá hạn staleGrace", () => {
    const key = "stale-query";
    const data = [{ title: "Stale Item" }];
    // TTL = -1s (đã hết hạn), staleGrace = 100s
    cache.setResearchCache("semantic_scholar", key, data, -1, 100);

    const normal = cache.getResearchCache("semantic_scholar", key);
    assert.equal(normal, null);

    const stale = cache.getResearchCache("semantic_scholar", key, { allowStale: true });
    assert.ok(stale);
    assert.equal(stale.isStale, true);
  });
});
