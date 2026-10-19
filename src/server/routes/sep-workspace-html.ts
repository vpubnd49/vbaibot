/**
 * Giao diện Mobile Web App (PWA) "Điều Phối Hệ Thống VBAIBot & Xưởng Skill" tại `/sep`
 * Toàn bộ danh sách Agent, Kỹ năng (.agents/skills), Tài khoản và Số liệu lấy trực tiếp từ source/DB của VBAIBot.
 */
export function getSepManifestJson(): string {
  return JSON.stringify(
    {
      name: "VBAIBot Multi-Agent Workspace",
      short_name: "VBAIBot",
      description: "Điều phối Agent, Kỹ năng (.agents/skills), Xưởng Skill Sandbox & Voice Chat",
      start_url: "/sep",
      display: "standalone",
      background_color: "#090a0f",
      theme_color: "#090a0f",
      orientation: "portrait",
      icons: [
        {
          src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='26' fill='%231e293b'/><circle cx='50' cy='52' r='32' fill='%2338bdf8'/><circle cx='39' cy='46' r='4.5' fill='%230f172a'/><circle cx='61' cy='46' r='4.5' fill='%230f172a'/><path d='M42 58 Q50 64 58 58' stroke='%230f172a' stroke-width='4' fill='none' stroke-linecap='round'/></svg>",
          sizes: "192x192",
          type: "image/svg+xml",
        },
      ],
    },
    null,
    2,
  );
}

