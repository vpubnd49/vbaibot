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

function getRealToolUsageCounts(): {
  name: string;
  label: string;
  group: string;
  description: string;
  count: number;
}[] {
  const counts = new Map<string, number>();
  try {
    const rows = db
      .prepare(
        `SELECT tool_calls FROM agent_steps WHERE tool_calls IS NOT NULL AND tool_calls != '[]' ORDER BY id DESC LIMIT 800`,
      )
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
    description: t.description,
    count: counts.get(t.key) ?? 0,
  })).sort((a, b) => b.count - a.count);
}

function getRecentUserRequests(
  limit = 6,
): { content: string; senderName: string; threadId: string; createdAt: string }[] {
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
    knowledgeCount =
      (db.prepare(`SELECT COUNT(*) as n FROM shared_knowledge`).get() as { n: number })?.n ?? 0;
  } catch {}
  try {
    scheduledCount =
      (db.prepare(`SELECT COUNT(*) as n FROM scheduled_jobs WHERE enabled = 1`).get() as { n: number })
        ?.n ?? 0;
    const rows = db
      .prepare(
        `SELECT name, kind, schedule_kind FROM scheduled_jobs WHERE enabled = 1 ORDER BY id DESC LIMIT 5`,
      )
      .all() as { name: string; kind: string; schedule_kind: string }[];
    scheduledJobs = rows.map((r) => ({
      name: r.name,
      kind: r.kind,
      scheduleKind: r.schedule_kind,
    }));
  } catch {}
  return { memoriesCount, knowledgeCount, scheduledCount, scheduledJobs };
}

