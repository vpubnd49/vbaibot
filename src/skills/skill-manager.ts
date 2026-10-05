import fs from "node:fs";
import path from "node:path";

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  content: string;
  dirPath: string;
  updatedAt?: Date;
}

let cachedSkills: AgentSkill[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10_000; // 10 giây

/**
 * Thư mục gốc chứa skills của agent (.agents/skills)
 */
export function getSkillsRootDir(): string {
  return path.resolve(process.cwd(), ".agents", "skills");
}

/**
 * Phân tích YAML frontmatter đơn giản từ file SKILL.md
 */
export function parseSkillMarkdown(fileContent: string): {
  name: string;
  description: string;
  triggers: string[];
  body: string;
} {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return {
      name: "",
      description: "",
      triggers: [],
      body: fileContent.trim(),
    };
  }

  const yamlBlock = match[1];
  const body = match[2].trim();
  const fm: Record<string, string> = {};

  for (const line of yamlBlock.split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      let val = line.slice(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      fm[key] = val;
    }
  }

  const name = fm["name"] || "";
  const description = fm["description"] || "";
  const triggers: string[] = [];

  // Lấy triggers từ trường triggers nếu có
  if (fm["triggers"]) {
    const raw = fm["triggers"].replace(/^\[|\]$/g, "");
    for (const item of raw.split(",")) {
      const clean = item.trim().replace(/^['"]|['"]$/g, "");
      if (clean) triggers.push(clean.toLowerCase());
    }
  }

  // Nếu không có trường triggers, trích từ description nếu có dạng: Triggers: 'a', 'b'
  if (triggers.length === 0 && description) {
    const trigMatch = description.match(/Triggers:\s*([^.]+)/i);
    if (trigMatch) {
      for (const item of trigMatch[1].split(",")) {
        const clean = item.trim().replace(/^['"]|['"]$/g, "");
        if (clean) triggers.push(clean.toLowerCase());
      }
    }
  }

  return { name, description, triggers, body };
}

/**
 * Tải tất cả các kỹ năng từ .agents/skills/
 */
export function loadAllSkills(forceRefresh = false): AgentSkill[] {
  const now = Date.now();
  if (!forceRefresh && cachedSkills && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedSkills;
  }

  const rootDir = getSkillsRootDir();
  if (!fs.existsSync(rootDir)) {
    cachedSkills = [];
    lastCacheTime = now;
    return [];
  }

  const skills: AgentSkill[] = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(rootDir, entry.name);
    const skillMdPath = path.join(skillDir, "SKILL.md");

    if (fs.existsSync(skillMdPath)) {
      try {
        const content = fs.readFileSync(skillMdPath, "utf-8");
        const stat = fs.statSync(skillMdPath);
        const parsed = parseSkillMarkdown(content);

        skills.push({
          id: entry.name,
          name: parsed.name || entry.name,
          description: parsed.description,
          triggers: parsed.triggers,
          content: parsed.body,
          dirPath: skillDir,
          updatedAt: stat.mtime,
        });
      } catch (err) {
        console.warn(`[skill-manager] Lỗi khi đọc skill ${entry.name}:`, err);
      }
    }
  }

  cachedSkills = skills;
  lastCacheTime = now;
  return skills;
}

/**
 * Lấy chi tiết một skill theo ID
 */
export function getSkillById(id: string): AgentSkill | undefined {
  const skills = loadAllSkills();
  return skills.find((s) => s.id.toLowerCase() === id.toLowerCase());
}

/**
 * Tìm kỹ năng phù hợp với tin nhắn người dùng
 */
export function findMatchingSkills(userMessage: string, maxMatches = 2): AgentSkill[] {
  if (!userMessage || !userMessage.trim()) return [];
  const query = userMessage.toLowerCase().trim();
  const skills = loadAllSkills();
  const scored: { skill: AgentSkill; score: number }[] = [];

  for (const skill of skills) {
    let score = 0;

    // Khớp ID trực tiếp
    if (query.includes(skill.id.toLowerCase())) {
      score += 5;
    }

    // Khớp triggers
    for (const trig of skill.triggers) {
      if (trig && query.includes(trig)) {
        score += 3;
      }
    }

    // Khớp tên
    if (skill.name && query.includes(skill.name.toLowerCase())) {
      score += 2;
    }

    if (score > 0) {
      scored.push({ skill, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxMatches).map((s) => s.skill);
}

/**
 * Tạo mới hoặc cập nhật một skill
 */
export function saveSkill(params: {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  content: string;
}): { success: boolean; path: string; error?: string } {
  try {
    const rawId = params.id
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!rawId) {
      return { success: false, path: "", error: "ID kỹ năng không hợp lệ." };
    }

    const rootDir = getSkillsRootDir();
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true });
    }

    const skillDir = path.join(rootDir, rawId);
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }

    const triggersYaml = params.triggers && params.triggers.length > 0
      ? `[${params.triggers.map((t) => `'${t.trim().replace(/'/g, "\\'")}'`).join(", ")}]`
      : "[]";

    const escapedDesc = params.description.replace(/"/g, '\\"');
    const mdContent = [
      "---",
      `name: ${params.name.trim()}`,
      `description: "${escapedDesc}"`,
      `triggers: ${triggersYaml}`,
      "---",
      "",
      params.content.trim(),
      "",
    ].join("\n");

    const filePath = path.join(skillDir, "SKILL.md");
    fs.writeFileSync(filePath, mdContent, "utf-8");

    // Xóa cache để lượt sau nạp ngay skill mới
    cachedSkills = null;
    lastCacheTime = 0;

    return { success: true, path: filePath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, path: "", error: msg };
  }
}