export function getSepWorkspaceHtml(): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#090a0f" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <link rel="manifest" href="/sep/manifest.json" />
  <title>🟢 Điều Phối Hệ Thống | VBAIBot Multi-Agent Workspace</title>
  <style>
    :root {
      --bg: #090a0f;
      --surface: #12151e;
      --surface-2: #1a1f2e;
      --surface-3: #242b3d;
      --border: rgba(255, 255, 255, 0.09);
      --text: #f3f4f6;
      --muted: #9ca3af;
      --blue: #3b82f6;
      --blue-bubble: #2563eb;
      --green: #22c55e;
      --orange: #f97316;
      --purple: #8b5cf6;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    html, body {
      height: 100%;
      width: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      overflow: hidden;
    }
    .app-shell {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      max-width: 540px;
      margin: 0 auto;
      background: var(--bg);
      position: relative;
      border-left: 1px solid rgba(255,255,255,0.04);
      border-right: 1px solid rgba(255,255,255,0.04);
    }
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: rgba(18, 21, 30, 0.92);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      z-index: 20;
    }
    .icon-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      flex-shrink: 0;
    }
    .icon-btn:active {
      transform: scale(0.95);
    }
    .bot-selector-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      padding: 6px 14px 6px 8px;
      border-radius: 999px;
      cursor: pointer;
      max-width: calc(100% - 104px);
      user-select: none;
    }
    .bean-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      background: linear-gradient(135deg, #38bdf8, #2563eb);
      box-shadow: inset 0 -2px 4px rgba(0,0,0,0.35);
      flex-shrink: 0;
    }
    .bot-selector-title {
      font-size: 14px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bot-selector-caret {
      color: var(--muted);
      font-size: 11px;
    }
    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.68);
      backdrop-filter: blur(4px);
      z-index: 50;
      display: none;
      align-items: flex-end;
      justify-content: center;
    }
    .drawer-backdrop.open {
      display: flex;
    }
    .drawer-sheet {
      width: 100%;
      max-width: 540px;
      max-height: 84dvh;
      background: var(--surface);
      border-top-left-radius: 22px;
      border-top-right-radius: 22px;
      border-top: 1px solid var(--border);
      padding: 16px;
      overflow-y: auto;
    }
    .drawer-handle {
      width: 42px;
      height: 4px;
      background: rgba(255,255,255,0.2);
      border-radius: 999px;
      margin: 0 auto 14px;
    }
    .drawer-section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin: 12px 0 8px;
      font-weight: 700;
    }
    .bot-list-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 12px;
      border-radius: 14px;
      border: 1px solid transparent;
      cursor: pointer;
      margin-bottom: 6px;
      background: var(--surface-2);
    }
    .bot-list-item.active {
      border-color: var(--blue);
      background: rgba(59, 130, 246, 0.14);
    }
    .bot-list-info {
      flex: 1;
      min-width: 0;
    }
    .bot-list-name {
      font-size: 14px;
      font-weight: 700;
    }
    .bot-list-desc {
      font-size: 12px;
      color: var(--muted);
      margin-top: 2px;
      line-height: 1.35;
    }
    .chat-stream {
      flex: 1;
      overflow-y: auto;
      padding: 14px 14px 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      scroll-behavior: smooth;
    }
    .voice-call-divider {
      align-self: center;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 12px;
      color: var(--muted);
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
    }
    .user-bubble {
      align-self: flex-end;
      background: var(--blue-bubble);
      color: #fff;
      padding: 11px 15px;
      border-radius: 20px 20px 5px 20px;
      max-width: 84%;
      font-size: 15px;
      line-height: 1.48;
      word-break: break-word;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
    }
    .assistant-group {
      align-self: flex-start;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 9px;
    }
    .bot-trace-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      align-self: flex-start;
      background: var(--surface-2);
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 13px;
      color: #d1d5db;
      cursor: pointer;
      user-select: none;
    }
    .bot-trace-details {
      display: none;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 12.5px;
      color: var(--muted);
      flex-direction: column;
      gap: 6px;
    }
    .bot-trace-details.open {
      display: flex;
    }
    .assistant-bubble {
      font-size: 15px;
      line-height: 1.62;
      color: var(--text);
      word-break: break-word;
    }
    .assistant-bubble p {
      margin-bottom: 10px;
    }
    .assistant-bubble ul, .assistant-bubble ol {
      margin: 6px 0 12px 20px;
    }
    .assistant-bubble li {
      margin-bottom: 6px;
    }
    .assistant-bubble strong {
      color: #fff;
      font-weight: 700;
    }
    .assistant-bubble code {
      background: rgba(255,255,255,0.09);
      padding: 2px 6px;
      border-radius: 5px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: #93c5fd;
    }
    .assistant-bubble hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 12px 0;
    }
    .assistant-bubble h2, .assistant-bubble h3 {
      font-size: 16px;
      margin: 12px 0 6px;
      color: #fff;
    }
    .file-card-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }
    .file-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      padding: 11px 14px;
      border-radius: 14px;
      text-decoration: none;
      color: var(--text);
    }
    .file-icon-box {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
      flex-shrink: 0;
    }
    .file-icon-xlsx { background: rgba(34, 197, 94, 0.18); color: #4ade80; border: 1px solid rgba(34,197,94,0.35); }
    .file-icon-md { background: rgba(168, 85, 247, 0.18); color: #c084fc; border: 1px solid rgba(168,85,247,0.35); }
    .file-icon-html { background: rgba(59, 130, 246, 0.18); color: #60a5fa; border: 1px solid rgba(59,130,246,0.35); }
    .file-meta {
      flex: 1;
      min-width: 0;
    }
    .file-name {
      font-size: 13.5px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-sub {
      font-size: 11.5px;
      color: var(--muted);
      margin-top: 2px;
    }
    .file-actions {
      display: flex;
      gap: 6px;
    }
    .file-btn {
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      background: var(--surface-3);
      color: var(--text);
      text-decoration: none;
      border: 1px solid var(--border);
    }
    .voice-bar {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #93c5fd;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      align-self: flex-start;
    }
    .decision-card {
      background: var(--surface);
      border: 1px solid rgba(255,255,255,0.13);
      border-radius: 18px;
      padding: 14px;
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .decision-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13.5px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 4px;
    }
    .decision-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
    }
    .decision-option.selected {
      border-color: var(--blue);
      background: rgba(59, 130, 246, 0.18);
    }
    .decision-badge {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      background: var(--surface-3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12.5px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .decision-option.selected .decision-badge {
      background: var(--blue);
      color: #fff;
    }
    .decision-label {
      font-size: 13.5px;
      line-height: 1.35;
      flex: 1;
    }
    .decision-custom {
      width: 100%;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 9px 12px;
      color: var(--text);
      font-size: 13px;
      outline: none;
    }
    .decision-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
    }
    .decision-skip {
      background: none;
      border: none;
      color: var(--muted);
      font-size: 13px;
      cursor: pointer;
      padding: 6px 10px;
    }
    .decision-submit {
      background: #e5e7eb;
      color: #111827;
      border: none;
      border-radius: 999px;
      padding: 8px 20px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
    }
    .composer-wrap {
      padding: 8px 12px calc(10px + env(safe-area-inset-bottom));
      background: var(--surface);
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .quick-prompts {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: none;
    }
    .quick-prompts::-webkit-scrollbar {
      display: none;
    }
    .quick-chip {
      white-space: nowrap;
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: #d1d5db;
      padding: 6px 11px;
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
    }
    .composer-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .composer-box {
      flex: 1;
      display: flex;
      align-items: center;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 4px 6px 4px 14px;
      gap: 6px;
    }
    .composer-input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text);
      font-size: 15px;
      padding: 8px 0;
      outline: none;
      min-width: 0;
    }
    .composer-input::placeholder {
      color: var(--muted);
    }
    .round-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      flex-shrink: 0;
      background: transparent;
      color: var(--text);
    }
    .round-btn.recording {
      background: #ef4444;
      color: #fff;
      animation: pulseRed 1.2s infinite;
    }
    .voice-live-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      font-size: 17px;
    }
    .voice-live-btn.active {
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      border-color: #60a5fa;
      box-shadow: 0 0 16px rgba(59, 130, 246, 0.55);
    }
    @keyframes pulseRed {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
      50% { box-shadow: 0 0 0 9px rgba(239, 68, 68, 0); }
    }
    .typing-dots {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 10px 14px;
      background: var(--surface-2);
      border-radius: 16px;
      font-size: 13px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <!-- Top Bar -->
    <header class="top-bar">
      <button class="icon-btn" id="openDrawerBtn" title="Danh sách Agent & Kỹ năng thực tế trong VBAIBot">☰</button>
      <div class="bot-selector-pill" id="botSelectorPill">
        <div class="bean-avatar" id="activeBotAvatar">🟢</div>
        <span class="bot-selector-title" id="activeBotName">🟢 Điều Phối Hệ Thống (VBAIBot)</span>
        <span class="bot-selector-caret">▼</span>
      </div>
      <a href="/radar" class="icon-btn" title="Mở Bảng Radar Số Liệu Hệ Thống VBAIBot (3 Tab)" style="text-decoration:none">📊</a>
    </header>

    <!-- Chat Stream -->
    <main class="chat-stream" id="chatStream"></main>

    <!-- Bottom Composer -->
    <footer class="composer-wrap">
      <div class="quick-prompts" id="quickPromptsBar">
        <button class="quick-chip" data-prompt="Tra cứu thẩm quyền hành chính và soạn công văn chuẩn Nghị định 30/2020/NĐ-CP">📘 Soạn VB NĐ30 + Tra cứu Hành chính</button>
        <button class="quick-chip" data-prompt="Rà soát thể thức, căn cứ pháp lý và câu chữ văn bản hành chính">📘 Rà soát VB Hành chính</button>
        <button class="quick-chip" data-prompt="Tư vấn định khoản kế toán theo Thông tư 99/2025/TT-BTC và chính sách thuế mới">📘 Kế toán TT99 & Thuế</button>
        <button class="quick-chip" data-prompt="Liệt kê các kỹ năng thực tế đang có trong hệ thống và các bản nháp trong Xưởng Skill">🛠️ Kiểm tra Xưởng Skill</button>
      </div>
      <div class="composer-row">
        <button class="icon-btn" id="installPwaBtn" title="Cài đặt App lên màn hình Samsung" style="display:none">📲</button>
        <div class="composer-box">
          <input
            type="text"
            id="chatInput"
            class="composer-input"
            placeholder="Nhập hoặc nói yêu cầu cho VBAIBot..."
            autocomplete="off"
          />
          <button class="round-btn" id="micBtn" title="Nhấn để nói tiếng Việt (Voice Input)">🎤</button>
          <button class="round-btn" id="sendBtn" title="Gửi">➤</button>
        </div>
        <button class="voice-live-btn" id="voiceModeBtn" title="Bật/tắt chế độ tự động đọc câu trả lời bằng giọng nói">🔊</button>
      </div>
    </footer>

    <!-- Drawer Modal chọn Agent & Kỹ năng thực tế từ VBAIBot -->
    <div class="drawer-backdrop" id="drawerBackdrop">
      <div class="drawer-sheet">
        <div class="drawer-handle"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <strong style="font-size:16px;">Agent & Kỹ năng Hệ thống VBAIBot</strong>
          <button id="closeDrawerBtn" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;">✕</button>
        </div>
        <div class="drawer-section-title">Chọn Agent / Kỹ năng (.agents/skills)</div>
        <div id="botListContainer"></div>
        <div class="drawer-section-title">Skill đang chờ duyệt trong Sandbox (.agents/skill-drafts)</div>
        <div id="draftSkillContainer" style="font-size:13px;color:var(--muted);">Đang tải...</div>
      </div>
    </div>
  </div>

  <script>
    const sessionId = localStorage.getItem("sep_session_id") || ("ss_" + Math.random().toString(36).slice(2, 10));
    localStorage.setItem("sep_session_id", sessionId);

    let bots = [];
    let activeBotId = "sep-chief";
    let autoVoiceMode = localStorage.getItem("sep_auto_voice") === "1";
    let currentAudio = null;
    let initializedGreeting = false;

    const chatStream = document.getElementById("chatStream");
    const chatInput = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendBtn");
    const micBtn = document.getElementById("micBtn");
    const voiceModeBtn = document.getElementById("voiceModeBtn");
    const activeBotNameEl = document.getElementById("activeBotName");
    const activeBotAvatarEl = document.getElementById("activeBotAvatar");
    const drawerBackdrop = document.getElementById("drawerBackdrop");
    const botListContainer = document.getElementById("botListContainer");
    const draftSkillContainer = document.getElementById("draftSkillContainer");

    function updateVoiceModeUi() {
      voiceModeBtn.classList.toggle("active", autoVoiceMode);
    }
    updateVoiceModeUi();

    voiceModeBtn.addEventListener("click", () => {
      autoVoiceMode = !autoVoiceMode;
      localStorage.setItem("sep_auto_voice", autoVoiceMode ? "1" : "0");
      updateVoiceModeUi();
    });

    function renderMarkdown(md) {
      if (!md) return "";
      let html = md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>");
      html = html.replace(/^## (.*$)/gm, "<h2>$1</h2>");
      html = html.replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>");
      html = html.replace(/\`([^\`]+)\`/g, "<code>$1</code>");
      html = html.replace(/^---$/gm, "<hr/>");
      const lines = html.split("\\n");
      const out = [];
      let inList = false;
      for (const line of lines) {
        if (/^\\s*[-*•]\\s+/.test(line)) {
          if (!inList) { out.push("<ul>"); inList = true; }
          out.push("<li>" + line.replace(/^\\s*[-*•]\\s+/, "") + "</li>");
        } else {
          if (inList) { out.push("</ul>"); inList = false; }
          if (line.trim() === "") {
            out.push("");
          } else if (line.startsWith("<h") || line.startsWith("<hr")) {
            out.push(line);
          } else {
            out.push("<p>" + line + "</p>");
          }
        }
      }
      if (inList) out.push("</ul>");
      return out.join("");
    }

    function extractDecisionOptions(text) {
      const regex = /(?:^|\\n)\\s*(?:\\*\\*)?\\[?([A-E])\\]?(?:\\*\\*)?[.):\\s-]+([^\\n]+)/g;
      const found = [];
      const seen = new Set();
      let m;
      while ((m = regex.exec(text)) !== null) {
        const key = m[1];
        const label = m[2].replace(/\\*\\*/g, "").trim();
        if (!seen.has(key) && label.length > 3 && label.length < 180) {
          seen.add(key);
          found.push({ key, label });
        }
      }
      return found.length >= 2 ? found : [];
    }

    function appendVoiceDivider(durationSec) {
      const mins = String(Math.floor(durationSec / 60)).padStart(2, "0");
      const secs = String(durationSec % 60).padStart(2, "0");
      const div = document.createElement("div");
      div.className = "voice-call-divider";
      div.innerHTML = \`<span>🎙️ Voice chat · \${mins}:\${secs}</span>\`;
      chatStream.appendChild(div);
    }

    function appendUserBubble(text, voiceSec) {
      if (typeof voiceSec === "number" && voiceSec > 0) {
        appendVoiceDivider(voiceSec);
      }
      const div = document.createElement("div");
      div.className = "user-bubble";
      div.textContent = text;
      chatStream.appendChild(div);
      chatStream.scrollTop = chatStream.scrollHeight;
    }

    async function playVoiceText(text, existingVoiceUrl) {
      try {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio = null;
        }
        let url = existingVoiceUrl;
        if (!url) {
          const res = await fetch("/api/public/sep/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text.slice(0, 750) }),
          });
          const data = await res.json();
          if (!data.ok || !data.voiceUrl) return;
          url = data.voiceUrl;
        }
        currentAudio = new Audio(url);
        await currentAudio.play();
      } catch (e) {
        console.warn("Không thể phát âm thanh:", e);
      }
    }

    function appendAssistantTurn({ reply, botBadges = [], files = [], voiceUrl }) {
      const group = document.createElement("div");
      group.className = "assistant-group";

      if (botBadges.length > 0) {
        const pill = document.createElement("div");
        pill.className = "bot-trace-pill";
        const icons = botBadges.map((b) => b.icon).join(" ");
        const title =
          botBadges.length === 1
            ? \`Đã gọi \${botBadges[0].botName}\`
            : \`Đã phối hợp \${botBadges.length} Agent / Công cụ\`;
        pill.innerHTML = \`<span>\${icons}</span><span>\${title}</span><span style="font-size:10px;opacity:0.7">▼</span>\`;

        const details = document.createElement("div");
        details.className = "bot-trace-details";
        details.innerHTML = botBadges
          .map((b) => \`<div><strong>\${b.botName}:</strong> \${b.summary}</div>\`)
          .join("");

        pill.addEventListener("click", () => {
          details.classList.toggle("open");
        });
        group.appendChild(pill);
        group.appendChild(details);
      }

      if (files.length > 0) {
        const fileList = document.createElement("div");
        fileList.className = "file-card-list";
        for (const f of files) {
          const ext = (f.ext || "").toLowerCase();
          const iconClass =
            ext === ".xlsx" ? "file-icon-xlsx" : ext === ".html" ? "file-icon-html" : "file-icon-md";
          const iconLabel = ext === ".xlsx" ? "XLS" : ext === ".html" ? "WEB" : "FILE";
          const subLabel =
            ext === ".xlsx"
              ? "Bảng dữ liệu Excel từ VBAIBot"
              : ext === ".html"
                ? "Bảng điều khiển dữ liệu hệ thống VBAIBot (3 Tab)"
                : "Tài liệu / Kỹ năng xuất từ VBAIBot";

          const card = document.createElement("div");
          card.className = "file-card";
          card.innerHTML = \`
            <div class="file-icon-box \${iconClass}">\${iconLabel}</div>
            <div class="file-meta">
              <div class="file-name">\${f.fileName}</div>
              <div class="file-sub">\${subLabel}</div>
            </div>
            <div class="file-actions">
              \${f.viewUrl ? \`<a class="file-btn" href="\${f.viewUrl}" target="_blank">Mở xem</a>\` : ""}
              <a class="file-btn" href="\${f.downloadUrl}" download>Tải về</a>
            </div>
          \`;
          fileList.appendChild(card);
        }
        group.appendChild(fileList);
      }

      const bubble = document.createElement("div");
      bubble.className = "assistant-bubble";
      bubble.innerHTML = renderMarkdown(reply);
      group.appendChild(bubble);

      const voiceBtn = document.createElement("button");
      voiceBtn.className = "voice-bar";
      voiceBtn.innerHTML = "🔊 Nghe giọng đọc phản hồi";
      voiceBtn.addEventListener("click", () => playVoiceText(reply, voiceUrl));
      group.appendChild(voiceBtn);

      const options = extractDecisionOptions(reply);
      if (options.length >= 2) {
        const card = document.createElement("div");
        card.className = "decision-card";
        const selectedKeys = new Set();

        let optionsHtml = \`
          <div class="decision-header">
            <span>Chọn phương án thực hiện</span>
            <span style="font-size:11px;color:var(--muted)">Chọn 1 hoặc nhiều</span>
          </div>
        \`;
        for (const opt of options) {
          optionsHtml += \`
            <div class="decision-option" data-key="\${opt.key}" data-label="\${opt.label.replace(/"/g, "&quot;")}">
              <div class="decision-badge">\${opt.key}</div>
              <div class="decision-label">\${opt.label}</div>
            </div>
          \`;
        }
        optionsHtml += \`
          <input type="text" class="decision-custom" placeholder="✏️ Ý kiến bổ sung khác (nếu có)..." />
          <div class="decision-footer">
            <button class="decision-skip">Bỏ qua</button>
            <button class="decision-submit">Submit</button>
          </div>
        \`;
        card.innerHTML = optionsHtml;

        card.querySelectorAll(".decision-option").forEach((row) => {
          row.addEventListener("click", () => {
            const k = row.getAttribute("data-key");
            if (selectedKeys.has(k)) {
              selectedKeys.delete(k);
              row.classList.remove("selected");
            } else {
              selectedKeys.add(k);
              row.classList.add("selected");
            }
          });
        });

        card.querySelector(".decision-skip").addEventListener("click", () => {
          card.style.display = "none";
        });

        card.querySelector(".decision-submit").addEventListener("click", () => {
          const chosen = [];
          card.querySelectorAll(".decision-option.selected").forEach((r) => {
            chosen.push(\`[\${r.getAttribute("data-key")}] \${r.getAttribute("data-label")}\`);
          });
          const customVal = card.querySelector(".decision-custom").value.trim();
          if (customVal) chosen.push(customVal);
          if (chosen.length === 0) return;
          card.style.opacity = "0.5";
          card.style.pointerEvents = "none";
          sendMessageToBot(chosen.join(" + "));
        });

        group.appendChild(card);
      }

      chatStream.appendChild(group);
      chatStream.scrollTop = chatStream.scrollHeight;

      if (autoVoiceMode || voiceUrl) {
        playVoiceText(reply, voiceUrl);
      }
    }

    async function sendMessageToBot(text, voiceDurationSec) {
      const clean = (text || "").trim();
      if (!clean) return;
      chatInput.value = "";
      appendUserBubble(clean, voiceDurationSec);

      const loadingEl = document.createElement("div");
      loadingEl.className = "typing-dots";
      loadingEl.textContent = "🟢 Đang xử lý trên hệ thống VBAIBot...";
      chatStream.appendChild(loadingEl);
      chatStream.scrollTop = chatStream.scrollHeight;

      try {
        const res = await fetch("/api/public/sep/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: clean,
            botId: activeBotId,
            sessionId,
            autoVoice: autoVoiceMode || Boolean(voiceDurationSec),
            voiceInputDurationSec: voiceDurationSec,
          }),
        });
        const data = await res.json();
        loadingEl.remove();
        if (!data.ok) {
          appendAssistantTurn({
            reply: "⚠️ " + (data.error || "Không thể xử lý yêu cầu lúc này."),
          });
          return;
        }
        appendAssistantTurn(data);
        loadBotsAndSkills();
      } catch (err) {
        loadingEl.remove();
        appendAssistantTurn({
          reply: "⚠️ Lỗi kết nối tới máy chủ VBAIBot. Vui lòng thử lại.",
        });
      }
    }

    sendBtn.addEventListener("click", () => sendMessageToBot(chatInput.value));
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendMessageToBot(chatInput.value);
      }
    });

    document.querySelectorAll(".quick-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        sendMessageToBot(chip.getAttribute("data-prompt"));
      });
    });

    let isRecording = false;
    let recordStartMs = 0;
    let recognition = null;
    let mediaRecorder = null;
    let audioChunks = [];

    micBtn.addEventListener("click", async () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (isRecording) {
        isRecording = false;
        micBtn.classList.remove("recording");
        if (recognition) recognition.stop();
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
        return;
      }

      isRecording = true;
      recordStartMs = Date.now();
      micBtn.classList.add("recording");

      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = "vi-VN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          const dur = Math.max(1, Math.round((Date.now() - recordStartMs) / 1000));
          isRecording = false;
          micBtn.classList.remove("recording");
          if (transcript && transcript.trim()) {
            sendMessageToBot(transcript.trim(), dur);
          }
        };
        recognition.onerror = () => {
          isRecording = false;
          micBtn.classList.remove("recording");
        };
        recognition.onend = () => {
          isRecording = false;
          micBtn.classList.remove("recording");
        };
        recognition.start();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const dur = Math.max(1, Math.round((Date.now() - recordStartMs) / 1000));
          const blob = new Blob(audioChunks, { type: "audio/webm" });
          const fd = new FormData();
          fd.append("audio", blob, "voice.webm");
          try {
            const res = await fetch("/api/public/sep/stt", { method: "POST", body: fd });
            const data = await res.json();
            if (data.ok && data.text) {
              sendMessageToBot(data.text, dur);
            }
          } catch (e) {
            console.warn("STT fallback error:", e);
          }
        };
        mediaRecorder.start();
      } catch (err) {
        isRecording = false;
        micBtn.classList.remove("recording");
        alert("Vui lòng cấp quyền Micro trên trình duyệt để nói chuyện với Bot.");
      }
    });

    function openDrawer() {
      drawerBackdrop.classList.add("open");
    }
    function closeDrawer() {
      drawerBackdrop.classList.remove("open");
    }
    document.getElementById("openDrawerBtn").addEventListener("click", openDrawer);
    document.getElementById("botSelectorPill").addEventListener("click", openDrawer);
    document.getElementById("closeDrawerBtn").addEventListener("click", closeDrawer);
    drawerBackdrop.addEventListener("click", (e) => {
      if (e.target === drawerBackdrop) closeDrawer();
    });

    function selectBot(bot) {
      activeBotId = bot.id;
      activeBotNameEl.textContent = bot.name;
      activeBotAvatarEl.textContent = bot.icon;
      chatInput.placeholder = \`Nhập yêu cầu cho \${bot.shortName}...\`;
      closeDrawer();
      renderBotList();
    }

    function renderBotList() {
      botListContainer.innerHTML = "";
      for (const b of bots) {
        const item = document.createElement("div");
        item.className = "bot-list-item" + (b.id === activeBotId ? " active" : "");
        item.innerHTML = \`
          <div class="bean-avatar">\${b.icon}</div>
          <div class="bot-list-info">
            <div class="bot-list-name">\${b.name}</div>
            <div class="bot-list-desc">\${b.role}</div>
          </div>
        \`;
        item.addEventListener("click", () => selectBot(b));
        botListContainer.appendChild(item);
      }
    }

    async function loadBotsAndSkills() {
      try {
        const res = await fetch("/api/public/sep/bots");
        const data = await res.json();
        if (!data.ok) return;
        bots = data.bots || [];
        renderBotList();

        const drafts = data.drafts || [];
        if (drafts.length === 0) {
          draftSkillContainer.innerHTML = "Chưa có bản nháp nào trong Sandbox (.agents/skill-drafts).";
        } else {
          draftSkillContainer.innerHTML = drafts
            .map(
              (d) => \`
              <div style="padding:10px;background:var(--surface-2);border-radius:12px;margin-bottom:6px;border:1px solid var(--border);">
                <div style="font-weight:700;color:#fff;">🧪 \${d.name} (<code>\${d.id}</code>)</div>
                <div style="font-size:12px;margin-top:2px;">\${d.description}</div>
              </div>
            \`,
            )
            .join("");
        }

        if (!initializedGreeting) {
          initializedGreeting = true;
          const skillsCount = (data.activeSkills || []).length;
          const toolsCount = data.toolsCount || 0;
          const st = data.stats30d || { totalThreads: 0, totalTurns: 0 };
          const skillNames = (data.activeSkills || []).slice(0, 5).map((s) => s.name).join(", ");

          appendAssistantTurn({
            botBadges: [
              {
                botId: "system",
                botName: \`📚 \${skillsCount} Kỹ năng (.agents/skills) & \${toolsCount} Công cụ thực tế\`,
                icon: "📚",
                summary: \`Đã nạp trực tiếp từ mã nguồn VBAIBot: \${skillNames}...\`,
              },
            ],
            files: [
              {
                fileName: "vbaibot-system-radar-dashboard.html",
                downloadUrl: "/radar",
                viewUrl: "/radar",
                ext: ".html",
              },
            ],
            reply:
              \`Hệ thống **VBAIBot Multi-Agent Workspace** đã kết nối trực tiếp với dữ liệu nguồn của máy chủ:\\n\\n\` +
              \`- **Kỹ năng thực tế (\`.agents/skills\`)**: **\${skillsCount}** bộ kỹ năng chuyên sâu (\${skillNames}...).\\n\` +
              \`- **Công cụ hệ thống (\`TOOL_DEFINITIONS\`)**: **\${toolsCount}** công cụ đang hoạt động.\\n\` +
              \`- **Hoạt động 30 ngày qua**: **\${st.totalTurns}** lượt xử lý AI trên **\${st.totalThreads}** phiên trò chuyện.\\n\` +
              \`- Nhấn **🎤** để giao việc bằng giọng nói tiếng Việt hoặc bật **🔊** để tự động nghe phản hồi.\\n\\n\` +
              \`Bạn muốn thực hiện tác vụ nào trên hệ thống VBAIBot?\\n\` +
              \`[A] Tra cứu thẩm quyền hành chính & soạn văn bản chuẩn Nghị định 30/2020/NĐ-CP\\n\` +
              \`[B] Rà soát văn bản hành chính hoặc tra cứu pháp lý (legalkit-vn)\\n\` +
              \`[C] Thiết kế & kiểm thử kỹ năng mới trong Xưởng Skill Sandbox\`,
          });
        }
      } catch (e) {
        console.warn(e);
      }
    }

    loadBotsAndSkills();

    let deferredPrompt = null;
    const installPwaBtn = document.getElementById("installPwaBtn");
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installPwaBtn.style.display = "flex";
    });
    installPwaBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installPwaBtn.style.display = "none";
    });
  </script>
</body>
</html>`;
}
