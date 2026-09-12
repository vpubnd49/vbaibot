/**
 * ocr-portal-html.ts
 * Trả về HTML của OCR Upload Portal — trang drag-drop thư mục đa định dạng.
 * Được serve bởi Hono route GET /ocr (yêu cầu đã đăng nhập dashboard).
 */
export function getOcrPortalHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OCR Upload Portal — Châu Phiên Bản Số</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0c14;
      --surface: rgba(255,255,255,0.04);
      --surface-hover: rgba(255,255,255,0.07);
      --border: rgba(255,255,255,0.08);
      --border-active: rgba(99,179,237,0.6);
      --text: #e2e8f0;
      --text-muted: #718096;
      --accent: #63b3ed;
      --accent-glow: rgba(99,179,237,0.2);
      --success: #68d391;
      --warning: #f6ad55;
      --error: #fc8181;
      --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      background-image:
        radial-gradient(ellipse at 20% 20%, rgba(99,179,237,0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(154,117,234,0.06) 0%, transparent 50%);
    }
    .header {
      padding: 20px 32px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
      backdrop-filter: blur(8px);
      background: rgba(10,12,20,0.8);
      position: sticky; top: 0; z-index: 10;
    }
    .header .logo { font-size: 22px; }
    .header h1 { font-size: 16px; font-weight: 600; color: var(--text); }
    .header span { font-size: 12px; color: var(--text-muted); }
    .header-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
    .btn-home {
      font-size: 13px; color: var(--text-muted);
      text-decoration: none; padding: 6px 12px;
      border: 1px solid var(--border); border-radius: 6px;
      transition: all 0.2s;
    }
    .btn-home:hover { color: var(--text); border-color: rgba(255,255,255,0.2); }

    .main { max-width: 960px; margin: 0 auto; padding: 32px 24px; }

    /* ── Drop Zone ── */
    .drop-zone {
      border: 2px dashed var(--border);
      border-radius: var(--radius);
      padding: 48px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.25s;
      background: var(--surface);
      position: relative;
      overflow: hidden;
    }
    .drop-zone::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, var(--accent-glow), transparent 70%);
      opacity: 0; transition: opacity 0.3s;
    }
    .drop-zone.drag-over {
      border-color: var(--border-active);
      background: rgba(99,179,237,0.06);
    }
    .drop-zone.drag-over::before { opacity: 1; }
    .drop-icon { font-size: 48px; margin-bottom: 12px; display: block; }
    .drop-zone h2 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .drop-zone p { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; }
    .btn-group { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    .btn {
      padding: 9px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;
      cursor: pointer; transition: all 0.2s; border: none; font-family: inherit;
    }
    .btn-primary {
      background: var(--accent); color: #0a0c14;
    }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-secondary {
      background: var(--surface-hover); color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover { border-color: rgba(255,255,255,0.2); }
    .btn-danger {
      background: rgba(252,129,129,0.15); color: var(--error);
      border: 1px solid rgba(252,129,129,0.25);
    }
    .btn-danger:hover { background: rgba(252,129,129,0.25); }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
    .btn-lg { padding: 12px 28px; font-size: 15px; }

    /* ── File list ── */
    .section { margin-top: 24px; }
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
    }
    .section-title { font-size: 14px; font-weight: 600; color: var(--text); }
    .section-meta { font-size: 13px; color: var(--text-muted); }
    .file-list {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); overflow: hidden;
      max-height: 320px; overflow-y: auto;
    }
    .file-list::-webkit-scrollbar { width: 4px; }
    .file-list::-webkit-scrollbar-track { background: transparent; }
    .file-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
    .file-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-bottom: 1px solid var(--border);
      font-size: 13px; transition: background 0.15s;
    }
    .file-item:last-child { border-bottom: none; }
    .file-item:hover { background: var(--surface-hover); }
    .file-icon { font-size: 18px; width: 24px; text-align: center; flex-shrink: 0; }
    .file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-size { color: var(--text-muted); font-size: 12px; flex-shrink: 0; }
    .file-status { width: 20px; flex-shrink: 0; text-align: center; font-size: 14px; }

    /* ── Config panel ── */
    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 24px;
    }
    .config-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 16px;
    }
    .config-label {
      font-size: 11px; font-weight: 600; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px;
    }
    .radio-group { display: flex; flex-direction: column; gap: 8px; }
    .radio-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; border-radius: 6px; cursor: pointer;
      transition: background 0.15s; font-size: 13px;
    }
    .radio-item:hover { background: var(--surface-hover); }
    .radio-item input[type="radio"] { accent-color: var(--accent); width: 14px; height: 14px; }
    .radio-item.selected { background: rgba(99,179,237,0.1); color: var(--accent); }

    /* ── Progress ── */
    .progress-section {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 20px; margin-top: 24px;
    }
    .progress-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .progress-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
    .progress-bar-bg {
      height: 8px; background: rgba(255,255,255,0.08);
      border-radius: 4px; overflow: hidden; margin-bottom: 12px;
    }
    .progress-bar-fill {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, var(--accent), #9a75ea);
      transition: width 0.4s ease;
      position: relative;
    }
    .progress-bar-fill::after {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    .progress-stats {
      display: flex; gap: 20px; font-size: 12px; color: var(--text-muted);
    }
    .progress-stat span { color: var(--text); font-weight: 500; }

    /* ── Result ── */
    .result-section {
      background: rgba(104,211,145,0.07); border: 1px solid rgba(104,211,145,0.2);
      border-radius: var(--radius); padding: 20px; margin-top: 24px;
      display: flex; align-items: center; gap: 16px;
    }
    .result-icon { font-size: 32px; flex-shrink: 0; }
    .result-info { flex: 1; }
    .result-title { font-size: 15px; font-weight: 600; color: var(--success); margin-bottom: 4px; }
    .result-meta { font-size: 13px; color: var(--text-muted); }
    .btn-download {
      background: var(--success); color: #0a0c14; padding: 10px 20px;
      border-radius: 8px; font-size: 14px; font-weight: 600;
      cursor: pointer; border: none; font-family: inherit;
      transition: opacity 0.2s; white-space: nowrap;
    }
    .btn-download:hover { opacity: 0.9; }

    .error-section {
      background: rgba(252,129,129,0.07); border: 1px solid rgba(252,129,129,0.25);
      border-radius: var(--radius); padding: 16px; margin-top: 20px;
      font-size: 13px; color: var(--error);
    }

    .hidden { display: none !important; }

    .action-row {
      display: flex; gap: 12px; align-items: center;
      margin-top: 24px; flex-wrap: wrap;
    }
    .action-row-right { margin-left: auto; display: flex; gap: 10px; }

    .tag {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;
    }
    .tag-img { background: rgba(99,179,237,0.15); color: #90cdf4; }
    .tag-doc { background: rgba(154,117,234,0.15); color: #d6bcfa; }
    .tag-xl { background: rgba(104,211,145,0.15); color: #9ae6b4; }
    .tag-zip { background: rgba(246,173,85,0.15); color: #fbd38d; }
    .tag-other { background: rgba(255,255,255,0.08); color: var(--text-muted); }

    .supported-info {
      margin-top: 16px; padding: 12px 16px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; font-size: 12px; color: var(--text-muted);
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .supported-info strong { color: var(--text); }

    /* Scrollbar */
    html { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
  </style>
</head>
<body>
  <header class="header">
    <span class="logo">🤖</span>
    <div>
      <h1>OCR Upload Portal</h1>
      <span>Châu Phiên Bản Số — Đọc & Trích xuất đa định dạng</span>
    </div>
    <div class="header-right">
      <a href="/" class="btn-home">← Về Dashboard</a>
    </div>
  </header>

  <main class="main">
    <!-- Drop Zone -->
    <div class="drop-zone" id="dropZone">
      <span class="drop-icon">📂</span>
      <h2>Kéo thả thư mục hoặc nhiều file vào đây</h2>
      <p>Hỗ trợ ảnh JPG/PNG, PDF, Word, Excel, CSV — cùng lúc không giới hạn số file</p>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="document.getElementById('folderInput').click()">
          📁 Chọn Thư mục
        </button>
        <button class="btn btn-secondary" onclick="document.getElementById('filesInput').click()">
          📎 Chọn Nhiều File
        </button>
      </div>
      <input type="file" id="folderInput" webkitdirectory multiple style="display:none">
      <input type="file" id="filesInput" multiple style="display:none"
        accept=".jpg,.jpeg,.png,.bmp,.tiff,.tif,.heic,.webp,.pdf,.docx,.doc,.xlsx,.xls,.ods,.csv,.txt,.md,.zip">
    </div>

    <div class="supported-info">
      <strong>Định dạng hỗ trợ:</strong>
      <span class="tag tag-img">🖼 JPG PNG TIFF HEIC WEBP</span>
      <span class="tag tag-doc">📄 PDF DOCX DOC</span>
      <span class="tag tag-xl">📊 XLSX XLS ODS CSV</span>
      <span class="tag tag-zip">📦 ZIP (giải nén tự động)</span>
      <span class="tag tag-other">📝 TXT MD</span>
    </div>

    <!-- File list -->
    <div class="section hidden" id="fileSection">
      <div class="section-header">
        <span class="section-title" id="fileCountLabel">0 file đã chọn</span>
        <span class="section-meta" id="fileSizeLabel"></span>
      </div>
      <div class="file-list" id="fileList"></div>

      <!-- Config -->
      <div class="config-grid">
        <div class="config-card">
          <div class="config-label">Chế độ OCR</div>
          <div class="radio-group" id="ocrModeGroup">
            <label class="radio-item selected" onclick="selectRadio(this,'ocrMode','auto')">
              <input type="radio" name="ocrMode" value="auto" checked> 🔍 Tự động nhận biết
            </label>
            <label class="radio-item" onclick="selectRadio(this,'ocrMode','table')">
              <input type="radio" name="ocrMode" value="table"> 📊 Bảng biểu / Điểm thi
            </label>
            <label class="radio-item" onclick="selectRadio(this,'ocrMode','text')">
              <input type="radio" name="ocrMode" value="text"> 📝 Văn bản thuần
            </label>
          </div>
        </div>

        <div class="config-card">
          <div class="config-label">Định dạng xuất</div>
          <div class="radio-group" id="outputFormatGroup">
            <label class="radio-item selected" onclick="selectRadio(this,'outputFormat','excel')">
              <input type="radio" name="outputFormat" value="excel" checked> 📊 Excel (.xlsx)
            </label>
            <label class="radio-item" onclick="selectRadio(this,'outputFormat','word')">
              <input type="radio" name="outputFormat" value="word"> 📄 Word (.docx)
            </label>
            <label class="radio-item" onclick="selectRadio(this,'outputFormat','csv')">
              <input type="radio" name="outputFormat" value="csv"> 📋 CSV
            </label>
            <label class="radio-item" onclick="selectRadio(this,'outputFormat','pdf')">
              <input type="radio" name="outputFormat" value="pdf"> 🔴 PDF
            </label>
            <label class="radio-item" onclick="selectRadio(this,'outputFormat','txt')">
              <input type="radio" name="outputFormat" value="txt"> 📝 Text
            </label>
          </div>
        </div>

        <div class="config-card">
          <div class="config-label">Sắp xếp kết quả</div>
          <div class="radio-group" id="sortByGroup">
            <label class="radio-item selected" onclick="selectRadio(this,'sortBy','none')">
              <input type="radio" name="sortBy" value="none" checked> ↕ Giữ nguyên thứ tự
            </label>
            <label class="radio-item" onclick="selectRadio(this,'sortBy','score_desc')">
              <input type="radio" name="sortBy" value="score_desc"> 🥇 Điểm cao → thấp
            </label>
            <label class="radio-item" onclick="selectRadio(this,'sortBy','score_asc')">
              <input type="radio" name="sortBy" value="score_asc"> 📈 Điểm thấp → cao
            </label>
            <label class="radio-item" onclick="selectRadio(this,'sortBy','name_asc')">
              <input type="radio" name="sortBy" value="name_asc"> 🔤 Tên A → Z
            </label>
          </div>
        </div>

        <div class="config-card">
          <div class="config-label">Tùy chỉnh nâng cao</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Tên file xuất</div>
              <input type="text" id="outputFileName" placeholder="OCR_ket_qua (tự động)"
                style="width:100%;background:rgba(255,255,255,0.05);border:1px solid var(--border);
                border-radius:6px;padding:7px 10px;color:var(--text);font-size:13px;font-family:inherit;outline:none;">
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Cột sắp xếp (tùy chọn)</div>
              <input type="text" id="sortColumn" placeholder="tong_diem"
                style="width:100%;background:rgba(255,255,255,0.05);border:1px solid var(--border);
                border-radius:6px;padding:7px 10px;color:var(--text);font-size:13px;font-family:inherit;outline:none;">
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Cột loại trùng (tùy chọn)</div>
              <input type="text" id="dedupKey" placeholder="so_bao_danh"
                style="width:100%;background:rgba(255,255,255,0.05);border:1px solid var(--border);
                border-radius:6px;padding:7px 10px;color:var(--text);font-size:13px;font-family:inherit;outline:none;">
            </div>
          </div>
        </div>
      </div>

      <!-- Action row -->
      <div class="action-row">
        <button class="btn btn-danger" id="btnClear" onclick="clearFiles()">🗑 Xóa tất cả</button>
        <div class="action-row-right">
          <button class="btn btn-primary btn-lg" id="btnRun" onclick="startOcr()">
            ⚡ Bắt đầu OCR & Xuất file
          </button>
        </div>
      </div>
    </div>

    <!-- Progress -->
    <div class="progress-section hidden" id="progressSection">
      <div class="progress-title" id="progressTitle">Đang upload file...</div>
      <div class="progress-sub" id="progressSub">Vui lòng chờ, không đóng trang này</div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" id="progressFill" style="width:0%"></div>
      </div>
      <div class="progress-stats">
        <div>Tiến độ: <span id="progressPct">0%</span></div>
        <div>File: <span id="progressFiles">0 / 0</span></div>
        <div>Thời gian: <span id="progressTime">0s</span></div>
      </div>
    </div>

    <!-- Error -->
    <div class="error-section hidden" id="errorSection"></div>

    <!-- Result -->
    <div class="result-section hidden" id="resultSection">
      <div class="result-icon">✅</div>
      <div class="result-info">
        <div class="result-title" id="resultTitle">Hoàn tất!</div>
        <div class="result-meta" id="resultMeta"></div>
      </div>
      <button class="btn-download" id="btnDownload" onclick="downloadResult()">
        ⬇ Tải xuống
      </button>
    </div>
  </main>

  <script>
    // ── State ──────────────────────────────────────────────────────────────────
    let selectedFiles = [];
    let currentSessionId = null;
    let resultBlob = null;
    let resultFileName = '';
    let startTime = 0;
    let timerInterval = null;

    // ── File icons by ext ──────────────────────────────────────────────────────
    function getFileIcon(name) {
      const ext = name.split('.').pop()?.toLowerCase() || '';
      if (['jpg','jpeg','png','bmp','tiff','tif','heic','webp'].includes(ext)) return '🖼';
      if (ext === 'pdf') return '📕';
      if (['docx','doc'].includes(ext)) return '📘';
      if (['xlsx','xls','ods','csv','tsv'].includes(ext)) return '📗';
      if (ext === 'zip') return '📦';
      if (['txt','md'].includes(ext)) return '📝';
      return '📄';
    }

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    function formatTime(ms) {
      const s = Math.floor(ms / 1000);
      if (s < 60) return s + 's';
      return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
    }

    // ── File selection ─────────────────────────────────────────────────────────
    function addFiles(fileList) {
      const newFiles = Array.from(fileList).filter(f => {
        const ext = '.' + f.name.split('.').pop().toLowerCase();
        const allowed = ['.jpg','.jpeg','.png','.bmp','.tiff','.tif','.heic','.webp',
          '.pdf','.docx','.doc','.xlsx','.xls','.ods','.csv','.tsv','.txt','.md','.zip'];
        return allowed.includes(ext) && f.size > 0;
      });

      // Dedup by name+size
      for (const f of newFiles) {
        if (!selectedFiles.some(x => x.name === f.name && x.size === f.size)) {
          selectedFiles.push(f);
        }
      }
      renderFileList();
    }

    function renderFileList() {
      const section = document.getElementById('fileSection');
      const list = document.getElementById('fileList');
      const countLabel = document.getElementById('fileCountLabel');
      const sizeLabel = document.getElementById('fileSizeLabel');

      if (selectedFiles.length === 0) {
        section.classList.add('hidden');
        return;
      }
      section.classList.remove('hidden');

      const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
      countLabel.textContent = \`\${selectedFiles.length} file đã chọn\`;
      sizeLabel.textContent = \`Tổng: \${formatSize(totalSize)}\`;

      list.innerHTML = selectedFiles.map((f, i) => \`
        <div class="file-item" id="file-\${i}">
          <span class="file-icon">\${getFileIcon(f.name)}</span>
          <span class="file-name" title="\${f.name}">\${f.name}</span>
          <span class="file-size">\${formatSize(f.size)}</span>
          <span class="file-status" id="status-\${i}">–</span>
        </div>
      \`).join('');
    }

    function clearFiles() {
      selectedFiles = [];
      currentSessionId = null;
      resultBlob = null;
      document.getElementById('fileSection').classList.add('hidden');
      document.getElementById('progressSection').classList.add('hidden');
      document.getElementById('resultSection').classList.add('hidden');
      document.getElementById('errorSection').classList.add('hidden');
      document.getElementById('folderInput').value = '';
      document.getElementById('filesInput').value = '';
    }

    // ── Input handlers ─────────────────────────────────────────────────────────
    document.getElementById('folderInput').addEventListener('change', e => {
      addFiles(e.target.files);
    });
    document.getElementById('filesInput').addEventListener('change', e => {
      addFiles(e.target.files);
    });

    // ── Drag-drop ──────────────────────────────────────────────────────────────
    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const items = e.dataTransfer.items;
      const files = e.dataTransfer.files;
      if (items && items.length) {
        // Dùng FileSystem API để hỗ trợ drag folder
        const filePromises = [];
        for (const item of items) {
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
          if (entry && entry.isDirectory) {
            filePromises.push(readDirectoryEntries(entry));
          } else if (item.kind === 'file') {
            const f = item.getAsFile();
            if (f) filePromises.push(Promise.resolve([f]));
          }
        }
        Promise.all(filePromises).then(results => {
          const allFiles = results.flat();
          if (allFiles.length > 0) addFiles(allFiles);
        });
      } else {
        addFiles(files);
      }
    });

    function readDirectoryEntries(dirEntry) {
      return new Promise(resolve => {
        const reader = dirEntry.createReader();
        const allFiles = [];
        function readBatch() {
          reader.readEntries(entries => {
            if (!entries.length) { resolve(allFiles); return; }
            const filePromises = entries
              .filter(e => e.isFile)  // Chỉ file, không đệ quy
              .map(e => new Promise(r => e.file(f => r(f), () => r(null))));
            Promise.all(filePromises).then(files => {
              allFiles.push(...files.filter(Boolean));
              readBatch();
            });
          }, () => resolve(allFiles));
        }
        readBatch();
      });
    }

    // ── Radio selection ─────────────────────────────────────────────────────────
    function selectRadio(el, name, value) {
      const group = el.closest('.radio-group');
      group.querySelectorAll('.radio-item').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      el.querySelector('input').checked = true;
    }

    function getRadio(name) {
      return document.querySelector(\`input[name="\${name}"]:checked\`)?.value || '';
    }

    // ── Progress helpers ────────────────────────────────────────────────────────
    function showProgress(title, sub, pct, filesDone, filesTotal) {
      document.getElementById('progressSection').classList.remove('hidden');
      document.getElementById('progressTitle').textContent = title;
      document.getElementById('progressSub').textContent = sub;
      document.getElementById('progressFill').style.width = pct + '%';
      document.getElementById('progressPct').textContent = Math.round(pct) + '%';
      document.getElementById('progressFiles').textContent = \`\${filesDone} / \${filesTotal}\`;
    }

    function showError(msg) {
      const el = document.getElementById('errorSection');
      el.classList.remove('hidden');
      el.textContent = '❌ ' + msg;
    }

    function showResult(fileName, stats) {
      document.getElementById('resultSection').classList.remove('hidden');
      document.getElementById('resultTitle').textContent = \`Hoàn tất! File sẵn sàng tải xuống.\`;
      const elapsed = formatTime(Date.now() - startTime);
      document.getElementById('resultMeta').textContent =
        \`\${fileName} · \${stats?.processedFiles ?? '?'} file xử lý · \${stats?.totalRows ? stats.totalRows + ' dòng dữ liệu · ' : ''}\${elapsed}\`;
      resultFileName = fileName;
    }

    // ── Main OCR flow ────────────────────────────────────────────────────────────
    async function startOcr() {
      if (selectedFiles.length === 0) return;

      document.getElementById('btnRun').disabled = true;
      document.getElementById('btnClear').disabled = true;
      document.getElementById('errorSection').classList.add('hidden');
      document.getElementById('resultSection').classList.add('hidden');
      startTime = Date.now();

      // Start timer
      timerInterval = setInterval(() => {
        document.getElementById('progressTime').textContent = formatTime(Date.now() - startTime);
      }, 1000);

      try {
        // ── Step 1: Upload ──
        showProgress('Đang upload file...', 'Đang tải lên server...', 5, 0, selectedFiles.length);

        const formData = new FormData();
        for (const f of selectedFiles) formData.append('files[]', f);

        const uploadRes = await fetch('/api/ocr/upload', {
          method: 'POST', body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({ error: 'Upload thất bại' }));
          throw new Error(err.error || 'Upload thất bại');
        }

        const uploadData = await uploadRes.json();
        currentSessionId = uploadData.sessionId;
        const totalFiles = uploadData.totalFiles;

        if (uploadData.warnings?.length) {
          console.warn('Upload warnings:', uploadData.warnings);
        }

        showProgress('Đang OCR...', \`Đang nhận diện chữ trong \${totalFiles} file...\`, 15, 0, totalFiles);

        // ── Step 2: OCR run ──
        const ocrMode = getRadio('ocrMode');
        const outputFormat = getRadio('outputFormat');
        const sortBy = getRadio('sortBy');
        const sortColumn = document.getElementById('sortColumn').value.trim() || undefined;
        const dedupKey = document.getElementById('dedupKey').value.trim() || undefined;
        const outputFileName = document.getElementById('outputFileName').value.trim() || undefined;

        // Fake progress animation while OCR runs
        let fakePct = 15;
        const fakeTimer = setInterval(() => {
          fakePct = Math.min(fakePct + 0.5, 85);
          document.getElementById('progressFill').style.width = fakePct + '%';
          document.getElementById('progressPct').textContent = Math.round(fakePct) + '%';
        }, 500);

        const runRes = await fetch('/api/ocr/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: currentSessionId,
            ocrMode, outputFormat, sortBy, sortColumn, dedupKey, outputFileName,
          }),
        });

        clearInterval(fakeTimer);

        if (!runRes.ok) {
          const err = await runRes.json().catch(() => ({ error: 'OCR thất bại' }));
          throw new Error(err.error || 'OCR thất bại');
        }

        // Parse stats from header
        const statsHeader = runRes.headers.get('X-OCR-Stats');
        const stats = statsHeader ? JSON.parse(statsHeader) : null;

        // Get filename from Content-Disposition
        const cd = runRes.headers.get('Content-Disposition') || '';
        const fnMatch = cd.match(/filename\\*=UTF-8''([^;]+)/i) || cd.match(/filename="([^"]+)"/i);
        const downloadName = fnMatch ? decodeURIComponent(fnMatch[1]) : 'ket_qua.xlsx';

        resultBlob = await runRes.blob();

        showProgress('Hoàn tất!', '', 100, stats?.processedFiles ?? totalFiles, stats?.totalFiles ?? totalFiles);

        // ── Step 3: Cleanup session (background) ──
        fetch(\`/api/ocr/\${currentSessionId}\`, { method: 'DELETE' }).catch(() => {});

        // ── Step 4: Show result ──
        showResult(downloadName, stats);

        // Update file statuses
        for (let i = 0; i < selectedFiles.length; i++) {
          const el = document.getElementById(\`status-\${i}\`);
          if (el) el.textContent = '✓';
        }

      } catch (err) {
        showError(err.message || 'Có lỗi xảy ra');
      } finally {
        clearInterval(timerInterval);
        document.getElementById('btnRun').disabled = false;
        document.getElementById('btnClear').disabled = false;
      }
    }

    function downloadResult() {
      if (!resultBlob || !resultFileName) return;
      const url = URL.createObjectURL(resultBlob);
      const a = document.createElement('a');
      a.href = url; a.download = resultFileName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  </script>
</body>
</html>`;
}
