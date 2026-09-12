import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafeUserRequestAudit, toUserRequestAuditEvent } from "./user-request-audit.js";

describe("user request audit", () => {
  it("chỉ ghi metadata, không ghi text/file/url/path", () => {
    const event = toUserRequestAuditEvent([{
      text: "Nguyễn Văn A https://example.test/?token=secret C:\\secret.docx",
      imageCount: 1,
      files: [{ isAudio: false }, { isAudio: true }],
      isGroup: false,
    }]);
    assertSafeUserRequestAudit(event);
    const serialized = JSON.stringify(event);
    assert.match(serialized, /"textChars":/);
    assert.doesNotMatch(serialized, /Nguyễn Văn A|https:\/\/|secret\.docx|token=secret/);
    assert.equal(event.imageCount, 1);
    assert.equal(event.fileCount, 2);
    assert.equal(event.audioCount, 1);
    assert.equal(event.documentCount, 1);
  });

  it("đếm đúng batch nhiều ảnh và đánh dấu nhóm", () => {
    const event = toUserRequestAuditEvent([
      { text: "đọc ảnh", imageCount: 2, files: [], isGroup: true },
      { text: "xuất Excel", imageCount: 1, files: [], isGroup: true },
    ]);
    assertSafeUserRequestAudit(event);
    assert.equal(event.messageCount, 2);
    assert.equal(event.batch, true);
    assert.equal(event.imageCount, 3);
    assert.equal(event.isGroup, true);
  });

  it("ghi nhận request bị bỏ do queue đầy mà không chứa payload", () => {
    const event = toUserRequestAuditEvent([
      { text: "yêu cầu tra cứu", imageCount: 0, files: [], isGroup: false },
    ], { event: "user_request_dropped", dropReason: "queue_full" });
    assertSafeUserRequestAudit(event);
    assert.equal(event.dropReason, "queue_full");
    assert.equal(event.auditEvent, "user_request_dropped");
  });
});
