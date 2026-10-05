import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseSkillMarkdown,
  loadAllSkills,
  findMatchingSkills,
  saveSkill,
  getSkillsRootDir,
} from "./skill-manager.js";

test("parseSkillMarkdown trích xuất đúng frontmatter và body", () => {
  const sample = `---
name: Soạn VB Thử Nghiệm
description: "Dùng để kiểm thử chức năng skill. Triggers: 'kiem thu', 'thu nghiem'"
triggers: ['test_trigger', 'demo']
---

# Nội dung chính
Đây là hướng dẫn chi tiết của skill.`;

  const res = parseSkillMarkdown(sample);
  assert.equal(res.name, "Soạn VB Thử Nghiệm");
  assert.equal(res.description, "Dùng để kiểm thử chức năng skill. Triggers: 'kiem thu', 'thu nghiem'");
  assert.deepEqual(res.triggers, ["test_trigger", "demo"]);
  assert.ok(res.body.includes("# Nội dung chính"));
});

test("loadAllSkills nạp được các skills hiện có trong workspace", () => {
  const skills = loadAllSkills(true);
  assert.ok(skills.length >= 4, `Cần có ít nhất 4 skills, thực tế: ${skills.length}`);
  const nd30 = skills.find((s) => s.id === "soan-thao-vb-nd30");
  assert.ok(nd30, "Phải tìm thấy skill soan-thao-vb-nd30");
  assert.ok(nd30.name.includes("NĐ30") || nd30.name.includes("Soạn VB"));
});

test("findMatchingSkills tìm đúng skill theo từ khóa người dùng", () => {
  const matched = findMatchingSkills("Hãy giúp tôi soạn công văn chỉ đạo theo NĐ30");
  assert.ok(matched.length > 0);
  assert.equal(matched[0].id, "soan-thao-vb-nd30");

  const matchedDang = findMatchingSkills("Cần làm tờ trình gửi Tỉnh uỷ theo quy định Đảng");
  assert.ok(matchedDang.some((s) => s.id === "soan-thao-vb-dang-hd05"));
});

test("saveSkill tạo mới skill và nạp lại ngay lập tức", () => {
  const tempId = "test-temp-skill-auto";
  const saveRes = saveSkill({
    id: tempId,
    name: "Skill Tự Động Test",
    description: "Mô tả test tự động",
    triggers: ["test_auto_key", "tudong"],
    content: "## Hướng dẫn tự động cho test\nThực hiện các bước A, B, C.",
  });

  assert.equal(saveRes.success, true);
  assert.ok(fs.existsSync(saveRes.path));

  const matched = findMatchingSkills("Tôi muốn test_auto_key");
  assert.ok(matched.some((s) => s.id === tempId));

  // Dọn dẹp sau test
  const skillDir = path.join(getSkillsRootDir(), tempId);
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
  }
});
