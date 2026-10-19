import { TOOL_DEFINITIONS } from "../../agent/tools/index.js";
import { listAccounts } from "../../config/account-store.js";
import { listAgents } from "../../config/agent-store.js";
import { db } from "../../conversation/database.js";
import { listSkillDrafts, loadAllSkills } from "../../skills/skill-manager.js";
import { getAccountInsight } from "../group-insight.js";
import { getSystemInfo } from "../overview-stats.js";
import { getReport } from "../report-summary.js";

function esc(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getRealToolUsageCounts(): { name: string; label: string; group: string; count: number }[] {
  const counts = new Map<string, number>();
  try {
    const rows = db
      .prepare(`SELECT tool_calls FROM agent_steps WHERE tool_calls IS NOT NULL AND tool_calls != '[]' ORDER BY id DESC LIMIT 600`)
      .all() as { tool_calls: string }[];
    for (const r of rows) {
      try {
        const arr = JSON.parse(r.tool_calls) as { name?: string }[];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item?.name) {
              counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
            }
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore if table empty
  }

  return TOOL_DEFINITIONS.map((t) => ({
    name: t.key,
    label: t.label,
    group: t.group,
    count: counts.get(t.key) ?? 0,
  })).sort((a, b) => b.count - a.count);
}

function getRecentUserRequests(limit = 6): { content: string; senderName: string; threadId: string; createdAt: string }[] {
  try {
    const rows = db
      .prepare(
        `SELECT content, COALESCE(sender_name, 'Người dùng') as sender_name, thread_id, created_at
         FROM messages
         WHERE role = 'user' AND LENGTH(TRIM(content)) > 5
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(limit) as { content: string; sender_name: string; thread_id: string; created_at: string }[];
    return rows.map((r) => ({
      content: r.content.slice(0, 180),
      senderName: r.sender_name,
      threadId: r.thread_id,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

function getKnowledgeAndScheduleStats(): {
  memoriesCount: number;
  knowledgeCount: number;
  scheduledCount: number;
  scheduledJobs: { name: string; kind: string; scheduleKind: string }[];
} {
  let memoriesCount = 0;
  let knowledgeCount = 0;
  let scheduledCount = 0;
  let scheduledJobs: { name: string; kind: string; scheduleKind: string }[] = [];
  try {
    memoriesCount = (db.prepare(`SELECT COUNT(*) as n FROM memories`).get() as { n: number })?.n ?? 0;
  } catch {}
  try {
    knowledgeCount = (db.prepare(`SELECT COUNT(*) as n FROM shared_knowledge`).get() as { n: number })?.n ?? 0;
  } catch {}
  try {
    scheduledCount = (db.prepare(`SELECT COUNT(*) as n FROM scheduled_jobs WHERE enabled = 1`).get() as { n: number })?.n ?? 0;
    const rows = db
      .prepare(`SELECT name, kind, schedule_kind FROM scheduled_jobs WHERE enabled = 1 ORDER BY id DESC LIMIT 5`)
      .all() as { name: string; kind: string; schedule_kind: string }[];
    scheduledJobs = rows.map((r) => ({ name: r.name, kind: r.kind, scheduleKind: r.schedule_kind }));
  } catch {}
  return { memoriesCount, knowledgeCount, scheduledCount, scheduledJobs };
}

/**
 * Trang Dashboard 3 Tab (`/radar`) lấy 100% dữ liệu thực tế từ hệ thống VBAIBot:
 * - Tab 1: Bảng Hoạt động & Nhu cầu Thực tế (Top phiên, Câu hỏi người dùng, Tần suất gọi Tool, Tri thức & Lịch trình, Kỹ năng `.agents/skills`)
 * - Tab 2: Bản đồ nhiệt Hoạt động theo Ngày & Công cụ (Dữ liệu thật từ `agent_turns`, `messages`, `agent_steps`)
 * - Tab 3: Kiến trúc Năng lực Hệ thống VBAIBot (Danh sách thật từ `agents`, `accounts`, `.agents/skills`, `.agents/skill-drafts`, `TOOL_DEFINITIONS`)
 */
export function getRadarDashboardHtml(): string {
  const nowStr = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const insight = getAccountInsight("all", 30);
  const report14 = getReport(7);
  const accounts = listAccounts();
  const agents = listAgents();
  const skills = loadAllSkills();
  const drafts = listSkillDrafts();
  const sysInfo = getSystemInfo();
  const toolUsage = getRealToolUsageCounts();
  const recentRequests = getRecentUserRequests(6);
  const ksStats = getKnowledgeAndScheduleStats();

  const topTools = toolUsage.filter((t) => t.count > 0).slice(0, 6);
  const displayTools = topTools.length > 0 ? topTools : toolUsage.slice(0, 6);
  const maxToolCount = Math.max(1, ...displayTools.map((t) => t.count));

  const topThreads = insight.topThreads.slice(0, 6);
  const dailyRows = report14.daily.slice(-7).reverse();

  // Phân nhóm kỹ năng thật trong .agents/skills
  const adminLegalSkills = skills.filter((s) => /nd30|hd05|hanh-chinh|legal|van-ban/i.test(s.id));
  const financeTaxSkills = skills.filter((s) => /accounting|tax|banking|finance/i.test(s.id));
  const otherSkills = skills.filter(
    (s) => !adminLegalSkills.includes(s) && !financeTaxSkills.includes(s),
  );

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>Radar Dữ Liệu Hệ Thống VBAIBot — Bảng Hoạt Động & Bản Đồ Nhiệt</title>
  <style>
    :root {
      --bg: #f6f4ef;
      --card: #ffffff;
      --text: #1c1e21;
      --muted: #646a73;
      --border: #e5e1d8;
      --teal: #0d9488;
      --teal-dark: #0f766e;
      --teal-soft: #ccfbf1;
      --amber: #d97706;
      --red: #e11d48;
      --blue: #2563eb;
      --purple: #7c3aed;
      --green: #16a34a;
      --dark-bar: #0f172a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding-bottom: 60px;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(246, 244, 239, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 16px;
    }
    .brand-badge {
      background: var(--teal-dark);
      color: #fff;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
    }
    .tabs {
      display: flex;
      gap: 6px;
      background: #eae6dc;
      padding: 4px;
      border-radius: 10px;
      overflow-x: auto;
    }
    .tab-btn {
      border: none;
      background: transparent;
      padding: 8px 14px;
      border-radius: 7px;
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .tab-btn.active {
      background: var(--card);
      color: var(--text);
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .sep-link {
      text-decoration: none;
      background: #16a34a;
      color: #fff;
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }
    .header-box {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px 22px;
      margin-bottom: 20px;
    }
    .header-box h1 {
      font-size: 24px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .pill-date {
      font-size: 13px;
      background: var(--teal-dark);
      color: #fff;
      padding: 3px 10px;
      border-radius: 6px;
      font-weight: 600;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 16px;
      font-size: 13px;
      color: var(--muted);
      margin-top: 8px;
    }
    .meta-grid strong { color: var(--text); }
    .hint-banner {
      margin-top: 12px;
      background: #f3f0e6;
      border-left: 3px solid var(--amber);
      padding: 8px 12px;
      font-size: 12.5px;
      color: #4b5563;
      border-radius: 0 6px 6px 0;
    }
    .kanban {
      display: grid;
      grid-template-columns: repeat(5, minmax(240px, 1fr));
      gap: 14px;
      overflow-x: auto;
      padding-bottom: 8px;
    }
    .col-head {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 8px 4px;
      border-bottom: 2px solid var(--text);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .col-head .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 6px;
    }
    .k-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 10px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .k-card.warm-tint { background: #fffbeb; border-color: #fde68a; }
    .k-card.green-tint { background: #f0fdf4; border-color: #bbf7d0; }
    .k-tag {
      font-size: 11px;
      font-weight: 700;
      color: var(--red);
      margin-bottom: 4px;
      display: block;
    }
    .k-title {
      font-weight: 700;
      font-size: 14px;
      margin-bottom: 6px;
      color: var(--text);
      word-break: break-word;
    }
    .k-desc {
      font-size: 12.5px;
      color: var(--muted);
      margin-bottom: 8px;
      word-break: break-word;
    }
    .badge-src {
      display: inline-block;
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 5px;
      background: #f1f5f9;
      color: #334155;
      margin-right: 4px;
      margin-top: 4px;
      font-weight: 500;
    }
    .big-metric {
      font-size: 20px;
      font-weight: 800;
      color: var(--purple);
      line-height: 1.1;
      margin-bottom: 4px;
    }
    .heatmap-wrap {
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      gap: 18px;
    }
    @media (max-width: 1024px) {
      .heatmap-wrap { grid-template-columns: 1fr; }
    }
    .heatmap-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px;
      overflow-x: auto;
    }
    table.hm-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 4px;
      font-size: 12px;
    }
    table.hm-table th {
      font-weight: 600;
      color: var(--muted);
      padding: 6px 4px;
      text-align: center;
      font-size: 11px;
    }
    table.hm-table td.topic-name {
      font-weight: 600;
      color: var(--text);
      padding: 8px 10px;
      white-space: nowrap;
      background: #faf8f5;
      border-radius: 6px;
    }
    .hm-cell {
      text-align: center;
      border-radius: 6px;
      padding: 8px 6px;
      font-weight: 700;
    }
    .hm-0 { background: #f8fafc; color: #cbd5e1; }
    .hm-1 { background: #ccfbf1; color: #115e59; }
    .hm-2 { background: #5eead4; color: #134e4a; }
    .hm-3 { background: #14b8a6; color: #ffffff; }
    .hm-4 { background: #0f766e; color: #ffffff; }
    .bar-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 12.5px;
    }
    .bar-label { width: 220px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar-track { flex: 1; background: #f1f5f9; height: 12px; border-radius: 99px; overflow: hidden; }
    .bar-fill { background: var(--teal-dark); height: 100%; border-radius: 99px; }
    .bar-val { width: 52px; text-align: right; font-weight: 700; font-size: 12px; }
    .dark-header {
      background: var(--dark-bar);
      color: #fff;
      padding: 16px 22px;
      border-radius: 14px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .comp-top {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 18px;
      margin-bottom: 18px;
    }
    @media (max-width: 1024px) {
      .comp-top { grid-template-columns: 1fr; }
    }
    .matrix-grid {
      display: grid;
      grid-template-columns: 120px repeat(3, 1fr);
      gap: 8px;
      margin-top: 10px;
      font-size: 12px;
    }
    .matrix-cell {
      border: 1px solid var(--border);
      background: #fafaf9;
      border-radius: 8px;
      padding: 10px;
      min-height: 92px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-content: flex-start;
    }
    .matrix-cell.gap-opportunity {
      border: 2px dashed var(--green);
      background: #f0fdf4;
      flex-direction: column;
      justify-content: center;
    }
    .pill-comp {
      background: var(--teal-dark);
      color: #fff;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }
    .pill-comp.light {
      background: #e2e8f0;
      color: #1e293b;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .stat-box {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
    }
    .stat-box .big { font-size: 24px; font-weight: 800; color: var(--text); }
    .stat-box .lbl { font-size: 11.5px; color: var(--muted); }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span>📊 Radar Hệ Thống VBAIBot</span>
      <span class="brand-badge">Dữ liệu thực thời gian thực</span>
    </div>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('tab-cohoi')" id="btn-tab-cohoi">1. Bảng Hoạt động & Nhu cầu (${insight.totalTurns} lượt)</button>
      <button class="tab-btn" onclick="switchTab('tab-heatmap')" id="btn-tab-heatmap">2. Bản đồ nhiệt Ngày & Công cụ</button>
      <button class="tab-btn" onclick="switchTab('tab-doithu')" id="btn-tab-doithu">3. Ma trận Agent & Kỹ năng (${skills.length} skills)</button>
    </div>
    <a href="/sep" class="sep-link">🟢 Mở Sếp Workspace (Voice)</a>
  </header>

  <main class="container">
    <!-- TAB 1: BẢNG HOẠT ĐỘNG & NHU CẦU THỰC TẾ TỪ DB VBAIBOT -->
    <section id="tab-cohoi" class="tab-pane active">
      <div class="header-box">
        <h1>Bảng Hoạt động & Nhu cầu Thực tế VBAIBot <span class="pill-date">${esc(nowStr)}</span></h1>
        <div class="meta-grid">
          <span>Nguồn dữ liệu</span><strong>Trích xuất trực tiếp từ SQLite DB & thư mục <code>.agents/skills</code> của VBAIBot</strong>
          <span>Tài khoản & Agent</span><strong>${accounts.length} tài khoản Zalo (${accounts.filter((a) => a.enabled).length} đang bật) · ${agents.length} Agent cấu hình · ${TOOL_DEFINITIONS.length} Công cụ</strong>
          <span>Thống kê 30 ngày</span><strong>${insight.totalThreads} phiên hoạt động · ${insight.totalTurns.toLocaleString("vi-VN")} lượt AI · ${insight.totalTokens.toLocaleString("vi-VN")} tokens · Phản hồi TB ${insight.averageResponseTimeMs}ms</strong>
        </div>
        <div class="hint-banner">
          💡 Toàn bộ dữ liệu dưới đây được truy vấn trực tiếp từ hệ thống VBAIBot (không dùng dữ liệu mẫu bên ngoài): Phiên sôi nổi nhất, Yêu cầu thực tế của người dùng, Công cụ được gọi nhiều nhất, Kho tri thức và Kỹ năng hệ thống.
        </div>
      </div>

      <div class="kanban">
        <!-- Cột 1: Top Phiên trò chuyện thật -->
        <div>
          <div class="col-head"><span><span class="dot" style="background:var(--red)"></span>Phiên hoạt động mạnh</span><span>${topThreads.length}</span></div>
          ${
            topThreads.length === 0
              ? `<div class="k-card"><div class="k-desc">Chưa có phiên hoạt động trong 30 ngày qua.</div></div>`
              : topThreads
                  .map(
                    (th, idx) => `
            <div class="k-card">
              <span class="k-tag">#${idx + 1} · ${th.threadType === 1 ? "Nhóm Zalo" : "Cá nhân / Web"}</span>
              <div class="k-title">${esc(th.threadName)}</div>
              <div class="k-desc">${th.totalTurns} lượt xử lý · ${th.totalTokens.toLocaleString("vi-VN")} tokens (TB ${th.avgTokensPerTurn} tok/lượt)</div>
              <span class="badge-src">${th.activeDays} ngày hoạt động</span>
            </div>`,
                  )
                  .join("")
          }
        </div>

        <!-- Cột 2: Yêu cầu thực tế gần đây của người dùng -->
        <div>
          <div class="col-head"><span><span class="dot" style="background:var(--teal-dark)"></span>Yêu cầu người dùng mới nhất</span><span>${recentRequests.length}</span></div>
          ${
            recentRequests.length === 0
              ? `<div class="k-card"><div class="k-desc">Chưa có tin nhắn người dùng nào được ghi nhận.</div></div>`
              : recentRequests
                  .map(
                    (req) => `
            <div class="k-card">
              <div class="k-title">“${esc(req.content)}”</div>
              <div class="k-desc">Người gửi: <strong>${esc(req.senderName)}</strong></div>
              <span class="badge-src">${esc(req.createdAt.slice(0, 16).replace("T", " "))}</span>
            </div>`,
                  )
                  .join("")
          }
        </div>

        <!-- Cột 3: Công cụ thực tế được gọi -->
        <div>
          <div class="col-head"><span><span class="dot" style="background:var(--blue)"></span>Công cụ (Tools) gọi nhiều</span><span>${TOOL_DEFINITIONS.length}</span></div>
          ${displayTools
            .map(
              (t) => `
            <div class="k-card">
              <div class="k-title">${esc(t.label)} (<code>${esc(t.name)}</code>)</div>
              <div class="k-desc">Nhóm: <strong>${esc(t.group)}</strong> · Đã gọi: <strong>${t.count}</strong> lần trong các bước gần nhất</div>
              <span class="badge-src">Tool hệ thống</span>
            </div>`,
            )
            .join("")}
        </div>

        <!-- Cột 4: Kho Tri thức, Bộ nhớ & Lịch tự động -->
        <div>
          <div class="col-head"><span><span class="dot" style="background:var(--purple)"></span>Tri thức & Lịch tự động</span><span>${ksStats.scheduledCount}</span></div>
          <div class="k-card">
            <div class="big-metric">${ksStats.knowledgeCount}</div>
            <div class="k-title">Mục Tri thức dùng chung (Shared Knowledge)</div>
            <div class="k-desc">Bộ nhớ hội thoại cá nhân hóa: <strong>${ksStats.memoriesCount}</strong> bản ghi</div>
            <span class="badge-src">SQLite DB</span>
          </div>
          <div class="k-card">
            <div class="big-metric">${ksStats.scheduledCount}</div>
            <div class="k-title">Lịch trình tự động đang bật (Scheduled Jobs)</div>
            <div class="k-desc">
              ${
                ksStats.scheduledJobs.length === 0
                  ? "Chưa có lịch trình nào đang bật."
                  : ksStats.scheduledJobs.map((j) => `• ${esc(j.name)} (${esc(j.scheduleKind)})`).join("<br/>")
              }
            </div>
            <span class="badge-src">Scheduler</span>
          </div>
        </div>

        <!-- Cột 5: Kỹ năng thực tế (.agents/skills) & Sandbox -->
        <div>
          <div class="col-head"><span><span class="dot" style="background:var(--amber)"></span>Kỹ năng (.agents/skills)</span><span>${skills.length}</span></div>
          <div class="k-card green-tint">
            <span class="k-tag" style="color:var(--green)">XƯỞNG SKILL SANDBOX</span>
            <div class="k-title">${drafts.length} bản nháp trong <code>.agents/skill-drafts</code></div>
            <div class="k-desc">
              ${
                drafts.length === 0
                  ? "Không có bản nháp chờ duyệt."
                  : drafts.map((d) => `• <strong>${esc(d.name)}</strong> (<code>${esc(d.id)}</code>)`).join("<br/>")
              }
            </div>
            <a href="/sep" class="badge-src" style="background:#dcfce7;color:#166534;text-decoration:none">Mở Xưởng Skill ↗</a>
          </div>
          ${skills
            .slice(0, 5)
            .map(
              (sk) => `
            <div class="k-card warm-tint">
              <span class="k-tag" style="color:var(--amber)">SKILL: ${esc(sk.id)}</span>
              <div class="k-title">${esc(sk.name)}</div>
              <div class="k-desc">${esc(sk.description.slice(0, 120))}...</div>
            </div>`,
            )
            .join("")}
        </div>
      </div>
    </section>

    <!-- TAB 2: BẢN ĐỒ NHIỆT HOẠT ĐỘNG THEO NGÀY & CÔNG CỤ -->
    <section id="tab-heatmap" class="tab-pane">
      <div class="header-box">
        <h1>Bản đồ nhiệt Hoạt động 7 ngày gần nhất <span class="pill-date">Dữ liệu thực VBAIBot</span></h1>
        <p style="font-size:13px;color:var(--muted)">Thống kê trực tiếp từ bảng <code>messages</code> và <code>agent_turns</code> theo múi giờ hệ thống.</p>
      </div>

      <div class="heatmap-wrap">
        <div class="heatmap-card">
          <table class="hm-table">
            <thead>
              <tr>
                <th style="text-align:left">Ngày</th>
                <th>Tin người dùng</th>
                <th>Tin Bot trả lời</th>
                <th>Lượt AI (Turns)</th>
                <th>Tổng Tokens</th>
                <th>Liên hệ mới</th>
                <th>Cảnh báo / Lỗi</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRows
                .map((d) => {
                  const turnClass = d.turns > 50 ? "hm-4" : d.turns > 20 ? "hm-3" : d.turns > 5 ? "hm-2" : d.turns > 0 ? "hm-1" : "hm-0";
                  const msgClass = d.user > 50 ? "hm-4" : d.user > 20 ? "hm-3" : d.user > 5 ? "hm-2" : d.user > 0 ? "hm-1" : "hm-0";
                  return `
              <tr>
                <td class="topic-name">${esc(d.day)}</td>
                <td class="hm-cell ${msgClass}">${d.user}</td>
                <td class="hm-cell ${msgClass}">${d.bot}</td>
                <td class="hm-cell ${turnClass}">${d.turns}</td>
                <td class="hm-cell ${d.tokens > 0 ? "hm-2" : "hm-0"}">${d.tokens.toLocaleString("vi-VN")}</td>
                <td class="hm-cell ${d.newContacts > 0 ? "hm-1" : "hm-0"}">${d.newContacts}</td>
                <td class="hm-cell ${d.errors > 0 ? "hm-4" : "hm-0"}">${d.errors} / ${d.warnings}</td>
              </tr>`;
                })
                .join("")}
            </tbody>
          </table>

          <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border)">
            <div style="font-weight:700;font-size:13px;margin-bottom:10px">Xếp hạng Công cụ (Tools) được gọi thực tế trong hệ thống</div>
            ${displayTools
              .map((t) => {
                const pct = Math.max(6, Math.round((t.count / maxToolCount) * 100));
                return `<div class="bar-row"><span class="bar-label">${esc(t.label)} (${esc(t.name)})</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="bar-val">${t.count}</span></div>`;
              })
              .join("")}
          </div>
        </div>

        <div class="heatmap-card">
          <h3 style="font-size:18px;margin-bottom:8px">Chi tiết theo Tài khoản Zalo (${accounts.length})</h3>
          ${report14.byAccount
            .map(
              (acc) => `
            <div class="k-card">
              <div class="k-title">📱 ${esc(acc.label)} (<code>${esc(acc.accountId)}</code>)</div>
              <div class="k-desc">
                Tin nhận: <strong>${acc.user}</strong> · Tin gửi: <strong>${acc.bot}</strong> · Lượt AI: <strong>${acc.turns}</strong> · Tokens: <strong>${acc.tokens.toLocaleString("vi-VN")}</strong>
              </div>
            </div>`,
            )
            .join("")}
        </div>
      </div>
    </section>

    <!-- TAB 3: MA TRẬN KIẾN TRÚC AGENT & KỸ NĂNG THỰC TẾ CỦA VBAIBOT -->
    <section id="tab-doithu" class="tab-pane">
      <div class="dark-header">
        <div>
          <strong style="font-size:16px;letter-spacing:0.03em">KIẾN TRÚC NĂNG LỰC HỆ THỐNG VBAIBOT</strong>
          <span style="font-size:12px;color:#94a3b8;margin-left:10px">Model chính: ${esc(sysInfo.llm.model)} (${esc(sysInfo.llm.provider)})</span>
        </div>
      </div>

      <div class="comp-top">
        <div class="heatmap-card">
          <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px">MA TRẬN PHÂN NHÓM KỸ NĂNG (.agents/skills) & AGENT TRONG SOURCE VBAIBOT</div>
          <div class="matrix-grid">
            <div style="font-weight:600;align-self:center">Hành chính & Pháp lý</div>
            <div class="matrix-cell">
              ${adminLegalSkills.map((s) => `<span class="pill-comp">${esc(s.name)}</span>`).join("")}
            </div>
            <div class="matrix-cell">
              <span class="pill-comp light">qppl_lamdong</span>
              <span class="pill-comp light">national_legal</span>
              <span class="pill-comp light">legal_search</span>
            </div>
            <div class="matrix-cell">
              <span class="pill-comp light">create_admin_document</span>
              <span class="pill-comp light">review_admin_document</span>
            </div>

            <div style="font-weight:600;align-self:center">Tài chính, Kế toán & Thuế</div>
            <div class="matrix-cell">
              ${financeTaxSkills.map((s) => `<span class="pill-comp">${esc(s.name)}</span>`).join("")}
            </div>
            <div class="matrix-cell">
              <span class="pill-comp light">finance_tracker</span>
              <span class="pill-comp light">create_excel_file</span>
            </div>
            <div class="matrix-cell gap-opportunity">
              <div style="font-weight:800;color:#15803d;font-size:13px">🛠️ Xưởng Skill Sandbox</div>
              <div style="font-size:12px;color:#166534">${drafts.length} bản nháp đang thử nghiệm · ${skills.length} kỹ năng chính thức</div>
            </div>

            <div style="font-weight:600;align-self:center">Agent & Đa phương tiện</div>
            <div class="matrix-cell">
              ${agents.map((a) => `<span class="pill-comp">${esc(a.icon)} ${esc(a.name)}</span>`).join("")}
            </div>
            <div class="matrix-cell">
              ${otherSkills.map((s) => `<span class="pill-comp">${esc(s.name)}</span>`).join("")}
            </div>
            <div class="matrix-cell">
              <span class="pill-comp light">delegate_to_bot</span>
              <span class="pill-comp light">create_voice_summary</span>
              <span class="pill-comp light">notebooklm</span>
            </div>

            <div></div>
            <div style="text-align:center;font-weight:600;color:var(--muted)">Kỹ năng & Agent</div>
            <div style="text-align:center;font-weight:600;color:var(--muted)">Công cụ Tra cứu / Xử lý</div>
            <div style="text-align:center;font-weight:600;color:var(--muted)">Công cụ Xuất bản / Điều phối</div>
          </div>
        </div>

        <div class="heatmap-card">
          <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px">CHỈ SỐ HỆ THỐNG THỰC TẾ</div>
          <div class="stat-grid">
            <div class="stat-box"><div class="big">${skills.length}</div><div class="lbl">Kỹ năng (.agents/skills)</div></div>
            <div class="stat-box"><div class="big">${drafts.length}</div><div class="lbl">Bản nháp Sandbox</div></div>
            <div class="stat-box"><div class="big">${TOOL_DEFINITIONS.length}</div><div class="lbl">Công cụ (Tools)</div></div>
            <div class="stat-box"><div class="big">${agents.length}</div><div class="lbl">Agent trong DB</div></div>
            <div class="stat-box"><div class="big">${accounts.length}</div><div class="lbl">Tài khoản Zalo</div></div>
            <div class="stat-box"><div class="big">${insight.totalTurns}</div><div class="lbl">Lượt xử lý (30 ngày)</div></div>
          </div>
          <div style="background:#0f172a;color:#fff;padding:12px 14px;border-radius:10px;font-size:12.5px;line-height:1.5">
            <strong style="color:#4ade80">Danh sách Kỹ năng thực tế trong mã nguồn VBAIBot:</strong>
            <ul style="padding-left:16px;margin-top:6px;color:#cbd5e1">
              ${skills.map((s) => `<li><strong>${esc(s.name)}</strong> (<code>${esc(s.id)}</code>)</li>`).join("")}
            </ul>
          </div>
        </div>
      </div>
    </section>
  </main>

  <script>
    function switchTab(id) {
      document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      const pane = document.getElementById(id);
      if (pane) pane.classList.add('active');
      const btn = document.getElementById('btn-' + id);
      if (btn) btn.classList.add('active');
    }
  </script>
</body>
</html>`;
}
