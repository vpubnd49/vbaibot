import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAdminDocumentTool } from "./create-admin-document-tool.js";
import { reviewAdminDocumentTool } from "./review-admin-document-tool.js";
import { ThreadType } from "zca-js";

function makeContext() {
  return {
    api: {} as any,
    account: { id: "acc-test" } as any,
    message: { threadId: "t1", threadType: ThreadType.User } as any,
    ghiNhanDaGui: () => {},
  };
}

describe("createAdminDocumentTool", () => {
  it("khởi tạo tool thành công với schema hợp lệ", () => {
    const ctx = makeContext();
    const toolInstance = createAdminDocumentTool(ctx);
    assert.ok(toolInstance);
    const desc = typeof toolInstance.description === "string" ? toolInstance.description : "";
    assert.ok(desc.includes("Nghị định 30/2020/NĐ-CP"));
  });
});

describe("reviewAdminDocumentTool", () => {
  it("thực thi rà soát trả về kết quả tiếp nhận 7 lớp", async () => {
    const ctx = makeContext();
    const toolInstance = reviewAdminDocumentTool(ctx);
    assert.ok(toolInstance);
    
    const result = await (toolInstance as any).execute(
      {
        content: "DỰ THẢO QUYẾT ĐỊNH\nBan hành Quy chế làm việc...",
        targetStandard: "nd30_nha_nuoc",
        contextNotes: "Đối chiếu theo QĐ số 123 của UBND tỉnh",
      },
      { messages: [], toolCallId: "call_1" },
    );

    assert.ok(typeof result === "string");
    assert.ok(result.includes("7 lớp"));
  });
});
