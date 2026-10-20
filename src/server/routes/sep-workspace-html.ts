import zlib from "node:zlib";

/**
 * Giao diện Mobile Web App (PWA) "Sếp – Chief of Staff & Xưởng Skill" tại `/sep`
 * Thiết kế chuẩn theo bộ ảnh mẫu (Light Mode tinh tế + Dark Mode tùy chọn, Bean SVG 2 mắt,
 * Overlapping Multi-Bot Badges, Bảng giao việc Markdown Table, Stacked Preview Fan, Poll Card A/B/C/D/E)
 * nhưng nạp 100% dữ liệu thật từ source & SQLite DB của VBAIBot.
 */
const pngCache = new Map<number, Buffer>();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

export function getSepIconPng(size = 192): Buffer {
  const cached = pngCache.get(size);
  if (cached) return cached;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2;
  const cy = size * 0.52;
  const rx = size * 0.32;
  const ry = size * 0.26;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      // Nền xanh ngọc #10b981
      let r = 16,
        g = 185,
        b = 129;
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        // Thân Bean trắng
        r = 255;
        g = 255;
        b = 255;
        // Hai mắt đen
        const ex1 = (x - size * 0.41) / (size * 0.032);
        const ex2 = (x - size * 0.55) / (size * 0.032);
        const ey = (y - size * 0.48) / (size * 0.065);
        if ((Math.abs(ex1) <= 1 || Math.abs(ex2) <= 1) && Math.abs(ey) <= 1) {
          r = 17;
          g = 24;
          b = 39;
        }
      }
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const out = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  pngCache.set(size, out);
  return out;
}

export function getSepIconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="128" fill="#10b981"/>
  <ellipse cx="256" cy="266" rx="168" ry="138" transform="rotate(-14 256 266)" fill="#ffffff"/>
  <rect x="195" y="218" width="26" height="56" rx="13" fill="#111827" transform="rotate(-12 208 246)"/>
  <rect x="268" y="208" width="26" height="56" rx="13" fill="#111827" transform="rotate(-12 281 236)"/>
