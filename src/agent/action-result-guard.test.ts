import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getFailedActions, guardFailedActionReply } from "./action-result-guard.js";
import { ketQuaLoi } from "./tools/tool-failure-result.js";

describe("action-result-guard", () => {
  it("nhận diện action thất bại qua contract ok:false/loi", () => {
    const failed = getFailedActions([
      {
        toolResults: [
          { toolName: "send_file", toolCallId: "1", output: ketQuaLoi("Không tìm thấy file") },
          { toolName: "web_search", output: ketQuaLoi("không có kết quả") },
        ],
      },
    ]);
    assert.deepEqual(failed, [{ toolName: "send_file", message: "Không tìm thấy file" }]);
  });

  it("chặn khẳng định thành công sau khi action lỗi", () => {
    const text = guardFailedActionReply("Đã gửi file cho anh rồi.", [
      { toolName: "send_file", message: "Không tìm thấy file" },
    ]);
    assert.match(text, /chưa hoàn tất thao tác/);
    assert.doesNotMatch(text, /Đã gửi file cho anh rồi/);
  });

  it("không thay câu trả lời không khẳng định thành công", () => {
    const text = "Mình chưa gửi được file vì không tìm thấy file.";
    assert.equal(
      guardFailedActionReply(text, [{ toolName: "send_file", message: "Không tìm thấy file" }]),
      text,
    );
  });
});
