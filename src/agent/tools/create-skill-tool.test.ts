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
    { toolCallId: "test-call-1", messages: [] },
  );

  assert.ok(typeof result === "string");
  assert.ok(result.includes("thành công"));

  // Kiểm tra bằng listSkillsTool
  const listResult = await listTool.execute!(
    { filter: "Skill Soạn Văn Bản Test" },
    { toolCallId: "test-call-2", messages: [] },
  );
  assert.ok(typeof listResult === "string");
  assert.ok(listResult.includes(testId));

  // Dọn dẹp
  const skillDir = path.join(getSkillsRootDir(), testId);
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
  }
});
