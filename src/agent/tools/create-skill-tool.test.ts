import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createOrUpdateSkillTool, createListSkillsTool } from "./create-skill-tool.js";
import { getSkillsRootDir } from "../../skills/skill-manager.js";

test("createOrUpdateSkillTool tạo mới thành công và listSkillsTool hiển thị được", async () => {
  const createTool = createOrUpdateSkillTool();
  const listTool = createListSkillsTool();

  const testId = "skill-test-zalo-bot";
  const result = await createTool.execute!(
    {
      skill_id: testId,
      name: "Skill Soạn Văn Bản Test",
      description: "Dùng để kiểm thử việc học và lưu skill tự động",
      triggers: ["soan-test-vb", "kiem-thu-skill"],
      content: "## Quy tắc kiểm thử\n1. Luôn kiểm tra kỹ lưỡng\n2. Báo cáo kết quả đầy đủ.",
    },
    { toolCallId: "test-call-1", messages: [], context: {} as never },
  );

  assert.ok(typeof result === "string");
  assert.ok(result.includes("thành công"));

  // Kiểm tra bằng listSkillsTool
  const listResult = await listTool.execute!(
    { filter: "Skill Soạn Văn Bản Test" },
    { toolCallId: "test-call-2", messages: [], context: {} as never },
  );
  assert.ok(typeof listResult === "string");
  assert.ok(listResult.includes(testId));

  // Dọn dẹp
  const skillDir = path.join(getSkillsRootDir(), testId);
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
  }
});

test("Xưởng Skill: sandbox_draft tạo bản thử trong thư mục riêng và promote_draft lưu vào thư viện chung", async () => {
  const createTool = createOrUpdateSkillTool();
  const listTool = createListSkillsTool();

  const draftId = "ai-task-splitter-test";
  const draftRes = await createTool.execute!(
    {
      mode: "sandbox_draft",
      skill_id: draftId,
      name: "AI Task Splitter",
      description: "Chia nhỏ công việc AI để tiết kiệm lượt Claude và Codex",
      triggers: ["chia-viec-ai", "task-splitter"],
      content: "## Quy trình điều phối\n1. Phân tích yêu cầu\n2. Giao việc cho từng bot chuyên trách.",
      sample_test_report: "Đã chạy thử trên 3 kịch bản mẫu, sửa lỗi tràn token ở bước 2.",
    },
    { toolCallId: "test-draft-1", messages: [], context: {} as never },
  );

  assert.ok(typeof draftRes === "string");
  assert.ok(draftRes.includes("chờ Admin xác nhận"));

  const listBefore = await listTool.execute!(
    { filter: "AI Task Splitter", include_drafts: true },
    { toolCallId: "test-list-draft", messages: [], context: {} as never },
  );
  assert.ok(typeof listBefore === "string");
  assert.ok(listBefore.includes("[Bản thử chờ duyệt]"));

  const promoteRes = await createTool.execute!(
    {
      mode: "promote_draft",
      skill_id: draftId,
    },
    { toolCallId: "test-promote-1", messages: [], context: {} as never },
  );
  assert.ok(typeof promoteRes === "string");
  assert.ok(promoteRes.includes("thư viện chung"));

  // Dọn dẹp
  const skillDir = path.join(getSkillsRootDir(), draftId);
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
  }
});

