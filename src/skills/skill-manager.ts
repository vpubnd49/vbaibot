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
  const rawBody = match[2].trim();
  const fm: Record<string, string> = {};

  const lines = yamlBlock.split(/\r?\n/);
  let activeMultilineKey: string | null = null;
  let multilineParts: string[] = [];

  const flushMultiline = () => {
    if (activeMultilineKey) {
      fm[activeMultilineKey] = multilineParts.join(" ").replace(/\s+/g, " ").trim();
      activeMultilineKey = null;
      multilineParts = [];
    }
  };

  for (const line of lines) {
    if (activeMultilineKey) {
      if (/^\s{2,}\S/.test(line)) {
        multilineParts.push(line.trim());
        continue;
      }
      if (!line.trim()) {
        continue;
      }
      flushMultiline();
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && !/^\s/.test(line)) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      let val = line.slice(colonIdx + 1).trim();
      if (val === ">" || val === "|" || val === ">-" || val === "|-") {
        activeMultilineKey = key;
        multilineParts = [];
        continue;
      }
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      fm[key] = val;
    }
  }
  flushMultiline();

  const name = fm["name"] || "";
  const description = fm["description"] || "";
  const triggers: string[] = [];

  const addTrigger = (rawItem: string) => {
    const clean = rawItem.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
    if (clean && clean.length >= 2 && !triggers.includes(clean)) {
      triggers.push(clean);
    }
  };

  // 1. Lấy triggers từ trường triggers nếu có
  if (fm["triggers"]) {
    const raw = fm["triggers"].replace(/^\[|\]$/g, "");
    for (const item of raw.split(",")) {
      addTrigger(item);
    }
  }

  // 2. Trích từ description: hỗ trợ cả "Triggers: 'a', 'b'" và "Trigger (A): 'a', 'b'"
  if (triggers.length === 0 && description) {
    const quotedRegex = /Triggers?(?:\s*\([A-Z]\))?:\s*([^.]+?)(?=\.\s*(?:Trigger|KHÔNG|DISCLAIMER|$)|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = quotedRegex.exec(description)) !== null) {
      const segment = m[1] || "";
      const singleQuoted = segment.match(/'([^']+)'/g);
      if (singleQuoted && singleQuoted.length > 0) {
        for (const sq of singleQuoted) addTrigger(sq);
      } else {
        for (const item of segment.split(",")) addTrigger(item);
      }
    }
  }

  const body = adaptSkillContentForZaloBot(rawBody);
  return { name, description, triggers, body };
}

/**
 * Làm sạch ký hiệu LaTeX và ánh xạ các lệnh CLI/IDE trong SKILL.md sang bộ công cụ
 * gốc của Zalo Bot để tránh làm model bối rối hoặc xuất LaTeX thô ra Zalo.
 */
export function adaptSkillContentForZaloBot(rawContent: string): string {
  let cleaned = rawContent
    // Chuyển khối công thức $$...$$ hoặc $...$ sang văn bản thuần
    .replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner: string) =>
      inner
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1) / ($2)")
        .replace(/\\text\{([^}]+)\}/g, "$1")
        .replace(/\\sum_\{([^}]+)\}\^\{?([^}\s]+)\}?/g, "Tổng($1..$2)")
        .replace(/\\ge/g, ">=")
        .replace(/\\le/g, "<=")
        .replace(/\\neq/g, "!=")
        .replace(/\\times/g, "×")
        .trim(),
    )
    .replace(/\$([^$\n]+)\$/g, (_m, inner: string) =>
      inner
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1) / ($2)")
        .replace(/\\text\{([^}]+)\}/g, "$1")
        .replace(/\\ge/g, ">=")
        .replace(/\\le/g, "<=")
        .replace(/\\neq/g, "!=")
        .replace(/\\times/g, "×")
        .trim(),
    )
    // Loại bỏ câu cấm docx-js dành riêng cho môi trường CLI sửa file tại chỗ
    .replace(/CẤM TUYỆT ĐỐI bóc tách text rồi tạo lại docx mới từ đầu[^\n]*/gi, "");

  if (/(?:generate_cong_van_nd30\.js|edit_docx_template_in_place\.py|scripts\/lookup\.py|scripts\/review\.py)/i.test(cleaned)) {
    cleaned +=
      "\n\n> **[CHỈ DẪN THỰC THI TRÊN ZALO BOT]**: Trong môi trường Zalo Bot, bạn KHÔNG chạy lệnh bash/python CLI (`node engine/...`, `python scripts/...`). " +
      "Thay vào đó, hãy áp dụng toàn bộ quy chuẩn thể thức/nghiệp vụ ở trên và GỌI TRỰC TIẾP các công cụ của Bot: " +
      "`create_admin_document` (để xuất file .docx chuẩn Nghị định 30 / Hướng dẫn 05), `create_word_document` (cho hợp đồng/biểu mẫu), " +
      "`create_excel_file` (cho phụ lục Excel), `review_admin_document` (để rà soát văn bản), `qppl_lamdong` & `national_legal` (để tra cứu VBQPPL).";
  }

  return cleaned;
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

/**
 * Xóa một skill theo ID (chỉ xóa thư mục con nằm trong .agents/skills/)
 */
