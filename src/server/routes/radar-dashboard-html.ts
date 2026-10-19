export function getRadarDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#faf8f5">
<title>Radar Cộng Đồng AI — Bảng Cơ Hội & Bản Đồ Nhiệt</title>
<style>
  :root {
    --bg: #faf8f5;
    --card: #ffffff;
    --border: #e8e3dc;
    --text: #1c1e21;
    --muted: #6e6a64;
    --orange-dark: #c95b1c;
    --orange-mid: #e67e45;
    --orange-light: #f6d5c1;
    --orange-pale: #fdf1e8;
    --teal-dark: #158078;
    --teal-mid: #47a89f;
    --teal-light: #bce3df;
    --green: #16a34a;
    --red: #e11d48;
    --blue: #2563eb;
    --purple: #7c3aed;
    --amber: #d97706;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif; }
  body { background: var(--bg); color: var(--text); display: flex; min-height: 100vh; }
  /* Sidebar */
  .sidebar {
    width: 220px; background: #f4f1ec; border-right: 1px solid var(--border);
    padding: 18px 14px; flex-shrink: 0; display: flex; flex-direction: column; gap: 18px;
  }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 15px; }
  .brand-badge { width: 26px; height: 26px; border-radius: 7px; background: #1c1e21; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
  .nav-group-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; margin-bottom: 6px; }
  .nav-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 10px; border-radius: 8px; font-size: 13px; color: var(--text);
    cursor: pointer; text-decoration: none; transition: background 0.15s;
  }
  .nav-item:hover, .nav-item.active { background: #e8e2d9; font-weight: 600; }
  .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 7px; }
  .count { color: var(--muted); font-size: 12px; }
  /* Main */
  .main { flex: 1; padding: 22px 26px; overflow-x: hidden; }
  .top-tabs {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
    gap: 12px; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--border);
  }
  .tab-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
  .tab-btn {
    padding: 8px 15px; border-radius: 999px; border: 1px solid var(--border);
    background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--text);
  }
  .tab-btn.active { background: #1c1e21; color: #fff; border-color: #1c1e21; }
  .sep-link {
    padding: 8px 14px; border-radius: 999px; background: #16a34a; color: #fff;
    text-decoration: none; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;
  }
  .header-box { margin-bottom: 16px; }
  .header-box h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .pill-date { background: var(--orange-mid); color: #fff; font-size: 13px; padding: 3px 10px; border-radius: 999px; font-weight: 700; }
  .meta-grid { display: grid; grid-template-columns: 95px 1fr; row-gap: 4px; font-size: 13px; color: var(--muted); margin-bottom: 12px; }
  .meta-grid strong { color: var(--text); font-weight: 500; }
  .hint-banner {
    background: #f3efe9; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #4b4843; margin-bottom: 18px;
  }
  /* 5 Columns Kanban */
  .kanban { display: grid; grid-template-columns: repeat(5, minmax(230px, 1fr)); gap: 14px; overflow-x: auto; padding-bottom: 10px; }
  .col-head { font-size: 13px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; padding-bottom: 6px; border-bottom: 2px solid var(--border); }
  .k-card {
    background: var(--card); border: 1px solid var(--border); border-radius: 12px;
    padding: 13px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  }
  .k-card.green-tint { background: #eef7f2; border-color: #cde5d8; }
  .k-card.warm-tint { background: #fdfaf5; border-color: #f0dfc8; }
  .k-tag { font-size: 11px; font-weight: 700; color: var(--red); margin-bottom: 4px; display: block; }
  .k-title { font-size: 14px; font-weight: 700; margin-bottom: 6px; line-height: 1.35; }
  .k-desc { font-size: 12.5px; color: #4a4742; line-height: 1.45; margin-bottom: 8px; }
  .k-list { padding-left: 15px; font-size: 12px; color: #3d3a36; line-height: 1.45; margin-bottom: 8px; }
  .k-list li { margin-bottom: 4px; }
  .badge-src {
    display: inline-block; padding: 2px 7px; border-radius: 5px; font-size: 11px;
    background: #eef2f6; color: #3b5998; font-weight: 600; margin-right: 4px;
  }
  .big-metric { font-size: 20px; font-weight: 800; color: #4f46e5; margin-bottom: 2px; }
  /* Heatmap */
  .heatmap-wrap { display: grid; grid-template-columns: 1.7fr 1fr; gap: 18px; }
  .heatmap-card { background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 16px; overflow-x: auto; }
  .hm-table { width: 100%; border-collapse: separate; border-spacing: 5px; font-size: 12px; }
  .hm-table th { font-weight: 600; color: var(--muted); font-size: 11px; text-align: center; padding: 4px; max-width: 85px; }
  .hm-table td.topic-name { font-weight: 700; font-size: 12.5px; color: var(--text); width: 170px; padding-right: 8px; }
  .hm-cell {
    border-radius: 8px; text-align: center; padding: 8px 4px; cursor: pointer;
    transition: transform 0.1s, box-shadow 0.1s; min-width: 58px;
  }
  .hm-cell:hover, .hm-cell.selected { transform: scale(1.05); box-shadow: 0 0 0 2px #1c1e21; }
  .hm-cell .num { font-size: 14px; font-weight: 800; display: block; }
  .hm-cell .sub { font-size: 10.5px; opacity: 0.85; }
  .hm-0 { background: #f3f1ed; color: transparent; cursor: default; }
  .hm-1 { background: #fbe6d8; color: #7c3a16; }
  .hm-2 { background: #f3b58c; color: #5c2509; }
  .hm-3 { background: #e37439; color: #fff; }
  .hm-4 { background: #c95215; color: #fff; }
  .hm-t1 { background: #dcf2ef; color: #135c56; }
  .hm-t2 { background: #8ed1c9; color: #0d423e; }
  .hm-t3 { background: #19857b; color: #fff; }
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; font-size: 12.5px; }
  .bar-label { width: 210px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar-track { flex: 1; background: #f2ece4; height: 10px; border-radius: 99px; overflow: hidden; }
  .bar-fill { background: #d9601e; height: 100%; border-radius: 99px; }
  .bar-val { width: 40px; text-align: right; font-weight: 700; }
  /* Competitor Strategy Room */
  .comp-top { display: grid; grid-template-columns: 1.35fr 1fr; gap: 16px; margin-bottom: 18px; }
  .dark-header { background: #0f172a; color: #fff; padding: 14px 18px; border-radius: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
  .matrix-grid { display: grid; grid-template-columns: 110px repeat(3, 1fr); gap: 8px; align-items: stretch; font-size: 12px; }
  .matrix-cell { background: #f1f5f9; border-radius: 10px; padding: 10px; min-height: 82px; display: flex; flex-wrap: wrap; gap: 5px; align-content: flex-start; }
  .matrix-cell.gap-opportunity {
    background: repeating-linear-gradient(135deg, #e6f9ef, #e6f9ef 10px, #d1f4e0 10px, #d1f4e0 20px);
    border: 2px dashed #16a34a;
  }
  .pill-comp { background: #1e3a5f; color: #fff; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
  .pill-comp.light { background: #fff; color: #334155; border: 1px solid #cbd5e1; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
  .stat-box { background: #f8fafc; border-left: 3px solid #0ea5e9; border-radius: 8px; padding: 10px 12px; }
  .stat-box .big { font-size: 22px; font-weight: 800; color: #0f172a; }
  .stat-box .lbl { font-size: 11.5px; color: #64748b; }
  .tab-pane { display: none; }
  .tab-pane.active { display: block; }
  @media (max-width: 900px) {
    body { flex-direction: column; }
    .sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--border); }
    .heatmap-wrap, .comp-top { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <aside class="sidebar">
    <div class="brand"><span class="brand-badge">R</span> Radar Cộng Đồng AI</div>
    <div>
      <div class="nav-item active" onclick="switchTab('tab-cohoi')">Bảng cơ hội 19/10</div>
      <div class="nav-item" onclick="switchTab('tab-heatmap')">Bản đồ nhiệt chủ đề</div>
      <div class="nav-item" onclick="switchTab('tab-doithu')">Phòng chiến lược đối thủ</div>
    </div>
    <div>
      <div class="nav-group-title">Nhóm Facebook</div>
      <div class="nav-item"><span><i class="dot" style="background:#ef4444"></i>Cơm AI lo</span><span class="count">205K</span></div>
      <div class="nav-item"><span><i class="dot" style="background:#f97316"></i>CĐ Claude AI VN</span><span class="count">413K</span></div>
      <div class="nav-item"><span><i class="dot" style="background:#eab308"></i>Claude VN</span><span class="count">728K</span></div>
      <div class="nav-item"><span><i class="dot" style="background:#f59e0b"></i>Codex VN</span><span class="count">303K</span></div>
      <div class="nav-item"><span><i class="dot" style="background:#84cc16"></i>Antigravity VN</span><span class="count">222K</span></div>
      <div class="nav-item"><span><i class="dot" style="background:#10b981"></i>Nghiện AI</span><span class="count">380K</span></div>
      <div class="nav-item"><span><i class="dot" style="background:#06b6d4"></i>Bình Dân Học AI</span><span class="count">664K</span></div>
    </div>
    <div>
      <div class="nav-group-title">Đối thủ & Quốc tế</div>
      <div class="nav-item"><span>Fanpage đối thủ</span><span class="count">4</span></div>
      <div class="nav-item"><span>Quảng cáo Ad Library</span><span class="count">13</span></div>
      <div class="nav-item"><span>Tín hiệu mua</span><span class="count">10</span></div>
      <div class="nav-item"><span>X / Hacker News / GitHub</span><span class="count">23</span></div>
    </div>
  </aside>

  <main class="main">
    <div class="top-tabs">
      <div class="tab-buttons">
        <button class="tab-btn active" id="btn-tab-cohoi" onclick="switchTab('tab-cohoi')">🎯 Bảng cơ hội</button>
        <button class="tab-btn" id="btn-tab-heatmap" onclick="switchTab('tab-heatmap')">🔥 Bản đồ nhiệt chủ đề</button>
        <button class="tab-btn" id="btn-tab-doithu" onclick="switchTab('tab-doithu')">♟️ Phòng chiến lược đối thủ</button>
      </div>
      <a class="sep-link" href="/sep">🟢 Mở Sếp – Chief of Staff (Voice App)</a>
    </div>

    <!-- TAB 1: BẢNG CƠ HỘI -->
    <section id="tab-cohoi" class="tab-pane active">
      <div class="header-box">
        <h1>Bảng cơ hội, 19/10/2026 · Sáng</h1>
        <div class="meta-grid">
          <span>Phiên quét</span><strong>Phiên sáng, cập nhật tự động bởi 🟠 Radar Cộng Đồng FB (UTC+7)</strong>
          <span>Nguồn</span><strong>7 nhóm FB (2,9 triệu thành viên), 4 fanpage, 11 quảng cáo, 21 tin X, HN, YouTube</strong>
          <span>Bài top</span><strong>14 bài, 757 bình luận, 5 bài có tín hiệu mua rõ rệt</strong>
        </div>
        <div class="hint-banner">
          💡 Đọc từ trái sang phải: nỗi đau và tín hiệu mua ngoài cộng đồng, đối thủ đang làm gì, xu hướng sắp về, rồi ý tưởng giao trực tiếp cho đội ngũ Bot (Jakie, Linh, Xưởng Skill, Ebook).
        </div>
      </div>

      <div class="kanban">
        <!-- Cột 1 -->
        <div>
          <div class="col-head"><span class="dot" style="background:var(--red)"></span>Nỗi đau <span class="count">8</span></div>
          <div class="k-card">
            <span class="k-tag">#1 Chọn công cụ & điều phối AI</span>
            <div class="k-title">Người dùng rối giữa Claude, ChatGPT, Codex, Gemini và muốn 1 "Sếp AI" tự chia việc</div>
            <ul class="k-list">
              <li>Dùng Claude phân tích, nghiên cứu cổ phiếu <strong>69 bl</strong></li>
              <li>Dân văn phòng làm Word/Excel dùng AI nào chuẩn NĐ30? <strong>53 bl</strong></li>
              <li>Muốn chỉ nói qua micro điện thoại để các bot tự nối tiếp nhau làm <strong>98 bl</strong></li>
            </ul>
            <span class="badge-src">Nhóm FB</span>
          </div>
          <div class="k-card">
            <span class="k-tag">#2 Gói, hạn mức, token</span>
            <div class="k-title">Tốc độ gói, giờ reset, hết lượt Claude/Codex giữa chừng, sợ mất tiền oan khi mua tài khoản rẻ</div>
            <ul class="k-list">
              <li>Dùng 1 tài khoản đăng nhập 2 máy bị khóa <strong>48 bl</strong></li>
              <li>Hết lượt dùng giữa chừng, rối lịch reset 5 tiếng <strong>82 bl</strong></li>
            </ul>
            <span class="badge-src">Claude VN</span><span class="badge-src">Codex VN</span>
          </div>
          <div class="k-card">
            <span class="k-tag">#3 Nghi ngờ app vibe code</span>
            <div class="k-title">"Vibecode 2-3 bữa ngỏm lên ngỏm xuống", cần tự kiểm tra & tự sửa lỗi (LOOP)</div>
            <span class="badge-src">Cơm AI lo</span>
          </div>
        </div>

        <!-- Cột 2 -->
        <div>
          <div class="col-head"><span class="dot" style="background:var(--teal-dark)"></span>Tín hiệu mua <span class="count">10</span></div>
          <div class="k-card">
            <div class="k-title">“Cho mình xin ad + hàng loạt "Loop" tự kiểm tra lỗi”</div>
            <div class="k-desc">Cơm AI lo, bài tài liệu giúp AI tự làm, tự kiểm tra, tự sửa lỗi (144 bình luận).</div>
            <span class="badge-src">Tín hiệu mua cao</span>
          </div>
          <div class="k-card">
            <div class="k-title">“Tự làm webapp/bot nội bộ cho cơ quan/công ty, làm sao để sếp duyệt chi phí?”</div>
            <div class="k-desc">Cộng đồng Claude AI Việt Nam — 98 bình luận, 81 cảm xúc.</div>
            <span class="badge-src">Nhóm FB</span>
          </div>
          <div class="k-card">
            <div class="k-title">“Hàng loạt comment xin Workflow tự động hóa Zalo Agent & NotebookLM”</div>
            <div class="k-desc">Người học tìm quy trình chuẩn hóa từ giọng nói ra văn bản, slide, infographic.</div>
            <span class="badge-src">Antigravity VN</span>
          </div>
        </div>

        <!-- Cột 3 -->
        <div>
          <div class="col-head"><span class="dot" style="background:var(--blue)"></span>Đối thủ làm gì <span class="count">5</span></div>
          <div class="k-card">
            <div class="k-title">Zoom free + quà tặng phễu</div>
            <div class="k-desc">2/11 quảng cáo: Nguyễn Tất Kiểm, AI Coaching (18 ngày), AI Automation Unica (136 ngày).</div>
            <span class="badge-src">Ad Library</span>
          </div>
          <div class="k-card">
            <div class="k-title">Khóa học theo nghề</div>
            <div class="k-desc">5/11: Hảo Tin Học Văn Phòng (Excel), TACA (Kế toán, tài chính - 284 ngày), TESOL (Giáo viên).</div>
            <span class="badge-src">Ad Library</span>
          </div>
          <div class="k-card green-tint">
            <div class="k-title">Quảng cáo sách thực chiến</div>
            <div class="k-desc">Chỉ 1/11 quảng cáo bán sách (Nguyễn Phương - 112 ngày). Khoảng trống rất lớn cho Ebook chọn AI theo nghề!</div>
            <span class="badge-src">Cơ hội cao</span>
          </div>
        </div>

        <!-- Cột 4 -->
        <div>
          <div class="col-head"><span class="dot" style="background:var(--purple)"></span>Xu hướng nước ngoài <span class="count">4</span></div>
          <div class="k-card">
            <div class="big-metric">916 like</div>
            <div class="k-title">Agent chạy ngay trên điện thoại/laptop, giao việc bằng giọng nói không cần gõ lệnh</div>
            <div class="k-desc">Gỡ rào cản dòng lệnh CLI. Chưa ai ở VN làm bài hướng dẫn chi tiết góc Multi-Agent Voice.</div>
            <span class="badge-src">@NousResearch</span><span class="badge-src">YouTube</span>
          </div>
          <div class="k-card">
            <div class="big-metric">14.556 like</div>
            <div class="k-title">Đấu nối Multi-Model (Claude + GPT Codex + Gemini) qua Router để không bao giờ đứt mạch</div>
            <div class="k-desc">Giải quyết triệt để nỗi đau hết hạn mức giữa chừng.</div>
            <span class="badge-src">@antigravity</span><span class="badge-src">HN</span>
          </div>
          <div class="k-card">
            <div class="big-metric">2.750 like</div>
            <div class="k-title">Chat để AI tự dựng Slide HTML & tự viết Skill vào thư viện chung</div>
            <span class="badge-src">@bcherny</span>
          </div>
        </div>

        <!-- Cột 5 -->
        <div>
          <div class="col-head"><span class="dot" style="background:var(--amber)"></span>Ý tưởng nội dung & Skill <span class="count">4</span></div>
          <div class="k-card warm-tint">
            <span class="k-tag" style="color:var(--amber)">EBOOK AI THỰC CHIẾN</span>
            <div class="k-title">Ebook “Chọn AI theo nghề + mẹo điều phối nhiều AI tiết kiệm token”</div>
            <ul class="k-list">
              <li>Giải quyết Nỗi đau #1 và #2 trong bình luận</li>
              <li>Đánh trúng khoảng trống 1/11 quảng cáo sách</li>
            </ul>
            <a href="/sep?prompt=Duyệt làm Ebook Chọn AI theo nghề và mẹo tiết kiệm token" class="badge-src" style="background:#fef3c7;color:#92400e;text-decoration:none">Giao việc cho Sếp ↗</a>
          </div>
          <div class="k-card warm-tint">
            <span class="k-tag" style="color:var(--green)">XƯỞNG SKILL (3 SKILL MỚI)</span>
            <div class="k-title">Bộ 3 Skill: ai-task-splitter, shop-inbox-assistant (mức 1), meeting-minutes-writer</div>
            <ul class="k-list">
              <li>Tự chia nhỏ việc cho nhiều AI đỡ tốn lượt</li>
              <li>Bóc băng ghi âm cuộc họp ra biên bản chuẩn</li>
            </ul>
            <a href="/sep?prompt=Bảo Xưởng Skill chạy thử 3 skill: ai-task-splitter, shop-inbox-assistant, meeting-minutes-writer" class="badge-src" style="background:#dcfce7;color:#166534;text-decoration:none">Chạy thử ở Xưởng Skill ↗</a>
          </div>
          <div class="k-card warm-tint">
            <span class="k-tag" style="color:var(--purple)">LINH & SOẠN BÀI ĐÀO TẠO</span>
            <div class="k-title">5 góc content từ Radar + Slide HTML điều phối Skill</div>
            <a href="/sep?prompt=Bảo Linh viết 5 góc content từ Radar và Soạn Bài Đào Tạo xuất slide HTML" class="badge-src" style="background:#f3e8ff;color:#6b21a8;text-decoration:none">Giao Linh & Đào Tạo ↗</a>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 2: BẢN ĐỒ NHIỆT CHỦ ĐỀ -->
    <section id="tab-heatmap" class="tab-pane">
      <div class="header-box">
        <h1>Bản đồ nhiệt chủ đề <span class="pill-date">19/10/2026</span> <span style="font-size:15px;color:var(--muted)">Sáng</span></h1>
        <p style="font-size:13px;color:var(--muted)">Bấm vào một ô hoặc tên chủ đề để xem chi tiết bài viết, nỗi đau và trích dẫn thực tế bên phải.</p>
      </div>

      <div class="heatmap-wrap">
        <div class="heatmap-card">
          <table class="hm-table">
            <thead>
              <tr>
                <th style="text-align:left">Chủ đề</th>
                <th>Cơm AI lo</th>
                <th>CĐ Claude AI VN</th>
                <th>Claude VN</th>
                <th>Codex VN</th>
                <th>Antigravity VN</th>
                <th>Nghiện AI</th>
                <th>Bình Dân Học AI</th>
                <th>Fanpage đối thủ</th>
                <th>Quảng cáo</th>
                <th>Nước ngoài</th>
              </tr>
            </thead>
            <tbody>
              <tr onclick="selectTopic('Tự làm app, agent, automation', 'Nỗi đau #4: Nghi ngờ app vibe code — vibecode 2-3 bữa ngỏm lên ngỏm xuống, cần cơ chế tự kiểm tra & Multi-Agent điều phối ổn định.')">
                <td class="topic-name">Tự làm app, agent, automation<br><span class="count">296 bl</span></td>
                <td class="hm-cell hm-4 selected"><span class="num">198</span><span class="sub">2 bài</span></td>
                <td class="hm-cell hm-3"><span class="num">98</span><span class="sub">1 bài</span></td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-1"><span class="num">1</span><span class="sub">bài</span></td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-t1"><span class="num">3</span><span class="sub">mục</span></td>
                <td class="hm-cell hm-t2"><span class="num">6</span><span class="sub">mục</span></td>
              </tr>
              <tr onclick="selectTopic('Gói, hạn mức, token', 'Nỗi đau #2: Người dùng hay hết lượt dùng Claude, Codex giữa chừng và rối về lịch reset. Họ muốn một AI lên kế hoạch rồi giao việc cho nhiều AI khác làm để đỡ tốn lượt.')">
                <td class="topic-name">Gói, hạn mức, token<br><span class="count">272 bl</span></td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-1"><span class="num">22</span><span class="sub">1 bài</span></td>
                <td class="hm-cell hm-3"><span class="num">93</span><span class="sub">3 bài</span></td>
                <td class="hm-cell hm-3"><span class="num">82</span><span class="sub">3 bài</span></td>
                <td class="hm-cell hm-2"><span class="num">66</span><span class="sub">2 bài</span></td>
                <td class="hm-cell hm-1"><span class="num">9</span><span class="sub">1 bài</span></td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-t1"><span class="num">4</span><span class="sub">mục</span></td>
              </tr>
              <tr onclick="selectTopic('Lead magnet, tài liệu, prompt free', 'Nỗi đau #3: Hàng trăm bình luận xin từ khóa LOOP / Workflow tự động hóa kiểm lỗi.')">
                <td class="topic-name">Lead magnet, tài liệu, prompt<br><span class="count">219 bl</span></td>
                <td class="hm-cell hm-4"><span class="num">219</span><span class="sub">2 bài</span></td>
                <td class="hm-cell hm-1"><span class="num">1</span><span class="sub">bài</span></td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-t2"><span class="num">6</span><span class="sub">mục</span></td>
                <td class="hm-cell hm-t1"><span class="num">3</span><span class="sub">mục</span></td>
                <td class="hm-cell hm-0">-</td>
              </tr>
              <tr onclick="selectTopic('Chọn công cụ theo nghề', 'Nỗi đau #1: Không biết bắt đầu từ đâu, chọn ChatGPT, Claude hay Gemini cho công việc hành chính, kế toán, giáo viên.')">
                <td class="topic-name">Chọn công cụ theo nghề<br><span class="count">196 bl</span></td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-2"><span class="num">58</span><span class="sub">2 bài</span></td>
                <td class="hm-cell hm-3"><span class="num">122</span><span class="sub">2 bài</span></td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-1"><span class="num">16</span><span class="sub">1 bài</span></td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-t1"><span class="num">1</span><span class="sub">mục</span></td>
                <td class="hm-cell hm-t2"><span class="num">4</span><span class="sub">mục</span></td>
                <td class="hm-cell hm-0">-</td>
              </tr>
              <tr onclick="selectTopic('Tài khoản, tiền, bán lại', 'Sợ mất tiền oan khi mua tài khoản giá rẻ dùng chung, bị khóa workspace giữa chừng.')">
                <td class="topic-name">Tài khoản, tiền, bán lại<br><span class="count">153 bl</span></td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-2"><span class="num">34</span><span class="sub">2 bài</span></td>
                <td class="hm-cell hm-3"><span class="num">93</span><span class="sub">3 bài</span></td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-2"><span class="num">26</span><span class="sub">1 bài</span></td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
                <td class="hm-cell hm-0">-</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border)">
            <div style="font-weight:700;font-size:13px;margin-bottom:10px">Xếp hạng chủ đề theo tổng bình luận ở 7 nhóm</div>
            <div class="bar-row"><span class="bar-label">Tự làm app, agent, automation</span><div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-val">296</span></div>
            <div class="bar-row"><span class="bar-label">Gói, hạn mức, token</span><div class="bar-track"><div class="bar-fill" style="width:92%"></div></div><span class="bar-val">272</span></div>
            <div class="bar-row"><span class="bar-label">Lead magnet, tài liệu, prompt free</span><div class="bar-track"><div class="bar-fill" style="width:74%"></div></div><span class="bar-val">219</span></div>
            <div class="bar-row"><span class="bar-label">Chọn công cụ theo nghề</span><div class="bar-track"><div class="bar-fill" style="width:66%"></div></div><span class="bar-val">196</span></div>
            <div class="bar-row"><span class="bar-label">Tài khoản, tiền, bán lại</span><div class="bar-track"><div class="bar-fill" style="width:52%"></div></div><span class="bar-val">153</span></div>
          </div>
        </div>

        <div class="heatmap-card" id="topic-detail-panel">
          <h3 id="detail-title" style="font-size:18px;margin-bottom:4px">Tự làm app, agent, automation</h3>
          <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Tất cả nguồn · 14 mục</div>
          <div style="background:#fff1f2;border-left:3px solid var(--red);padding:10px 12px;border-radius:8px;margin-bottom:14px;font-size:12.5px" id="detail-pain">
            <strong>Nỗi đau trọng tâm:</strong> “vibecode 2 3 bữa ngỏm lên ngỏm xuống”; sợ app sập sau nửa năm, cần hệ thống Multi-Agent & Skill chuẩn hóa.
          </div>
          <div class="k-card">
            <div class="k-title">Tài liệu giúp AI tự làm, tự kiểm tra, tự sửa lỗi (comment LOOP để nhận)</div>
            <div class="k-desc">Bình luận gần như 1 chữ “Loop”, “Cho mình xin ad”.</div>
            <span class="badge-src" style="background:#dcfce7;color:#166534">Bài nhóm, có tín hiệu mua</span>
            <span class="count">Cơm AI lo · 144 bl · 73 cx</span>
          </div>
          <div class="k-card">
            <div class="k-title">Tự làm webapp bằng Claude Pro, có nên đòi công ty trả tiền?</div>
            <div class="k-desc">Dân xuất nhập khẩu, công ty 2.000 người, tự bỏ 22$/tháng mua Claude Pro làm webapp nội bộ.</div>
            <span class="badge-src">Cộng đồng Claude AI VN</span>
            <span class="count">98 bl · 81 cx</span>
          </div>
          <div class="k-card">
            <div class="k-title">Điều phối đội ngũ Nhân sự số chỉ bằng giọng nói trên điện thoại</div>
            <div class="k-desc">Người thì cào thông tin, người soạn nội dung, người tạo skill, người làm ebook — có 1 "Sếp" đứng ra làm việc trực tiếp.</div>
            <a href="/sep" class="sep-link" style="margin-top:6px">🎙️ Giao việc ngay cho Sếp</a>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 3: PHÒNG CHIẾN LƯỢC ĐỐI THỦ -->
    <section id="tab-doithu" class="tab-pane">
      <div class="dark-header">
        <div>
          <strong style="font-size:16px;letter-spacing:0.03em">PHÒNG CHIẾN LƯỢC ĐỐI THỦ</strong>
          <span style="font-size:12px;color:#94a3b8;margin-left:10px">19/10/2026 · Phiên Sáng · Meta Ad Library + Fanpage</span>
        </div>
      </div>

      <div class="comp-top">
        <div class="heatmap-card">
          <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px">BẢN ĐỒ ĐỊNH VỊ (số = ngày quảng cáo đang chạy)</div>
          <div class="matrix-grid">
            <div style="font-weight:600;align-self:center">Doanh nghiệp, chuyên sâu</div>
            <div class="matrix-cell"><span class="pill-comp">AI Automation 136n</span><span class="pill-comp light">Base.vn</span></div>
            <div class="matrix-cell"><span class="pill-comp">Học Viện MCI 67n</span><span class="pill-comp light">AI Workforce</span></div>
            <div class="matrix-cell"></div>

            <div style="font-weight:600;align-self:center">Theo nghề</div>
            <div class="matrix-cell"></div>
            <div class="matrix-cell">
              <span class="pill-comp">Hảo Tin Học VP 11n</span>
              <span class="pill-comp">TACA 284n</span>
              <span class="pill-comp">TESOL 269n</span>
              <span class="pill-comp">MCNA Tech 104n</span>
            </div>
            <div class="matrix-cell gap-opportunity">
              <div style="font-weight:800;color:#15803d;font-size:13px">🎯 Khoảng trống chiến lược</div>
              <div style="font-size:12px;color:#166534">Ebook & Bộ Skill “Chọn AI theo nghề + điều phối tiết kiệm token”</div>
            </div>

            <div style="font-weight:600;align-self:center">Người mới, đại trà</div>
            <div class="matrix-cell"><span class="pill-comp">Nguyễn Tất Kiểm 18n</span><span class="pill-comp light">Ứng Dụng AI Mỗi Ngày</span></div>
            <div class="matrix-cell"><span class="pill-comp">Nguyễn Phương 112n</span><span class="pill-comp">USB AI 66n</span></div>
            <div class="matrix-cell"><span class="pill-comp">Đạt Bá 166n</span></div>

            <div></div>
            <div style="text-align:center;font-weight:600;color:var(--muted)">Miễn phí (Zoom, lead free)</div>
            <div style="text-align:center;font-weight:600;color:var(--muted)">Giá ẩn (Inbox, form, web)</div>
            <div style="text-align:center;font-weight:600;color:var(--muted)">Giá công khai</div>
          </div>
        </div>

        <div class="heatmap-card">
          <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px">TỔNG QUAN THỊ TRƯỜNG</div>
          <div class="stat-grid">
            <div class="stat-box"><div class="big">11</div><div class="lbl">quảng cáo theo dõi</div></div>
            <div class="stat-box"><div class="big">284</div><div class="lbl">ngày dài nhất (TACA)</div></div>
            <div class="stat-box"><div class="big">16</div><div class="lbl">phiên bản (Đạt Bá)</div></div>
            <div class="stat-box"><div class="big">2/11</div><div class="lbl">kéo Zoom free</div></div>
            <div class="stat-box"><div class="big">5/11</div><div class="lbl">nhắm theo nghề</div></div>
            <div class="stat-box"><div class="big">1/11</div><div class="lbl">bán sách / ebook</div></div>
          </div>
          <div style="background:#0f172a;color:#fff;padding:12px 14px;border-radius:10px;font-size:12.5px;line-height:1.5">
            <strong style="color:#4ade80">Khoảng trống chiến lược: Ebook & Bộ Skill “Chọn AI theo nghề + mẹo tiết kiệm token”</strong>
            <ul style="padding-left:16px;margin-top:6px;color:#cbd5e1">
              <li>Giải quyết trực tiếp Nỗi đau #1 và #2 trong bình luận</li>
              <li>Chỉ 1/11 quảng cáo bán sách (Nguyễn Phương)</li>
              <li>Ô “Giá công khai × Theo nghề” trên bản đồ đang hoàn toàn trống</li>
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
    function selectTopic(title, pain) {
      document.getElementById('detail-title').textContent = title;
      document.getElementById('detail-pain').innerHTML = '<strong>Nỗi đau trọng tâm:</strong> ' + pain;
    }
  </script>
</body>
</html>`;
}