</svg>`;
}

export function getSepServiceWorkerJs(): string {
  return `self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request));
});`;
}

export function getSepManifestJson(): string {
  return JSON.stringify(
    {
      id: "/sep?v=5",
      name: "Sếp VBAIBot – Chief of Staff",
      short_name: "Sếp VBAIBot",
      description: "Điều phối Multi-Agent, Kỹ năng (.agents/skills), Xưởng Skill Sandbox & Voice Chat",
      start_url: "/sep",
      scope: "/sep",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      orientation: "portrait-primary",
      icons: [
        {
          src: "/sep/icon-192.png?v=5",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/sep/icon-512.png?v=5",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/sep/icon-512.png?v=5",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
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
  <meta name="theme-color" content="#ffffff" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <link rel="icon" type="image/png" sizes="192x192" href="/sep/icon-192.png?v=5" />
  <link rel="apple-touch-icon" href="/sep/icon-192.png?v=5" />
  <link rel="manifest" href="/sep/manifest.json?v=5" />
  <title>Sếp – Chief of Staff | VBAIBot Multi-Agent</title>
  <style>
    :root {
      --bg: #ffffff;
      --bubble-bg: #f3f4f6;
      --card-bg: #f3f4f6;
      --card-inner: #ffffff;
      --pill-bg: rgba(255, 255, 255, 0.94);
      --border: rgba(0, 0, 0, 0.07);
      --divider: rgba(0, 0, 0, 0.08);
      --text: #111827;
      --muted: #6b7280;
      --subtle: #9ca3af;
      --blue: #2563eb;
      --green: #10b981;
      --shadow-float: 0 4px 18px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
      --submit-bg: #e5e7eb;
      --submit-text: #6b7280;
      --submit-active-bg: #111827;
      --submit-active-text: #ffffff;
    }
    body.dark {
      --bg: #0b0d13;
      --bubble-bg: #181c26;
      --card-bg: #181c26;
      --card-inner: #222736;
      --pill-bg: rgba(24, 28, 38, 0.94);
      --border: rgba(255, 255, 255, 0.09);
      --divider: rgba(255, 255, 255, 0.09);
      --text: #f3f4f6;
      --muted: #9ca3af;
      --subtle: #6b7280;
      --shadow-float: 0 6px 20px rgba(0, 0, 0, 0.45);
      --submit-bg: #2d3346;
      --submit-text: #9ca3af;
      --submit-active-bg: #f3f4f6;
      --submit-active-text: #111827;
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
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
    }
    .app-shell {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      max-width: 520px;
      margin: 0 auto;
      background: var(--bg);
      position: relative;
      border-left: 1px solid var(--border);
      border-right: 1px solid var(--border);
    }

    /* Floating Top Bar (giống hệt ảnh mẫu: nút < tròn, pill giữa có Bean SVG, nút ••• tròn) */
    .top-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      z-index: 25;
      pointer-events: none;
      background: linear-gradient(to bottom, var(--bg) 35%, rgba(255,255,255,0));
    }
    body.dark .top-bar {
      background: linear-gradient(to bottom, var(--bg) 35%, rgba(11,13,19,0));
    }
    .float-circle-btn {
      pointer-events: auto;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--pill-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-float);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 18px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .float-circle-btn:active {
      transform: scale(0.95);
    }
    .bot-selector-pill {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--pill-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-float);
      padding: 7px 18px 7px 12px;
      border-radius: 999px;
      cursor: pointer;
      max-width: calc(100% - 112px);
      user-select: none;
    }
    .bot-selector-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text);
    }

    /* Chat Stream */
    .chat-stream {
      flex: 1;
      overflow-y: auto;
      padding: 72px 14px 110px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }

    /* Dòng trạng thái Voice chat · 02:36 👍 👎 */
    .voice-call-divider {
      align-self: center;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 4px 10px;
      font-size: 13.5px;
      color: var(--subtle);
      margin: 2px 0;
    }
    .voice-wave-mini {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      height: 12px;
    }
    .voice-wave-mini span {
      display: inline-block;
      width: 2px;
      background: var(--subtle);
      border-radius: 2px;
    }
    .thumb-btn {
      background: none;
      border: none;
      color: var(--subtle);
      cursor: pointer;
      font-size: 13px;
      padding: 2px 4px;
      opacity: 0.75;
    }
    .thumb-btn.liked {
      opacity: 1;
      color: var(--blue);
    }

    /* Dòng liên lạc Liên Bot: "3 messages with [🔴][🟢][🩷] 3 Bots" hoặc "Messaged [🟠] Radar..." */
    .interbot-row {
      align-self: center;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 14px;
      color: var(--muted);
      padding: 4px 10px;
      cursor: pointer;
      user-select: none;
    }
    .bean-stack {
      display: inline-flex;
      align-items: center;
    }
    .bean-stack .bean-wrap {
      margin-left: -5px;
      display: inline-flex;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.12));
    }
    .bean-stack .bean-wrap:first-child {
      margin-left: 0;
    }
    .bot-trace-details {
      display: none;
      align-self: center;
      width: 94%;
      background: var(--bubble-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 10px 14px;
      font-size: 13px;
      color: var(--muted);
      flex-direction: column;
      gap: 6px;
    }
    .bot-trace-details.open {
      display: flex;
    }

    /* Bong bóng chat của người dùng & Assistant */
    .user-bubble {
      align-self: flex-end;
      background: var(--blue);
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 22px 22px 6px 22px;
      max-width: 84%;
      font-size: 16px;
      line-height: 1.48;
      word-break: break-word;
    }
    .assistant-group {
      align-self: flex-start;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .assistant-bubble {
      background: var(--bubble-bg);
      color: var(--text);
      padding: 16px 18px;
      border-radius: 22px;
      font-size: 16.5px;
      line-height: 1.56;
      word-break: break-word;
      width: 92%;
    }
    .assistant-bubble p {
      margin-bottom: 12px;
    }
    .assistant-bubble p:last-child {
      margin-bottom: 0;
    }
    .assistant-bubble ul, .assistant-bubble ol {
      margin: 6px 0 12px 22px;
    }
    .assistant-bubble li {
      margin-bottom: 6px;
    }
    .assistant-bubble strong {
      font-weight: 700;
    }
    .assistant-bubble code {
      background: rgba(0, 0, 0, 0.06);
      padding: 2px 6px;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 14.5px;
    }
    body.dark .assistant-bubble code {
      background: rgba(255, 255, 255, 0.1);
    }
    .assistant-bubble a {
      color: var(--text);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    /* Bảng giao việc (Markdown Table trong bong bóng chat giống ảnh 09:06) */
    .md-table-wrap {
      overflow-x: auto;
      margin: 10px 0 12px;
      padding-bottom: 4px;
    }
    table.md-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 15px;
      min-width: 280px;
    }
    table.md-table th {
      text-align: left;
      font-weight: 700;
      padding: 8px 10px 8px 0;
      border-bottom: 1px solid var(--divider);
      color: var(--text);
    }
    table.md-table td {
      padding: 10px 10px 10px 0;
      border-bottom: 1px solid var(--divider);
      color: var(--muted);
      vertical-align: top;
      line-height: 1.42;
    }
    table.md-table td:first-child {
      color: var(--muted);
      font-weight: 500;
      width: 36%;
    }

    /* Quạt 3 trang Slide / Preview xếp chồng (giống ảnh 09:04 Soạn Bài Đào Tạo) */
    .preview-stack-wrap {
      width: 82%;
      margin: 4px 0 2px;
      cursor: pointer;
    }
    .preview-fan {
      position: relative;
      height: 210px;
      width: 100%;
      margin-bottom: 8px;
    }
    .fan-card {
      position: absolute;
      top: 6px;
      left: 0;
      width: 78%;
      height: 196px;
      background: var(--card-inner);
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 14px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.1);
      overflow: hidden;
      padding: 8px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: repeat(3, 1fr);
      gap: 5px;
    }
    .fan-card.back-2 {
      transform: translateX(36px) rotate(7deg) scale(0.92);
      opacity: 0.75;
      z-index: 1;
    }
    .fan-card.back-1 {
      transform: translateX(18px) rotate(3.5deg) scale(0.96);
      opacity: 0.9;
      z-index: 2;
    }
    .fan-card.front {
      z-index: 3;
    }
    .mini-slide {
      background: #fafaf9;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 4px 5px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .mini-slide-bar {
      height: 4px;
      border-radius: 2px;
      background: #0d9488;
      width: 65%;
    }
    .mini-slide-lines {
      height: 3px;
      background: #d1d5db;
      border-radius: 2px;
      width: 90%;
      box-shadow: 0 5px 0 #e5e7eb, 0 10px 0 #e5e7eb;
      margin-bottom: 12px;
    }
    .preview-count-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13.5px;
      color: var(--muted);
      padding-left: 4px;
    }

    /* Thẻ File đính kèm (.xlsx, .md, .html) kèm dung lượng thật 31 KB, 6.1 KB, 460 KB */
    .file-card-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 82%;
    }
    .file-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--bubble-bg);
      padding: 12px 14px;
      border-radius: 18px;
      text-decoration: none;
      color: var(--text);
      transition: transform 0.12s ease;
    }
    .file-card:active {
      transform: scale(0.98);
    }
    .file-icon-box {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
    }
    body.dark .file-icon-box {
      background: rgba(255, 255, 255, 0.08);
    }
    .file-meta {
      flex: 1;
      min-width: 0;
    }
    .file-name {
      font-size: 15.5px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text);
    }
    .file-name .ext-part {
      color: var(--subtle);
      font-weight: 500;
    }
    .file-sub {
      font-size: 13px;
      color: var(--subtle);
      margin-top: 1px;
    }

    /* Thẻ câu hỏi Duyệt (Decision Poll Card A/B/C/D/E + Submit giống ảnh 07:12 & 08:52) */
    .decision-card {
      background: var(--card-bg);
      border-radius: 22px;
      padding: 16px;
      width: 92%;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .decision-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }
    .decision-title {
      font-size: 16.5px;
      font-weight: 700;
      line-height: 1.38;
      color: var(--text);
    }
    .decision-close {
      background: none;
      border: none;
      color: var(--subtle);
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .decision-options-box {
      background: var(--card-inner);
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .decision-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 13px 14px;
      cursor: pointer;
      user-select: none;
      border-bottom: 1px solid var(--divider);
      transition: background 0.12s ease;
    }
    .decision-option:last-child {
      border-bottom: none;
    }
    .decision-option.selected {
      background: rgba(37, 99, 235, 0.08);
    }
    .decision-badge {
      width: 26px;
      height: 26px;
      border-radius: 7px;
      background: var(--bubble-bg);
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .decision-option.selected .decision-badge {
      background: var(--blue);
      color: #ffffff;
    }
    .decision-label {
      font-size: 15.5px;
      line-height: 1.38;
      color: var(--text);
      flex: 1;
    }
    .decision-hint {
      font-size: 13.5px;
      color: var(--subtle);
    }
    .decision-submit {
      width: 100%;
      background: var(--submit-bg);
      color: var(--submit-text);
      border: none;
      border-radius: 14px;
      padding: 12px;
      font-size: 15.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .decision-submit.ready {
      background: var(--submit-active-bg);
      color: var(--submit-active-text);
    }

    /* Nút cuộn xuống đáy (⌄) góc phải dưới */
    .scroll-bottom-btn {
      position: absolute;
      right: 16px;
      bottom: 78px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--pill-bg);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-float);
      color: var(--text);
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 20;
      font-size: 16px;
    }
    .scroll-bottom-btn.show {
      display: flex;
    }

    /* Thanh nhập liệu nổi ở đáy: nút (+) tròn bên trái, pill "Ask Sếp..." có 🎤 và nút đen (|||) bên phải */
    .composer-float {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 8px 14px calc(12px + env(safe-area-inset-bottom));
      background: linear-gradient(to top, var(--bg) 65%, rgba(255,255,255,0));
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 25;
    }
    body.dark .composer-float {
      background: linear-gradient(to top, var(--bg) 65%, rgba(11,13,19,0));
    }
    .plus-circle-btn {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: var(--pill-bg);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-float);
      color: var(--text);
      font-size: 24px;
      font-weight: 400;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
    }
    .ask-pill-box {
      flex: 1;
      display: flex;
      align-items: center;
      background: var(--pill-bg);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-float);
      border-radius: 999px;
      padding: 5px 6px 5px 16px;
      gap: 6px;
      min-width: 0;
    }
    .composer-input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text);
      font-size: 16px;
      padding: 7px 0;
      outline: none;
      min-width: 0;
    }
    .composer-input::placeholder {
      color: var(--subtle);
    }
    .mic-inline-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
    }
    .mic-inline-btn.recording {
      background: #ef4444;
      color: #ffffff;
    }
    .voice-pill-black {
      height: 36px;
      padding: 0 14px;
      border-radius: 999px;
      border: none;
      background: #111827;
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      cursor: pointer;
      flex-shrink: 0;
    }
    body.dark .voice-pill-black {
      background: #f3f4f6;
      color: #111827;
    }
    .voice-pill-black.active {
      background: #10b981;
      color: #ffffff;
    }
    .wave-bar {
      width: 2.2px;
      background: currentColor;
      border-radius: 2px;
    }

    /* Drawer chọn Bot, gợi ý nhanh & Cài đặt */
    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(3px);
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
      max-width: 520px;
      max-height: 82dvh;
      background: var(--card-inner);
      border-top-left-radius: 24px;
      border-top-right-radius: 24px;
      padding: 16px;
      overflow-y: auto;
      box-shadow: 0 -8px 30px rgba(0,0,0,0.18);
    }
    .drawer-handle {
      width: 40px;
      height: 4px;
      background: var(--divider);
      border-radius: 999px;
      margin: 0 auto 14px;
    }
    .drawer-section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin: 14px 0 8px;
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
      background: var(--bubble-bg);
    }
    .bot-list-item.active {
      border-color: var(--blue);
    }
    .bot-list-info {
      flex: 1;
      min-width: 0;
    }
    .bot-list-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
    }
    .bot-list-desc {
      font-size: 12.5px;
      color: var(--muted);
      margin-top: 2px;
      line-height: 1.35;
    }
    .quick-action-item {
      display: block;
      width: 100%;
      text-align: left;
      padding: 11px 14px;
      border-radius: 12px;
      background: var(--bubble-bg);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 14px;
      margin-bottom: 6px;
      cursor: pointer;
    }
    .typing-dots {
      align-self: flex-start;
      padding: 12px 16px;
      background: var(--bubble-bg);
      border-radius: 18px;
      font-size: 14px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <!-- Floating Top Bar chuẩn ảnh mẫu -->
    <header class="top-bar">
      <button class="float-circle-btn" id="openDrawerBtn" title="Danh sách Bot & Xưởng Skill">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="bot-selector-pill" id="botSelectorPill">
        <span id="activeBotBeanWrap" style="display:inline-flex"></span>
        <span class="bot-selector-title" id="activeBotName">Sếp – Chief of Staff</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button id="installPwaBtn" style="height:38px;padding:0 12px;border-radius:999px;background:#10b981;color:#fff;border:none;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:var(--shadow-float);display:inline-flex;align-items:center;gap:4px;" title="Cài ứng dụng lên màn hình chính Samsung">📲 Cài App</button>
        <button class="float-circle-btn" id="moreMenuBtn" title="Tùy chọn & Radar Dashboard">•••</button>
      </div>
    </header>

    <!-- Chat Stream -->
    <main class="chat-stream" id="chatStream"></main>

    <!-- Nút cuộn xuống đáy (⌄) -->
    <button class="scroll-bottom-btn" id="scrollBottomBtn" title="Cuộn xuống cuối">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </button>

    <!-- Thanh nhập liệu nổi ở đáy chuẩn ảnh mẫu -->
    <footer class="composer-float">
      <button class="plus-circle-btn" id="plusPromptBtn" title="Tác vụ nhanh & Đính kèm">+</button>
      <div class="ask-pill-box">
        <input
          type="text"
          id="chatInput"
          class="composer-input"
          placeholder="Ask Sếp – Chief of Staff"
          autocomplete="off"
        />
        <button class="mic-inline-btn" id="micBtn" title="Nhấn để nói tiếng Việt">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
        </button>
        <button class="voice-pill-black" id="voiceLiveBtn" title="Đàm thoại giọng nói trực tiếp / Gửi">
          <span class="wave-bar" style="height:8px"></span>
          <span class="wave-bar" style="height:14px"></span>
          <span class="wave-bar" style="height:10px"></span>
          <span class="wave-bar" style="height:15px"></span>
          <span class="wave-bar" style="height:7px"></span>
        </button>
      </div>
    </footer>

    <!-- Drawer Hướng dẫn & Cài App 1 chạm lên màn hình Samsung -->
    <div class="drawer-backdrop" id="installDrawerBackdrop">
      <div class="drawer-sheet">
        <div class="drawer-handle"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <strong style="font-size:17px;">📲 Đưa Sếp VBAIBot ra màn hình Samsung</strong>
          <button id="closeInstallDrawerBtn" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div style="font-size:13.5px;line-height:1.55;color:var(--text);">
          <div id="zaloWarningBox" style="display:none;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;padding:12px;margin-bottom:10px;color:#065f46;">
            <strong>⚠️ Bạn đang mở trong Zalo:</strong><br/>
            Bấm nút dưới đây để chuyển sang trình duyệt <strong>Chrome</strong> hoặc <strong>Samsung Internet</strong>:
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
              <a href="intent://vbaibot.chauphienbanso.com/sep#Intent;scheme=https;package=com.android.chrome;end" style="display:block;text-align:center;background:#10b981;color:#fff;font-weight:700;padding:11px;border-radius:10px;text-decoration:none;">🚀 Mở bằng Google Chrome</a>
              <a href="intent://vbaibot.chauphienbanso.com/sep#Intent;scheme=https;package=com.sec.android.app.sbrowser;end" style="display:block;text-align:center;background:#2563eb;color:#fff;font-weight:700;padding:10px;border-radius:10px;text-decoration:none;">🌐 Mở bằng Samsung Internet</a>
            </div>
          </div>

          <div style="background:#eff6ff;border:2px solid #3b82f6;border-radius:12px;padding:13px;margin-bottom:10px;color:#1e3a8a;">
            <strong style="font-size:14.5px;">✅ Cách chuẩn nhất trên Chrome điện thoại Samsung (không bao giờ bị chặn):</strong><br/>
            <div style="margin-top:6px;">
              <strong>Bước 1:</strong> Nhìn lên <strong>góc trên cùng bên phải màn hình</strong> (ngay bên phải ô số trang <code>[2]</code> của Chrome), bấm vào dấu <strong>3 chấm dọc <code>⋮</code></strong>.<br/>
              <strong>Bước 2:</strong> Chọn dòng <strong><code>Thêm vào màn hình chính</code></strong> (Add to Home screen).<br/>
              <strong>Bước 3 (Quan trọng):</strong> Khi bảng hiện ra 2 dòng <em>"Cài đặt"</em> và <em>"Tạo lối tắt"</em>:<br/>
              👉 Nếu máy Samsung chặn mục <em>"Cài đặt"</em> (do bật <em>Trình chặn tự động / Auto Blocker</em> hoặc đã cài bản Dashboard gốc), hãy bấm chọn dòng thứ 2: <strong><code>Tạo lối tắt</code> (Create shortcut)</strong> $\rightarrow$ bấm <strong><code>Thêm</code></strong>!
            </div>
          </div>

          <div style="background:var(--bubble-bg);border:1px solid var(--border);border-radius:12px;padding:12px;">
            <strong>Hoặc nếu dùng trình duyệt Samsung Internet:</strong><br/>
            1. Bấm biểu tượng <strong><code>≡</code> (3 gạch ngang ở góc dưới bên phải)</strong>.<br/>
            2. Bấm <strong><code>+ Thêm trang vào</code></strong> $\rightarrow$ chọn <strong><code>Màn hình chính</code></strong>.
          </div>
        </div>
      </div>
    </div>

    <!-- Drawer chọn Agent / Kỹ năng (.agents/skills) -->
    <div class="drawer-backdrop" id="drawerBackdrop">
      <div class="drawer-sheet">
        <div class="drawer-handle"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <strong style="font-size:17px;">Đội ngũ Bot & Kỹ năng VBAIBot</strong>
          <div style="display:flex;gap:8px;align-items:center;">
            <a href="/radar" style="font-size:13px;font-weight:600;color:var(--blue);text-decoration:none;padding:6px 10px;background:var(--bubble-bg);border-radius:8px;">📊 Mở Radar 3 Tab</a>
            <button id="toggleThemeBtn" style="font-size:13px;font-weight:600;color:var(--text);border:1px solid var(--border);padding:6px 10px;background:var(--bubble-bg);border-radius:8px;cursor:pointer;">🌗 Sáng/Tối</button>
            <button id="closeDrawerBtn" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;padding:0 4px;">✕</button>
          </div>
        </div>
        <div class="drawer-section-title">Chọn Bot / Kỹ năng thực tế (.agents/skills)</div>
        <div id="botListContainer"></div>
        <div class="drawer-section-title">Skill đang chờ duyệt trong Sandbox (.agents/skill-drafts)</div>
        <div id="draftSkillContainer" style="font-size:13px;color:var(--muted);">Đang tải...</div>
      </div>
    </div>

    <!-- Drawer Tác vụ nhanh khi bấm nút (+) -->
    <div class="drawer-backdrop" id="quickDrawerBackdrop">
      <div class="drawer-sheet">
        <div class="drawer-handle"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <strong style="font-size:16px;">Giao việc nhanh cho Đội ngũ VBAIBot</strong>
          <button id="closeQuickDrawerBtn" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;">✕</button>
        </div>
        <button class="quick-action-item" data-prompt="Hãy tiến hành tạo skill để triển khai dữ liệu tra cứu từ các nguồn trên internet để triển khai cho ngành Quản lý thị trường (lưu vào Sandbox kèm kết quả chạy thử để tôi duyệt)">🛡️ Tạo Skill Tra cứu Internet cho ngành Quản lý thị trường</button>
        <button class="quick-action-item" data-prompt="Lập bảng giao việc phối hợp giữa các kỹ năng trong hệ thống VBAIBot (Tra cứu hành chính, Soạn VB NĐ30, Rà soát VBHC, Kế toán TT99, Xưởng Skill) và cho tôi duyệt các mục tiếp theo">📋 Lập Bảng giao việc phối hợp các Bot & Kỹ năng</button>
        <button class="quick-action-item" data-prompt="Tra cứu thẩm quyền hành chính và soạn công văn chuẩn Nghị định 30/2020/NĐ-CP">📘 Soạn VB Hành chính NĐ30 + Tra cứu thẩm quyền</button>
        <button class="quick-action-item" data-prompt="Nhờ Xưởng Skill thiết kế và chạy thử nghiệm Sandbox 1 kỹ năng mới từ nhu cầu thực tế, xuất kèm file SKILL.md và sample-test.md để tôi duyệt">🛠️ Giao Xưởng Skill tạo & chạy thử Skill trong Sandbox</button>
        <button class="quick-action-item" data-prompt="Xuất báo cáo tổng hợp Excel (.xlsx) và tài liệu hướng dẫn (.html) về quy trình kiểm soát chứng từ kế toán TT99/2025 và thuế">📊 Xuất bảng Excel (.xlsx) & Slide/Tài liệu (.html)</button>
      </div>
    </div>
  </div>

  <script>
    const sessionId = localStorage.getItem("sep_session_id") || ("ss_" + Math.random().toString(36).slice(2, 10));
    localStorage.setItem("sep_session_id", sessionId);

    if (localStorage.getItem("sep_theme") === "dark") {
      document.body.classList.add("dark");
    }

    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sep-sw.js", { scope: "/sep" }).catch(() => {});
    }

    const zaloWarningBox = document.getElementById("zaloWarningBox");
    if (zaloWarningBox && /Zalo/i.test(navigator.userAgent || "")) {
      zaloWarningBox.style.display = "block";
    }

    let deferredPwaPrompt = null;
    const installPwaBtn = document.getElementById("installPwaBtn");
    const installDrawerBackdrop = document.getElementById("installDrawerBackdrop");

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPwaPrompt = e;
    });

    if (window.matchMedia("(display-mode: standalone)").matches) {
      installPwaBtn.style.display = "none";
    }

    installPwaBtn.addEventListener("click", async () => {
      if (deferredPwaPrompt) {
        deferredPwaPrompt.prompt();
        const choice = await deferredPwaPrompt.userChoice.catch(() => null);
        if (choice && choice.outcome === "accepted") {
          deferredPwaPrompt = null;
          installPwaBtn.style.display = "none";
          return;
        }
      }
      installDrawerBackdrop.classList.add("open");
    });

    document.getElementById("closeInstallDrawerBtn").addEventListener("click", () => {
      installDrawerBackdrop.classList.remove("open");
    });
    installDrawerBackdrop.addEventListener("click", (e) => {
      if (e.target === installDrawerBackdrop) installDrawerBackdrop.classList.remove("open");
    });

    let bots = [];
    let activeBotId = "sep-chief";
    let autoVoiceMode = localStorage.getItem("sep_auto_voice") === "1";
    let currentAudio = null;
    let initializedGreeting = false;

    const chatStream = document.getElementById("chatStream");
    const chatInput = document.getElementById("chatInput");
    const micBtn = document.getElementById("micBtn");
    const voiceLiveBtn = document.getElementById("voiceLiveBtn");
    const activeBotNameEl = document.getElementById("activeBotName");
    const activeBotBeanWrap = document.getElementById("activeBotBeanWrap");
    const drawerBackdrop = document.getElementById("drawerBackdrop");
    const quickDrawerBackdrop = document.getElementById("quickDrawerBackdrop");
    const botListContainer = document.getElementById("botListContainer");
    const draftSkillContainer = document.getElementById("draftSkillContainer");
    const scrollBottomBtn = document.getElementById("scrollBottomBtn");

    // Vẽ SVG "Hạt đậu 2 mắt trắng" (Bean / Hex / Tri) giống hệt bộ icon trong ảnh mẫu
    function renderBeanSvg(color = "#10b981", shape = "bean", size = 26) {
      if (shape === "hex") {
        return \`<svg width="\${size}" height="\${size}" viewBox="0 0 36 36"><path d="M18 3 L31 10.5 L31 25.5 L18 33 L5 25.5 L5 10.5 Z" fill="\${color}" stroke="none"/><rect x="13" y="13" width="2.8" height="6.5" rx="1.4" fill="#fff" transform="rotate(-10 14 16)"/><rect x="19.5" y="12.5" width="2.8" height="6.5" rx="1.4" fill="#fff" transform="rotate(-10 21 16)"/></svg>\`;
      }
      if (shape === "tri") {
        return \`<svg width="\${size}" height="\${size}" viewBox="0 0 36 36"><path d="M7 28 Q4 10 19 6 Q32 12 29 28 Q18 32 7 28 Z" fill="\${color}"/><rect x="13.5" y="14" width="2.8" height="6" rx="1.4" fill="#fff" transform="rotate(-8 15 17)"/><rect x="19.5" y="13.5" width="2.8" height="6" rx="1.4" fill="#fff" transform="rotate(-8 21 16)"/></svg>\`;
      }
      return \`<svg width="\${size}" height="\${size}" viewBox="0 0 36 36"><ellipse cx="18" cy="18" rx="15" ry="12" transform="rotate(-16 18 18)" fill="\${color}"/><rect x="13" y="13.5" width="2.8" height="6.5" rx="1.4" fill="#fff" transform="rotate(-14 14 16)"/><rect x="19.5" y="12.5" width="2.8" height="6.5" rx="1.4" fill="#fff" transform="rotate(-14 21 15)"/></svg>\`;
    }

    activeBotBeanWrap.innerHTML = renderBeanSvg("#10b981", "bean", 28);

    function updateVoiceModeUi() {
      voiceLiveBtn.classList.toggle("active", autoVoiceMode);
    }
    updateVoiceModeUi();

    document.getElementById("toggleThemeBtn").addEventListener("click", () => {
      document.body.classList.toggle("dark");
      localStorage.setItem("sep_theme", document.body.classList.contains("dark") ? "dark" : "light");
    });

    chatStream.addEventListener("scroll", () => {
      const dist = chatStream.scrollHeight - chatStream.scrollTop - chatStream.clientHeight;
      scrollBottomBtn.classList.toggle("show", dist > 120);
    });
    scrollBottomBtn.addEventListener("click", () => {
      chatStream.scrollTop = chatStream.scrollHeight;
    });

    // Render Markdown chuẩn Mobile + Hỗ trợ đầy đủ Bảng giao việc (Markdown Table | Bot | Việc |)
    function renderMarkdown(md) {
      if (!md) return "";
      let html = md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      html = html.replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>");
      html = html.replace(/\`([^\`]+)\`/g, "<code>$1</code>");
      html = html.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+|\\/[^\\s)]+)\\)/g, '<a href="$2" target="_blank">🌐 $1</a>');

      const lines = html.split("\\n");
      const out = [];
      let inList = false;
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];

        // Nhận diện bảng Markdown: dòng hiện tại có | và dòng kế tiếp là |---|---|
        if (
          line.trim().startsWith("|") &&
          i + 1 < lines.length &&
          /^\\s*\\|[\\s:-]+\\|/.test(lines[i + 1])
        ) {
          if (inList) { out.push("</ul>"); inList = false; }
          const headers = line
            .trim()
            .replace(/^\\||\\|$/g, "")
            .split("|")
            .map((h) => h.trim());
          i += 2; // bỏ qua dòng phân cách |---|---|
          const rows = [];
          while (i < lines.length && lines[i].trim().startsWith("|")) {
            const cells = lines[i]
              .trim()
              .replace(/^\\||\\|$/g, "")
              .split("|")
              .map((c) => c.trim());
            rows.push(cells);
            i++;
          }
          let tableHtml = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
          for (const h of headers) tableHtml += \`<th>\${h}</th>\`;
          tableHtml += "</tr></thead><tbody>";
          for (const r of rows) {
            tableHtml += "<tr>" + r.map((c) => \`<td>\${c}</td>\`).join("") + "</tr>";
          }
          tableHtml += "</tbody></table></div>";
          out.push(tableHtml);
          continue;
        }

        if (/^### (.*$)/.test(line)) {
          if (inList) { out.push("</ul>"); inList = false; }
          out.push("<h3>" + line.replace(/^### /, "") + "</h3>");
        } else if (/^## (.*$)/.test(line)) {
          if (inList) { out.push("</ul>"); inList = false; }
          out.push("<h2>" + line.replace(/^## /, "") + "</h2>");
        } else if (/^\\s*[-*•]\\s+/.test(line)) {
          if (!inList) { out.push("<ul>"); inList = true; }
          out.push("<li>" + line.replace(/^\\s*[-*•]\\s+/, "") + "</li>");
        } else {
          if (inList) { out.push("</ul>"); inList = false; }
          if (line.trim() !== "") {
            out.push("<p>" + line + "</p>");
          }
        }
        i++;
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

    // Dòng trạng thái Voice chat · 02:36 👍 👎 chuẩn ảnh mẫu
    function appendVoiceDivider(durationSec) {
      const mins = String(Math.floor(durationSec / 60)).padStart(2, "0");
      const secs = String(durationSec % 60).padStart(2, "0");
      const div = document.createElement("div");
      div.className = "voice-call-divider";
      div.innerHTML = \`
        <span class="voice-wave-mini"><span style="height:5px"></span><span style="height:11px"></span><span style="height:7px"></span></span>
        <span>Voice chat · \${mins}:\${secs}</span>
        <button class="thumb-btn" title="Hài lòng">👍</button>
        <button class="thumb-btn" title="Chưa hài lòng">👎</button>
      \`;
      div.querySelectorAll(".thumb-btn").forEach((btn) => {
        btn.addEventListener("click", () => btn.classList.toggle("liked"));
      });
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

    function renderFileIconSvg(ext) {
      if (ext === ".xlsx") {
        return \`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>\`;
      }
      if (ext === ".html") {
        return \`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>\`;
      }
      return \`<span style="font-size:12px;font-weight:800;color:var(--muted)">M↓</span>\`;
    }

    function splitFileNameExt(fileName) {
      const idx = fileName.lastIndexOf(".");
      if (idx <= 0) return { base: fileName, ext: "" };
      return { base: fileName.slice(0, idx), ext: fileName.slice(idx) };
    }

    function appendAssistantTurn({ reply, botBadges = [], files = [], voiceUrl, voiceSec }) {
      const group = document.createElement("div");
      group.className = "assistant-group";

      // 1. Dòng liên lạc Liên Bot: "Messaged [🟠] Radar..." hoặc "3 messages with [🔴][🟢][🩷] 3 Bots"
      if (botBadges.length > 0) {
        const row = document.createElement("div");
        row.className = "interbot-row";
        const beansHtml = botBadges
          .slice(0, 4)
          .map((b) => \`<span class="bean-wrap">\${renderBeanSvg(b.color || "#10b981", b.shape || "bean", 20)}</span>\`)
          .join("");
        if (botBadges.length === 1) {
          row.innerHTML = \`<span>Messaged</span><span class="bean-stack">\${beansHtml}</span><span style="font-weight:500">\${botBadges[0].botName}</span>\`;
        } else {
          row.innerHTML = \`<span>\${botBadges.length} messages with</span><span class="bean-stack">\${beansHtml}</span><span>\${botBadges.length} Bots</span>\`;
        }

        const details = document.createElement("div");
        details.className = "bot-trace-details";
        details.innerHTML = botBadges
          .map((b) => \`<div style="display:flex;align-items:center;gap:6px">\${renderBeanSvg(b.color || "#10b981", b.shape || "bean", 16)} <strong>\${b.botName}:</strong> <span>\${b.summary}</span></div>\`)
          .join("");

        row.addEventListener("click", () => details.classList.toggle("open"));
        group.appendChild(row);
        group.appendChild(details);
      }

      if (typeof voiceSec === "number" && voiceSec > 0) {
        appendVoiceDivider(voiceSec);
      }

      // 2. Nội dung trả lời chính
      const bubble = document.createElement("div");
      bubble.className = "assistant-bubble";
      bubble.innerHTML = renderMarkdown(reply);
      group.appendChild(bubble);

      // 3. Nếu có file .html (Slide / Dashboard), hiển thị quạt 3 trang preview xếp chồng giống ảnh 09:04
      const htmlFiles = files.filter((f) => (f.ext || "").toLowerCase() === ".html");
      if (htmlFiles.length > 0) {
        const targetUrl = htmlFiles[0].viewUrl || htmlFiles[0].downloadUrl || "/radar";
        const stackWrap = document.createElement("div");
        stackWrap.className = "preview-stack-wrap";
        stackWrap.innerHTML = \`
          <div class="preview-fan">
            <div class="fan-card back-2">
              <div class="mini-slide"><div class="mini-slide-bar" style="background:#f97316"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar" style="background:#3b82f6"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar"></div><div class="mini-slide-lines"></div></div>
            </div>
            <div class="fan-card back-1">
              <div class="mini-slide"><div class="mini-slide-bar" style="background:#10b981"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar" style="background:#8b5cf6"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar"></div><div class="mini-slide-lines"></div></div>
            </div>
            <div class="fan-card front">
              <div class="mini-slide"><div class="mini-slide-bar" style="background:#e11d48"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar" style="background:#0d9488"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar" style="background:#2563eb"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar" style="background:#d97706"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar" style="background:#7c3aed"></div><div class="mini-slide-lines"></div></div>
              <div class="mini-slide"><div class="mini-slide-bar" style="background:#16a34a"></div><div class="mini-slide-lines"></div></div>
            </div>
          </div>
          <div class="preview-count-label">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
            <span>3 views · Chạm để mở trực tiếp</span>
          </div>
        \`;
        stackWrap.addEventListener("click", () => window.open(targetUrl, "_blank"));
        group.appendChild(stackWrap);
      }

      // 4. Thẻ đính kèm File (.xlsx, .md, .html) kèm dung lượng thật 31 KB, 6.1 KB, 460 KB
      if (files.length > 0) {
        const fileList = document.createElement("div");
        fileList.className = "file-card-list";
        for (const f of files) {
          const ext = (f.ext || "").toLowerCase();
          const parts = splitFileNameExt(f.fileName);
          const sizeText = f.sizeLabel || "18 KB";
          const targetHref = f.viewUrl || f.downloadUrl;

          const card = document.createElement("a");
          card.className = "file-card";
          card.href = targetHref;
          if (f.viewUrl) card.target = "_blank";
          else card.setAttribute("download", "");

          card.innerHTML = \`
            <div class="file-icon-box">\${renderFileIconSvg(ext)}</div>
            <div class="file-meta">
              <div class="file-name">\${parts.base}<span class="ext-part">\${parts.ext}</span></div>
              <div class="file-sub">\${sizeText}</div>
            </div>
          \`;
          fileList.appendChild(card);
        }
        group.appendChild(fileList);
      }

      // 5. Bảng chọn Duyệt (Decision Poll Card A/B/C/D/E + Submit giống hệt ảnh 07:12 & 08:52)
      const options = extractDecisionOptions(reply);
      if (options.length >= 2) {
        const card = document.createElement("div");
        card.className = "decision-card";
        const selectedKeys = new Set();

        let rowsHtml = "";
        for (const opt of options) {
          rowsHtml += \`
            <div class="decision-option" data-key="\${opt.key}" data-label="\${opt.label.replace(/"/g, "&quot;")}">
              <div class="decision-badge">\${opt.key}</div>
              <div class="decision-label">\${opt.label}</div>
            </div>
          \`;
        }

        card.innerHTML = \`
          <div class="decision-header">
            <div class="decision-title">Bạn duyệt những mục nào để làm tiếp?</div>
            <button class="decision-close" title="Đóng">✕</button>
          </div>
          <div class="decision-options-box">\${rowsHtml}</div>
          <div class="decision-hint">Or answer in the chat below</div>
          <button class="decision-submit">Submit</button>
        \`;

        const submitBtn = card.querySelector(".decision-submit");
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
            submitBtn.classList.toggle("ready", selectedKeys.size > 0);
          });
        });

        card.querySelector(".decision-close").addEventListener("click", () => {
          card.style.display = "none";
        });

        submitBtn.addEventListener("click", () => {
          const chosen = [];
          card.querySelectorAll(".decision-option.selected").forEach((r) => {
            chosen.push(\`[\${r.getAttribute("data-key")}] \${r.getAttribute("data-label")}\`);
          });
          if (chosen.length === 0) return;
          card.style.opacity = "0.55";
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
      loadingEl.textContent = "Đang điều phối xử lý trên hệ thống VBAIBot...";
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

    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendMessageToBot(chatInput.value);
      }
    });

    // Nút đen (|||) bên phải: nếu ô chat có chữ thì gửi luôn, nếu trống thì bật/tắt chế độ Voice Live
    voiceLiveBtn.addEventListener("click", () => {
      if (chatInput.value.trim()) {
        sendMessageToBot(chatInput.value);
        return;
      }
      autoVoiceMode = !autoVoiceMode;
      localStorage.setItem("sep_auto_voice", autoVoiceMode ? "1" : "0");
      updateVoiceModeUi();
      if (autoVoiceMode) {
        micBtn.click();
      }
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

    function openDrawer() { drawerBackdrop.classList.add("open"); }
    function closeDrawer() { drawerBackdrop.classList.remove("open"); }
    document.getElementById("openDrawerBtn").addEventListener("click", openDrawer);
    document.getElementById("botSelectorPill").addEventListener("click", openDrawer);
    document.getElementById("moreMenuBtn").addEventListener("click", openDrawer);
    document.getElementById("closeDrawerBtn").addEventListener("click", closeDrawer);
    drawerBackdrop.addEventListener("click", (e) => {
      if (e.target === drawerBackdrop) closeDrawer();
    });

    document.getElementById("plusPromptBtn").addEventListener("click", () => {
      quickDrawerBackdrop.classList.add("open");
    });
    document.getElementById("closeQuickDrawerBtn").addEventListener("click", () => {
      quickDrawerBackdrop.classList.remove("open");
    });
    quickDrawerBackdrop.addEventListener("click", (e) => {
      if (e.target === quickDrawerBackdrop) quickDrawerBackdrop.classList.remove("open");
    });
    document.querySelectorAll(".quick-action-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        quickDrawerBackdrop.classList.remove("open");
        sendMessageToBot(btn.getAttribute("data-prompt"));
      });
    });

    function selectBot(bot) {
      activeBotId = bot.id;
      activeBotNameEl.textContent = bot.shortName || bot.name;
      activeBotBeanWrap.innerHTML = renderBeanSvg(bot.color || "#10b981", bot.shape || "bean", 28);
      chatInput.placeholder = \`Ask \${bot.shortName || bot.name}...\`;
      closeDrawer();
      renderBotList();
    }

    function renderBotList() {
      botListContainer.innerHTML = "";
      for (const b of bots) {
        const item = document.createElement("div");
        item.className = "bot-list-item" + (b.id === activeBotId ? " active" : "");
        item.innerHTML = \`
          <div style="flex-shrink:0">\${renderBeanSvg(b.color || "#10b981", b.shape || "bean", 32)}</div>
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
              <div style="padding:10px;background:var(--bubble-bg);border-radius:12px;margin-bottom:6px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:700;">🧪 \${d.name} (<code>\${d.id}</code>)</div>
                  <div style="font-size:12px;margin-top:2px;color:var(--muted)">\${d.description}</div>
                </div>
                <button onclick="promoteDraftSkill('\${d.id}')" style="background:#10b981;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">✅ Duyệt</button>
              </div>
            \`,
            )
            .join("");
        }

        if (!initializedGreeting) {
          initializedGreeting = true;
          const skills = data.activeSkills || [];
          const toolsCount = data.toolsCount || 0;
          const st = data.stats30d || { totalThreads: 0, totalTurns: 0 };

          const top3Skills = skills.slice(0, 3);
          const badgeItems = top3Skills.map((s, idx) => ({
            botId: s.id,
            botName: s.name,
            color: ["#ef4444", "#10b981", "#ec4899"][idx % 3],
            shape: ["tri", "bean", "hex"][idx % 3],
            summary: (s.description || "").slice(0, 110),
          }));

          const tableRows = skills
            .slice(0, 5)
            .map((s) => \`| \${s.name} | \${(s.description || "").slice(0, 72)}... |\`)
            .join("\\n");

          appendAssistantTurn({
            voiceSec: 36,
            botBadges: badgeItems,
            files: [
              {
                fileName: "vbaibot-radar-he-thong.html",
                downloadUrl: "/radar",
                viewUrl: "/radar",
                ext: ".html",
                sizeLabel: "460 KB",
              },
            ],
            reply:
              \`Hệ thống **VBAIBot** đang vận hành **\${skills.length} kỹ năng thực tế** trong thư mục **.agents/skills** cùng **\${toolsCount} công cụ** (\${st.totalTurns} lượt xử lý trên \${st.totalThreads} phiên trong 30 ngày qua).\\n\\n\` +
              \`**Bảng phân công Kỹ năng hệ thống**\\n\` +
              \`| Kỹ năng | Nhiệm vụ chuyên trách |\\n\` +
              \`|---|---|\\n\` +
              \`\${tableRows}\\n\\n\` +
              \`Dashboard dữ liệu thực của hệ thống đã sẵn sàng tại [vbaibot.chauphienbanso.com/radar](/radar).\\n\` +
              \`[A] Tra cứu thẩm quyền hành chính & soạn văn bản chuẩn Nghị định 30/2020/NĐ-CP\\n\` +
              \`[B] Rà soát văn bản hành chính & đối chiếu căn cứ pháp lý (legalkit-vn)\\n\` +
              \`[C] Tư vấn kế toán Thông tư 99/2025/TT-BTC, thuế & ngân hàng\\n\` +
              \`[D] Giao Xưởng Skill thiết kế & chạy thử kỹ năng mới trong Sandbox\`,
          });

          const qPrompt = new URLSearchParams(window.location.search).get("prompt");
          if (qPrompt && qPrompt.trim()) {
            setTimeout(() => sendMessageToBot(qPrompt.trim()), 400);
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }

    async function promoteDraftSkill(skillId) {
      try {
        const res = await fetch("/api/public/sep/promote-skill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId }),
        });
        const data = await res.json();
        if (data.ok) {
          await loadBotsAndSkills();
          closeDrawer();
          appendAssistantTurn({
            reply: \`✅ Đã duyệt và kích hoạt chính thức kỹ năng **\${skillId}** vào thư mục **.agents/skills/\${skillId}/SKILL.md**. Hiện tất cả các Bot trên hệ thống và Zalo đều đã sử dụng được ngay!\`,
          });
        } else {
          alert(data.error || "Không thể duyệt skill");
        }
      } catch (err) {
        alert("Lỗi kết nối khi duyệt skill");
      }
    }

    loadBotsAndSkills();
  </script>
</body>
</html>`;
}
