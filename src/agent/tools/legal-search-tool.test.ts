import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLegalSearchTool } from "./legal-search-tool.js";
import { loiCuaTool } from "./tool-failure-result-test-helper.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const chay = (tool: unknown, input: unknown): Promise<unknown> =>
  (tool as any).execute(input, {});

describe("legal_search Tool", () => {
  it("trả về thông tin văn bản được bọc trong noi_dung_ngoai", async () => {
    const tool = createLegalSearchTool();
    const result = (await chay(tool, { query: "Luật 72/2025/QH15" })) as string;
    assert.equal(typeof result, "string");
    assert.match(result, /<noi_dung_ngoai/);
    assert.match(result, /72\/2025\/QH15/);
    assert.match(result, /chính quyền địa phương/i);
    assert.match(result, /<\/noi_dung_ngoai>/);
  });

  it("trả về lỗi an toàn có bọc ketQuaLoi khi truy vấn rỗng", async () => {
    const tool = createLegalSearchTool();
    const result = await chay(tool, { query: "   " });
    const err = loiCuaTool(result);
    assert.ok(err);
    assert.match(err, /Vui lòng cung cấp/);
  });
});