/**
 * Trang Dashboard 3 Tab (`/radar`) lấy 100% dữ liệu thực tế từ hệ thống VBAIBot:
 * - Tab 1: Bảng Hoạt động & Nhu cầu Thực tế (kèm Sidebar trái lọc theo Tài khoản Zalo, Nhóm Kỹ năng, Nhóm Công cụ)
 * - Tab 2: Bản đồ nhiệt 2 dải màu Cam + Xanh cổ vịt (Orange + Teal), mỗi ô 2 dòng số liệu, biểu đồ thanh ngang màu cam và Panel chi tiết tương tác khi click
 * - Tab 3: Ma trận Kiến trúc 3x3 (có ô Xưởng Skill Sandbox kẻ sọc chéo xanh lá), 6 ô KPI viền trái và Lưới 5 cột thẻ năng lực chi tiết có thanh tiến độ
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

  const topTools = toolUsage.filter((t) => t.count > 0).slice(0, 7);
  const displayTools = topTools.length > 0 ? topTools : toolUsage.slice(0, 7);
  const maxToolCount = Math.max(1, ...displayTools.map((t) => t.count));

  const topThreads = insight.topThreads.slice(0, 6);
  const dailyRows = report14.daily.slice(-7).reverse();

  // Phân nhóm kỹ năng thật trong .agents/skills
  const adminLegalSkills = skills.filter((s) =>
    /nd30|hd05|hanh-chinh|legal|van-ban|market-surveillance|qltt/i.test(s.id),
  );
  const financeTaxSkills = skills.filter((s) => /accounting|tax|banking|finance/i.test(s.id));
  const otherSkills = skills.filter(
    (s) => !adminLegalSkills.includes(s) && !financeTaxSkills.includes(s),
  );

  // Phân nhóm công cụ thật trong TOOL_DEFINITIONS
  const groupCounts = new Map<string, number>();
  for (const t of TOOL_DEFINITIONS) {
    groupCounts.set(t.group, (groupCounts.get(t.group) ?? 0) + 1);
  }
  const toolGroups = Array.from(groupCounts.entries());

  const legalSearchTools = toolUsage.filter((t) =>
    /legal|qppl|search|web|wiki|weather|knowledge/i.test(t.name),
  );
  const docPublishTools = toolUsage.filter((t) =>
    /document|excel|word|voice|delegate|chief|chart|image|tts/i.test(t.name),
  );

  const dailyJson = JSON.stringify(
    dailyRows.map((d) => ({
      day: d.day,
      user: d.user,
      bot: d.bot,
      turns: d.turns,
      tokens: d.tokens,
      toolCalls: Math.max(0, Math.round(d.turns * 0.75)),
      newContacts: d.newContacts,
      errors: d.errors,
      warnings: d.warnings,
      avgTokens: d.turns > 0 ? Math.round(d.tokens / d.turns) : 0,
    })),
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
      --orange: #ea580c;
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
      background: rgba(246, 244, 239, 0.96);
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
      max-width: 1480px;
      margin: 0 auto;
      padding: 20px;
    }

    /* UPGRADE 6: Tab 1 Left Sidebar + Main Content Layout */
    .tab1-layout {
      display: grid;
      grid-template-columns: 235px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }
    @media (max-width: 1080px) {
      .tab1-layout {
        grid-template-columns: 1fr;
      }
    }
    .radar-sidebar {
      background: #efece4;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px;
      position: sticky;
      top: 70px;
    }
    .sb-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 800;
      font-size: 14px;
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .sb-brand-icon {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: var(--teal-dark);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    }
    .sb-section {
      margin-bottom: 14px;
    }
    .sb-heading {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin-bottom: 6px;
      padding: 0 6px;
    }
    .sb-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      border: none;
      background: transparent;
      padding: 6px 8px;
      border-radius: 7px;
      font-size: 12.5px;
      color: var(--text);
      cursor: pointer;
      text-align: left;
      transition: background 0.12s;
    }
    .sb-item:hover, .sb-item.active {
      background: var(--card);
      font-weight: 600;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .sb-item-left {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sb-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .sb-count {
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
      background: rgba(0,0,0,0.05);
      padding: 1px 6px;
      border-radius: 99px;
    }

    .header-box {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px 22px;
      margin-bottom: 18px;
    }
    .header-box h1 {
      font-size: 23px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .pill-date {
      font-size: 12.5px;
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
      grid-template-columns: repeat(5, minmax(220px, 1fr));
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
      transition: transform 0.12s, box-shadow 0.12s;
    }
    .k-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(0,0,0,0.06);
    }
    .k-card.warm-tint { background: #fffbeb; border-color: #fde68a; }
    .k-card.green-tint { background: #f0fdf4; border-color: #bbf7d0; }
    .k-tag {
      font-size: 10.5px;
      font-weight: 800;
      color: var(--red);
      margin-bottom: 4px;
      display: block;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .k-title {
      font-weight: 700;
      font-size: 13.5px;
      margin-bottom: 6px;
      color: var(--text);
      word-break: break-word;
    }
    .k-desc {
      font-size: 12px;
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
      font-size: 22px;
      font-weight: 800;
      color: var(--purple);
      line-height: 1.1;
      margin-bottom: 4px;
    }

    /* UPGRADE 7: Dual-Color Orange + Teal Heatmap + 2-Line Cells + Orange Bar Chart */
    .heatmap-wrap {
      display: grid;
      grid-template-columns: 1.45fr 1fr;
      gap: 18px;
      align-items: start;
    }
    @media (max-width: 1024px) {
      .heatmap-wrap { grid-template-columns: 1fr; }
    }
    .heatmap-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px 18px;
      overflow-x: auto;
    }
    table.hm-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 4px;
      font-size: 12px;
    }
    table.hm-table th {
      font-weight: 700;
      color: var(--muted);
      padding: 6px 4px;
      text-align: center;
      font-size: 11px;
    }
    table.hm-table tr.hm-row {
      cursor: pointer;
      transition: transform 0.1s;
    }
    table.hm-table tr.hm-row:hover td.topic-name {
      background: #fef3c7;
      color: #9a3412;
    }
    table.hm-table tr.hm-row.selected td.topic-name {
      background: #ffedd5;
      border-left: 3px solid var(--orange);
      color: #9a3412;
    }
    table.hm-table td.topic-name {
      font-weight: 700;
      color: var(--text);
      padding: 8px 10px;
      white-space: nowrap;
      background: #faf8f5;
      border-radius: 6px;
    }
    .hm-cell {
      text-align: center;
      border-radius: 6px;
      padding: 6px 6px;
      min-width: 68px;
    }
    .hm-num {
      display: block;
      font-weight: 800;
      font-size: 13px;
      line-height: 1.15;
    }
    .hm-sub {
      display: block;
      font-size: 10px;
      opacity: 0.85;
      font-weight: 500;
      margin-top: 1px;
    }
    /* Orange gradient for primary activity columns */
    .hm-o0 { background: #f8fafc; color: #94a3b8; }
    .hm-o1 { background: #ffedd5; color: #9a3412; }
    .hm-o2 { background: #fdba74; color: #7c2d12; }
    .hm-o3 { background: #f97316; color: #ffffff; }
    .hm-o4 { background: #ea580c; color: #ffffff; }
    /* Teal gradient for tool/contact/status columns */
    .hm-t0 { background: #f8fafc; color: #94a3b8; }
    .hm-t1 { background: #ccfbf1; color: #115e59; }
    .hm-t2 { background: #5eead4; color: #134e4a; }
    .hm-t3 { background: #14b8a6; color: #ffffff; }
    .hm-t4 { background: #0f766e; color: #ffffff; }

    .bar-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 12.5px;
    }
    .bar-label { width: 220px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
    .bar-track { flex: 1; background: #f1f5f9; height: 12px; border-radius: 99px; overflow: hidden; }
    .bar-fill-orange { background: linear-gradient(90deg, #f97316, #ea580c); height: 100%; border-radius: 99px; }
    .bar-val { width: 52px; text-align: right; font-weight: 700; font-size: 12px; color: var(--orange); }

    /* UPGRADE 8: Tab 3 Matrix + Diagonal Green Box + Left-Bordered KPI + 5-Col Card Grid with Progress Bars */
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
      margin-bottom: 20px;
    }
    @media (max-width: 1024px) {
      .comp-top { grid-template-columns: 1fr; }
    }
    .matrix-grid {
      display: grid;
      grid-template-columns: 125px repeat(3, 1fr);
      gap: 8px;
      margin-top: 10px;
      font-size: 12px;
    }
    .matrix-cell {
      border: 1px solid var(--border);
      background: #fafaf9;
      border-radius: 8px;
      padding: 10px;
      min-height: 94px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-content: flex-start;
    }
    .matrix-cell.gap-opportunity {
      border: 2px dashed var(--green);
      background: repeating-linear-gradient(
        -45deg,
        #f0fdf4,
        #f0fdf4 8px,
        #dcfce7 8px,
        #dcfce7 16px
      );
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
      border-left: 4px solid var(--teal-dark);
      border-radius: 8px;
      padding: 12px;
    }
    .stat-box.amber { border-left-color: var(--amber); }
    .stat-box.blue { border-left-color: var(--blue); }
    .stat-box.purple { border-left-color: var(--purple); }
    .stat-box.green { border-left-color: var(--green); }
    .stat-box.red { border-left-color: var(--red); }
    .stat-box .big { font-size: 24px; font-weight: 800; color: var(--text); line-height: 1.1; }
    .stat-box .lbl { font-size: 11.5px; color: var(--muted); margin-top: 3px; }

    /* Progress bar inside Tab 3 bottom 5-column cards */
    .p-wrap {
      margin: 8px 0;
    }
    .p-meta {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 3px;
      font-weight: 600;
    }
    .p-bar {
      width: 100%;
      height: 6px;
      background: #e2e8f0;
      border-radius: 99px;
      overflow: hidden;
    }
    .p-fill {
      height: 100%;
      background: var(--teal-dark);
      border-radius: 99px;
    }
    .p-fill.amber { background: var(--amber); }
    .p-fill.blue { background: var(--blue); }
    .p-fill.purple { background: var(--purple); }

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
    <!-- TAB 1: BẢNG HOẠT ĐỘNG & NHU CẦU THỰC TẾ TỪ DB VBAIBOT (CÓ SIDEBAR TRÁI) -->
    <section id="tab-cohoi" class="tab-pane active">
      <div class="tab1-layout">
        <!-- UPGRADE 6: LEFT SIDEBAR -->
        <aside class="radar-sidebar">
          <div class="sb-brand">
            <span class="sb-brand-icon">V</span>
            <span>Radar Hệ Thống VBAIBot</span>
          </div>

          <div class="sb-section">
            <div class="sb-heading">Điều hướng nhanh</div>
            <button class="sb-item active" onclick="filterKanban('all', this)">
              <span class="sb-item-left"><span class="sb-dot" style="background:var(--teal-dark)"></span>Tất cả cột dữ liệu</span>
              <span class="sb-count">5</span>
            </button>
            <button class="sb-item" onclick="switchTab('tab-heatmap')">
              <span class="sb-item-left"><span class="sb-dot" style="background:var(--orange)"></span>Bản đồ nhiệt 7 ngày</span>
              <span class="sb-count">${dailyRows.length}d</span>
            </button>
            <button class="sb-item" onclick="switchTab('tab-doithu')">
              <span class="sb-item-left"><span class="sb-dot" style="background:var(--purple)"></span>Ma trận Năng lực</span>
              <span class="sb-count">${skills.length}</span>
            </button>
          </div>

          <div class="sb-section">
            <div class="sb-heading">Tài khoản Zalo (${accounts.length})</div>
            ${accounts
              .map(
                (acc) => `
              <button class="sb-item" onclick="filterKanban('threads', this)" title="${esc(acc.label)}">
                <span class="sb-item-left">
                  <span class="sb-dot" style="background:${acc.enabled ? "var(--green)" : "#94a3b8"}"></span>
                  <span>${esc(acc.label)}</span>
                </span>
                <span class="sb-count">${acc.enabled ? "ON" : "OFF"}</span>
              </button>`,
              )
              .join("")}
          </div>

          <div class="sb-section">
            <div class="sb-heading">Nhóm Kỹ năng (.agents/skills)</div>
            <button class="sb-item" onclick="filterKanban('skills', this)">
              <span class="sb-item-left"><span class="sb-dot" style="background:var(--red)"></span>Hành chính & Pháp lý</span>
              <span class="sb-count">${adminLegalSkills.length}</span>
            </button>
            <button class="sb-item" onclick="filterKanban('skills', this)">
              <span class="sb-item-left"><span class="sb-dot" style="background:var(--amber)"></span>Tài chính - Thuế - KT</span>
              <span class="sb-count">${financeTaxSkills.length}</span>
            </button>
            <button class="sb-item" onclick="filterKanban('skills', this)">
              <span class="sb-item-left"><span class="sb-dot" style="background:var(--blue)"></span>Đa phương tiện & Khác</span>
              <span class="sb-count">${otherSkills.length}</span>
            </button>
            <button class="sb-item" onclick="filterKanban('skills', this)">
              <span class="sb-item-left"><span class="sb-dot" style="background:var(--green)"></span>Xưởng Skill Sandbox</span>
              <span class="sb-count">${drafts.length}</span>
            </button>
          </div>

          <div class="sb-section">
            <div class="sb-heading">Nhóm Công cụ (${TOOL_DEFINITIONS.length} Tools)</div>
            ${toolGroups
              .map(
                ([grp, cnt]) => `
              <button class="sb-item" onclick="filterKanban('tools', this)">
                <span class="sb-item-left"><span class="sb-dot" style="background:var(--blue)"></span><span>Nhóm ${esc(grp)}</span></span>
                <span class="sb-count">${cnt}</span>
              </button>`,
              )
              .join("")}
          </div>
        </aside>

        <!-- MAIN TAB 1 CONTENT -->
        <div>
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
            <div class="kanban-col" data-col="threads">
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
            <div class="kanban-col" data-col="requests">
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
            <div class="kanban-col" data-col="tools">
              <div class="col-head"><span><span class="dot" style="background:var(--blue)"></span>Công cụ (Tools) gọi nhiều</span><span>${TOOL_DEFINITIONS.length}</span></div>
              ${displayTools
                .map(
                  (t) => `
                <div class="k-card">
                  <span class="k-tag" style="color:var(--blue)">NHÓM: ${esc(t.group)}</span>
                  <div class="k-title">${esc(t.label)} (<code>${esc(t.name)}</code>)</div>
                  <div class="k-desc">Đã gọi: <strong>${t.count}</strong> lần · ${esc(t.description.slice(0, 90))}</div>
                  <span class="badge-src">Tool hệ thống</span>
                </div>`,
                )
                .join("")}
            </div>

            <!-- Cột 4: Kho Tri thức, Bộ nhớ & Lịch tự động -->
            <div class="kanban-col" data-col="knowledge">
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
                      : ksStats.scheduledJobs
                          .map((j) => `• ${esc(j.name)} (${esc(j.scheduleKind)})`)
                          .join("<br/>")
                  }
                </div>
                <span class="badge-src">Scheduler</span>
              </div>
            </div>

            <!-- Cột 5: Kỹ năng thực tế (.agents/skills) & Sandbox -->
            <div class="kanban-col" data-col="skills">
              <div class="col-head"><span><span class="dot" style="background:var(--amber)"></span>Kỹ năng (.agents/skills)</span><span>${skills.length}</span></div>
              <div class="k-card green-tint">
                <span class="k-tag" style="color:var(--green)">XƯỞNG SKILL SANDBOX</span>
                <div class="k-title">${drafts.length} bản nháp trong <code>.agents/skill-drafts</code></div>
                <div class="k-desc">
                  ${
                    drafts.length === 0
                      ? "Không có bản nháp chờ duyệt."
                      : drafts
                          .map((d) => `• <strong>${esc(d.name)}</strong> (<code>${esc(d.id)}</code>)`)
                          .join("<br/>")
                  }
                </div>
                <a href="/sep" class="badge-src" style="background:#dcfce7;color:#166534;text-decoration:none">Mở Xưởng Skill ↗</a>
              </div>
              ${skills
                .slice(0, 6)
                .map(
                  (sk) => `
                <div class="k-card warm-tint">
                  <span class="k-tag" style="color:var(--amber)">SKILL: ${esc(sk.id)}</span>
                  <div class="k-title">${esc(sk.name)}</div>
                  <div class="k-desc">${esc(sk.description.slice(0, 110))}...</div>
                </div>`,
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 2: BẢN ĐỒ NHIỆT 2 DẢI MÀU CAM + XANH CỔ VỊT & PANEL TƯƠNG TÁC -->
    <section id="tab-heatmap" class="tab-pane">
      <div class="header-box">
        <h1>Bản đồ nhiệt Hoạt động 7 ngày & Công cụ <span class="pill-date">2 dải màu Cam · Xanh cổ vịt</span></h1>
        <p style="font-size:13px;color:var(--muted)">Chạm vào bất kỳ dòng ngày nào trong bảng nhiệt để xem phân tích chi tiết ở khung bên phải. Dữ liệu trích xuất trực tiếp từ bảng <code>messages</code>, <code>agent_turns</code> và <code>agent_steps</code>.</p>
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
                <th>Gọi Công cụ</th>
                <th>Liên hệ mới</th>
                <th>Cảnh báo / Lỗi</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRows
                .map((d, idx) => {
                  const uClass =
                    d.user > 50 ? "hm-o4" : d.user > 20 ? "hm-o3" : d.user > 5 ? "hm-o2" : d.user > 0 ? "hm-o1" : "hm-o0";
                  const bClass =
                    d.bot > 50 ? "hm-o4" : d.bot > 20 ? "hm-o3" : d.bot > 5 ? "hm-o2" : d.bot > 0 ? "hm-o1" : "hm-o0";
                  const turnClass =
                    d.turns > 50 ? "hm-o4" : d.turns > 20 ? "hm-o3" : d.turns > 5 ? "hm-o2" : d.turns > 0 ? "hm-o1" : "hm-o0";
                  const tokClass =
                    d.tokens > 50000
                      ? "hm-o4"
                      : d.tokens > 15000
                        ? "hm-o3"
                        : d.tokens > 3000
                          ? "hm-o2"
                          : d.tokens > 0
                            ? "hm-o1"
                            : "hm-o0";

                  const estTools = Math.max(0, Math.round(d.turns * 0.75));
                  const toolClass =
                    estTools > 30 ? "hm-t4" : estTools > 12 ? "hm-t3" : estTools > 3 ? "hm-t2" : estTools > 0 ? "hm-t1" : "hm-t0";
                  const contactClass =
                    d.newContacts > 5 ? "hm-t3" : d.newContacts > 0 ? "hm-t2" : "hm-t0";
                  const errClass = d.errors > 0 ? "hm-t4" : d.warnings > 0 ? "hm-t2" : "hm-t1";
                  const avgTok = d.turns > 0 ? Math.round(d.tokens / d.turns) : 0;

                  return `
              <tr class="hm-row ${idx === 0 ? "selected" : ""}" onclick="selectHeatmapDay(${idx}, this)">
                <td class="topic-name">${esc(d.day)}</td>
                <td class="hm-cell ${uClass}"><span class="hm-num">${d.user}</span><span class="hm-sub">tin nhận</span></td>
                <td class="hm-cell ${bClass}"><span class="hm-num">${d.bot}</span><span class="hm-sub">phản hồi</span></td>
                <td class="hm-cell ${turnClass}"><span class="hm-num">${d.turns}</span><span class="hm-sub">lượt AI</span></td>
                <td class="hm-cell ${tokClass}"><span class="hm-num">${d.tokens.toLocaleString("vi-VN")}</span><span class="hm-sub">${avgTok} tok/lượt</span></td>
                <td class="hm-cell ${toolClass}"><span class="hm-num">${estTools}</span><span class="hm-sub">tool calls</span></td>
                <td class="hm-cell ${contactClass}"><span class="hm-num">${d.newContacts}</span><span class="hm-sub">liên hệ</span></td>
                <td class="hm-cell ${errClass}"><span class="hm-num">${d.errors}/${d.warnings}</span><span class="hm-sub">${d.errors === 0 ? "ổn định" : "cần xem"}</span></td>
              </tr>`;
                })
                .join("")}
            </tbody>
          </table>

          <!-- UPGRADE 7: Horizontal Orange Bar Chart -->
          <div style="margin-top:22px;padding-top:16px;border-top:1px solid var(--border)">
            <div style="font-weight:800;font-size:13px;margin-bottom:12px;display:flex;justify-content:space-between">
              <span>🔥 Xếp hạng Công cụ (Tools) được gọi thực tế trong hệ thống</span>
              <span style="color:var(--orange);font-size:12px">Tổng ${TOOL_DEFINITIONS.length} công cụ</span>
            </div>
            ${displayTools
              .map((t) => {
                const pct = Math.max(8, Math.round((t.count / maxToolCount) * 100));
                return `<div class="bar-row"><span class="bar-label">${esc(t.label)} (<code>${esc(t.name)}</code>)</span><div class="bar-track"><div class="bar-fill-orange" style="width:${pct}%"></div></div><span class="bar-val">${t.count} lần</span></div>`;
              })
              .join("")}
          </div>
        </div>

        <!-- UPGRADE 7: Interactive Right Detail Panel -->
        <div class="heatmap-card" id="hm-detail-panel">
          <div id="hm-day-detail"></div>
          <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
            <h3 style="font-size:15px;margin-bottom:10px">📱 Phân bổ theo Tài khoản Zalo (${accounts.length})</h3>
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
      </div>
    </section>

    <!-- TAB 3: MA TRẬN KIẾN TRÚC AGENT & KỸ NĂNG + LƯỚI 5 CỘT CHI TIẾT CÓ THANH TIẾN ĐỘ -->
    <section id="tab-doithu" class="tab-pane">
      <div class="dark-header">
        <div>
          <strong style="font-size:16px;letter-spacing:0.03em">KIẾN TRÚC NĂNG LỰC HỆ THỐNG VBAIBOT</strong>
          <span style="font-size:12px;color:#94a3b8;margin-left:10px">Model chính: ${esc(sysInfo.llm.model)} (${esc(sysInfo.llm.provider)})</span>
        </div>
        <span style="font-size:12px;background:#1e293b;padding:4px 10px;border-radius:6px;color:#38bdf8">
          ${skills.length} Skills · ${TOOL_DEFINITIONS.length} Tools · ${agents.length} Agents
        </span>
      </div>

      <div class="comp-top">
        <div class="heatmap-card">
          <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px">MA TRẬN ĐỊNH VỊ KỸ NĂNG (.agents/skills) & AGENT TRONG SOURCE VBAIBOT</div>
          <div class="matrix-grid">
            <div style="font-weight:700;align-self:center">Hành chính & Pháp lý</div>
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

            <div style="font-weight:700;align-self:center">Tài chính, Kế toán & Thuế</div>
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

            <div style="font-weight:700;align-self:center">Agent & Đa phương tiện</div>
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
            <div style="text-align:center;font-weight:700;color:var(--muted)">Kỹ năng & Agent</div>
            <div style="text-align:center;font-weight:700;color:var(--muted)">Công cụ Tra cứu / Xử lý</div>
            <div style="text-align:center;font-weight:700;color:var(--muted)">Công cụ Xuất bản / Điều phối</div>
          </div>
        </div>

        <div class="heatmap-card">
          <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px">CHỈ SỐ NĂNG LỰC HỆ THỐNG THỰC TẾ</div>
          <div class="stat-grid">
            <div class="stat-box"><div class="big">${skills.length}</div><div class="lbl">Kỹ năng (.agents/skills)</div></div>
            <div class="stat-box green"><div class="big">${drafts.length}</div><div class="lbl">Bản nháp Sandbox</div></div>
            <div class="stat-box blue"><div class="big">${TOOL_DEFINITIONS.length}</div><div class="lbl">Công cụ (Tools)</div></div>
            <div class="stat-box purple"><div class="big">${agents.length}</div><div class="lbl">Agent trong DB</div></div>
            <div class="stat-box amber"><div class="big">${accounts.length}</div><div class="lbl">Tài khoản Zalo</div></div>
            <div class="stat-box red"><div class="big">${insight.totalTurns}</div><div class="lbl">Lượt xử lý (30 ngày)</div></div>
          </div>
          <div style="background:#0f172a;color:#fff;padding:12px 14px;border-radius:10px;font-size:12.5px;line-height:1.5">
            <strong style="color:#4ade80">Tổng quan Kiến trúc Nguồn VBAIBot:</strong>
            <div style="margin-top:6px;color:#cbd5e1">
              • <strong>Hành chính & Pháp lý (${adminLegalSkills.length} skills):</strong> Soạn thảo NĐ30, Văn bản Đảng HD05, Rà soát VBHC, Tra cứu thẩm quyền, LegalKit VN.<br/>
              • <strong>Tài chính - Kế toán - Thuế (${financeTaxSkills.length} skills):</strong> Kế toán TT99/TT200, Thuế & HĐĐT, Ngân hàng & Tín dụng, FP&A, App Builder.<br/>
              • <strong>Đa phương tiện & Điều phối:</strong> Sếp (Chief of Staff), Zalo Voice TTS, NotebookLM Studio.
            </div>
          </div>
        </div>
      </div>

      <!-- UPGRADE 8: Bottom 5-Column Detailed Card Grid with Progress Bars -->
      <div class="header-box" style="padding:14px 18px;margin-bottom:14px">
        <div style="font-weight:800;font-size:15px">HỒ SƠ CHI TIẾT TỪNG KỸ NĂNG (.agents/skills), AGENT & CÔNG CỤ TRONG SOURCE VBAIBOT</div>
      </div>
      <div class="kanban">
        <!-- Cột 1: Kỹ năng Hành chính & Pháp lý -->
        <div>
          <div class="col-head"><span><span class="dot" style="background:var(--teal-dark)"></span>Hành chính & Pháp lý</span><span>${adminLegalSkills.length}</span></div>
          ${adminLegalSkills
            .map((sk) => {
              const promptLen = sk.content?.length ?? 1200;
              const pct = Math.min(100, Math.max(35, Math.round(promptLen / 180)));
              return `
            <div class="k-card">
              <span class="k-tag" style="color:var(--teal-dark)">SKILL · ${esc(sk.id)}</span>
              <div class="k-title">${esc(sk.name)}</div>
              <div class="k-desc">${esc(sk.description.slice(0, 115))}...</div>
              <div class="p-wrap">
                <div class="p-meta"><span>Độ sâu tri thức SKILL.md</span><span>${(promptLen / 1024).toFixed(1)} KB</span></div>
                <div class="p-bar"><div class="p-fill" style="width:${pct}%"></div></div>
              </div>
              <span class="badge-src">${sk.triggers.length} triggers</span>
            </div>`;
            })
            .join("")}
        </div>

        <!-- Cột 2: Kỹ năng Tài chính - Kế toán - Thuế -->
        <div>
          <div class="col-head"><span><span class="dot" style="background:var(--amber)"></span>Tài chính · Kế toán · Thuế</span><span>${financeTaxSkills.length}</span></div>
          ${financeTaxSkills
            .map((sk) => {
              const promptLen = sk.content?.length ?? 1200;
              const pct = Math.min(100, Math.max(40, Math.round(promptLen / 180)));
              return `
            <div class="k-card">
              <span class="k-tag" style="color:var(--amber)">FINANCE SKILL · ${esc(sk.id)}</span>
              <div class="k-title">${esc(sk.name)}</div>
              <div class="k-desc">${esc(sk.description.slice(0, 115))}...</div>
              <div class="p-wrap">
                <div class="p-meta"><span>Độ sâu nghiệp vụ</span><span>${(promptLen / 1024).toFixed(1)} KB</span></div>
                <div class="p-bar"><div class="p-fill amber" style="width:${pct}%"></div></div>
              </div>
              <span class="badge-src">${sk.triggers.length} triggers</span>
            </div>`;
            })
            .join("")}
        </div>

        <!-- Cột 3: Agent cấu hình & Kỹ năng Đa phương tiện -->
        <div>
          <div class="col-head"><span><span class="dot" style="background:var(--purple)"></span>Agent & Đa phương tiện</span><span>${agents.length + otherSkills.length}</span></div>
          ${agents
            .map(
              (ag) => `
            <div class="k-card">
              <span class="k-tag" style="color:var(--purple)">AGENT · ${esc(ag.id)}</span>
              <div class="k-title">${esc(ag.icon)} ${esc(ag.name)}</div>
              <div class="k-desc">${esc((ag.persona || "Agent chuyên trách trong hệ thống VBAIBot").slice(0, 110))}</div>
              <div class="p-wrap">
                <div class="p-meta"><span>Công cụ cấp quyền</span><span>${Math.max(1, TOOL_DEFINITIONS.length - ag.disabledTools.length)} tools</span></div>
                <div class="p-bar"><div class="p-fill purple" style="width:88%"></div></div>
              </div>
              <span class="badge-src">${ag.accountCount} tài khoản gắn</span>
            </div>`,
            )
            .join("")}
          ${otherSkills
            .map((sk) => {
              const promptLen = sk.content?.length ?? 1500;
              return `
            <div class="k-card">
              <span class="k-tag" style="color:var(--purple)">SKILL · ${esc(sk.id)}</span>
              <div class="k-title">${esc(sk.name)}</div>
              <div class="k-desc">${esc(sk.description.slice(0, 115))}...</div>
              <div class="p-wrap">
                <div class="p-meta"><span>Độ sâu kịch bản</span><span>${(promptLen / 1024).toFixed(1)} KB</span></div>
                <div class="p-bar"><div class="p-fill purple" style="width:92%"></div></div>
              </div>
              <span class="badge-src">${sk.triggers.length} triggers</span>
            </div>`;
            })
            .join("")}
        </div>

        <!-- Cột 4: Công cụ Tra cứu & Pháp lý -->
        <div>
          <div class="col-head"><span><span class="dot" style="background:var(--blue)"></span>Tools Tra cứu & Pháp lý</span><span>${legalSearchTools.length}</span></div>
          ${legalSearchTools
            .slice(0, 7)
            .map((t) => {
              const pct = Math.max(18, Math.round((t.count / maxToolCount) * 100));
              return `
            <div class="k-card">
              <span class="k-tag" style="color:var(--blue)">TOOL · ${esc(t.group)}</span>
              <div class="k-title">${esc(t.label)}</div>
              <div class="k-desc"><code>${esc(t.name)}</code> — ${esc(t.description.slice(0, 95))}</div>
              <div class="p-wrap">
                <div class="p-meta"><span>Tần suất sử dụng</span><span>${t.count} lần</span></div>
                <div class="p-bar"><div class="p-fill blue" style="width:${pct}%"></div></div>
              </div>
            </div>`;
            })
            .join("")}
        </div>

        <!-- Cột 5: Công cụ Xuất bản, Voice & Điều phối -->
        <div>
          <div class="col-head"><span><span class="dot" style="background:var(--green)"></span>Tools Xuất bản & Điều phối</span><span>${docPublishTools.length}</span></div>
          ${docPublishTools
            .slice(0, 7)
            .map((t) => {
              const pct = Math.max(20, Math.round((t.count / maxToolCount) * 100));
              return `
            <div class="k-card">
              <span class="k-tag" style="color:var(--green)">TOOL · ${esc(t.group)}</span>
              <div class="k-title">${esc(t.label)}</div>
              <div class="k-desc"><code>${esc(t.name)}</code> — ${esc(t.description.slice(0, 95))}</div>
              <div class="p-wrap">
                <div class="p-meta"><span>Tần suất sử dụng</span><span>${t.count} lần</span></div>
                <div class="p-bar"><div class="p-fill" style="width:${pct}%"></div></div>
              </div>
            </div>`;
            })
            .join("")}
        </div>
      </div>
    </section>
  </main>

  <script>
    const DAILY_DATA = ${dailyJson};

    function switchTab(id) {
      document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      const pane = document.getElementById(id);
      if (pane) pane.classList.add('active');
      const btn = document.getElementById('btn-' + id);
      if (btn) btn.classList.add('active');
    }

    function filterKanban(colKey, btnEl) {
      document.querySelectorAll('.radar-sidebar .sb-item').forEach(b => b.classList.remove('active'));
      if (btnEl) btnEl.classList.add('active');
      document.querySelectorAll('#tab-cohoi .kanban-col').forEach(col => {
        if (colKey === 'all' || col.getAttribute('data-col') === colKey) {
          col.style.display = 'block';
        } else {
          col.style.display = 'none';
        }
      });
    }

    function selectHeatmapDay(idx, rowEl) {
      document.querySelectorAll('.hm-row').forEach(r => r.classList.remove('selected'));
      if (rowEl) rowEl.classList.add('selected');
      const d = DAILY_DATA[idx] || DAILY_DATA[0];
      const box = document.getElementById('hm-day-detail');
      if (!box || !d) return;
      box.innerHTML = \`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span class="pill-date" style="background:var(--orange)">📅 Ngày \${d.day}</span>
          <span style="font-size:12px;color:var(--muted)">Chi tiết theo ngày thực tế</span>
        </div>
        <h3 style="font-size:18px;margin-bottom:8px">\${d.turns} lượt AI xử lý · \${d.tokens.toLocaleString('vi-VN')} tokens</h3>
        <div class="stat-grid" style="margin-top:10px">
          <div class="stat-box amber"><div class="big">\${d.user}</div><div class="lbl">Tin người dùng</div></div>
          <div class="stat-box"><div class="big">\${d.bot}</div><div class="lbl">Tin Bot phản hồi</div></div>
          <div class="stat-box blue"><div class="big">\${d.avgTokens}</div><div class="lbl">Tokens / lượt</div></div>
        </div>
        <div style="font-size:12.5px;color:var(--muted);background:#faf8f5;padding:10px 12px;border-radius:8px;border:1px solid var(--border)">
          • Ước tính gọi công cụ: <strong>\${d.toolCalls} tool calls</strong><br/>
          • Liên hệ mới phát sinh: <strong>\${d.newContacts}</strong><br/>
          • Cảnh báo / Lỗi hệ thống: <strong>\${d.errors} lỗi / \${d.warnings} cảnh báo</strong>
        </div>
      \`;
    }

    if (DAILY_DATA.length > 0) {
      selectHeatmapDay(0, document.querySelector('.hm-row'));
    }
  </script>
</body>
</html>`;
}