export function deleteSkill(id: string): { success: boolean; error?: string } {
  try {
    const cleanId = id.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    if (!cleanId) {
      return { success: false, error: "ID kỹ năng không hợp lệ." };
    }
    const rootDir = path.resolve(getSkillsRootDir());
    const targetDir = path.resolve(rootDir, cleanId);
    if (!targetDir.startsWith(rootDir + path.sep) || !fs.existsSync(targetDir)) {
      return { success: false, error: "Không tìm thấy kỹ năng cần xóa." };
    }
    fs.rmSync(targetDir, { recursive: true, force: true });
    cachedSkills = null;
    lastCacheTime = 0;
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Thư mục sandbox chứa các bản nháp kỹ năng đang chạy thử (.agents/skill-drafts)
 * trước khi Admin xác nhận đưa vào thư viện chung (.agents/skills).
 */
export function getSkillDraftsRootDir(): string {
  return path.resolve(process.cwd(), ".agents", "skill-drafts");
}

function sanitizeSkillId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Lưu một bản nháp skill vào thư mục riêng (.agents/skill-drafts/<id>/SKILL.md)
 * kèm dữ liệu chạy thử (sample-test.md) nếu có.
 */
export function saveSkillDraft(params: {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  content: string;
  sampleTestReport?: string;
}): { success: boolean; id: string; path: string; error?: string } {
  try {
    const cleanId = sanitizeSkillId(params.id);
    if (!cleanId) {
      return { success: false, id: "", path: "", error: "ID kỹ năng không hợp lệ." };
    }

    const draftsRoot = getSkillDraftsRootDir();
    fs.mkdirSync(draftsRoot, { recursive: true });

    const draftDir = path.join(draftsRoot, cleanId);
    fs.mkdirSync(draftDir, { recursive: true });

    const triggersYaml =
      params.triggers && params.triggers.length > 0
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

    const filePath = path.join(draftDir, "SKILL.md");
    fs.writeFileSync(filePath, mdContent, "utf-8");

    if (params.sampleTestReport && params.sampleTestReport.trim()) {
      fs.writeFileSync(
        path.join(draftDir, "sample-test.md"),
        params.sampleTestReport.trim() + "\n",
        "utf-8",
      );
    }

    return { success: true, id: cleanId, path: filePath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, id: "", path: "", error: msg };
  }
}

/**
 * Liệt kê tất cả bản nháp kỹ năng đang nằm trong Xưởng Skill (.agents/skill-drafts)
 */
export function listSkillDrafts(): (AgentSkill & { sampleTestReport?: string })[] {
  const draftsRoot = getSkillDraftsRootDir();
  if (!fs.existsSync(draftsRoot)) return [];

  const drafts: (AgentSkill & { sampleTestReport?: string })[] = [];
  const entries = fs.readdirSync(draftsRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const draftDir = path.join(draftsRoot, entry.name);
    const skillMdPath = path.join(draftDir, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;

    try {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      const stat = fs.statSync(skillMdPath);
      const parsed = parseSkillMarkdown(content);
      const samplePath = path.join(draftDir, "sample-test.md");
      const sampleTestReport = fs.existsSync(samplePath)
        ? fs.readFileSync(samplePath, "utf-8")
        : undefined;

      drafts.push({
        id: entry.name,
        name: parsed.name || entry.name,
        description: parsed.description,
        triggers: parsed.triggers,
        content: parsed.body,
        dirPath: draftDir,
        updatedAt: stat.mtime,
        sampleTestReport,
      });
    } catch (err) {
      console.warn(`[skill-manager] Lỗi khi đọc skill draft ${entry.name}:`, err);
    }
  }

  return drafts;
}

/**
 * Duyệt và chuyển bản nháp kỹ năng từ .agents/skill-drafts/<id> sang thư viện chung .agents/skills/<id>
 */
export function promoteSkillDraft(id: string): {
  success: boolean;
  id: string;
  path: string;
  error?: string;
} {
  try {
    const cleanId = sanitizeSkillId(id);
    if (!cleanId) {
      return { success: false, id: "", path: "", error: "ID kỹ năng không hợp lệ." };
    }

    const draftsRoot = path.resolve(getSkillDraftsRootDir());
    const draftDir = path.resolve(draftsRoot, cleanId);
    const draftFile = path.join(draftDir, "SKILL.md");

    if (!draftDir.startsWith(draftsRoot + path.sep) || !fs.existsSync(draftFile)) {
      return {
        success: false,
        id: cleanId,
        path: "",
        error: `Không tìm thấy bản nháp kỹ năng '${cleanId}' trong Xưởng Skill.`,
      };
    }

    const skillsRoot = getSkillsRootDir();
    fs.mkdirSync(skillsRoot, { recursive: true });
    const targetDir = path.join(skillsRoot, cleanId);
    fs.mkdirSync(targetDir, { recursive: true });

    const destFile = path.join(targetDir, "SKILL.md");
    fs.copyFileSync(draftFile, destFile);

    const sampleFile = path.join(draftDir, "sample-test.md");
    if (fs.existsSync(sampleFile)) {
      fs.copyFileSync(sampleFile, path.join(targetDir, "sample-test.md"));
    }

    // Xóa bản nháp sau khi đã chuyển vào thư viện chung
    fs.rmSync(draftDir, { recursive: true, force: true });

    cachedSkills = null;
    lastCacheTime = 0;

    return { success: true, id: cleanId, path: destFile };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, id: "", path: "", error: msg };
  }
}

