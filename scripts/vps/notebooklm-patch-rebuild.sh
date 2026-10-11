#!/bin/bash
# Vá notebooklm-mcp (v3.2.0) cho vbaibot rồi build lại image + chạy lại container.
# Lỗi gốc: tải infographic/audio/video qua RPC dùng cookie jar CHỈ của host
# notebook.google.com -> link googleusercontent.com trả trang HTML đăng nhập,
# rơi xuống đường trình duyệt (DOM đã đổi, không thấy tab Studio) -> hỏng.
# Vá: tải bằng ctx.request của chính browser context (đủ cookie mọi domain Google).
set -euo pipefail
SRC=/opt/notebooklm-mcp
TAG=notebooklm-mcp:3.2.0-vbaibot
cd "$SRC"

python3 - <<'PY'
import re, sys
p = "src/tools/index.ts"
s = open(p, encoding="utf-8").read()
if "[vbaibot patch]" in s:
    print("patch: đã vá từ trước"); sys.exit(0)
old = "          const { bytes, contentType } = await client.fetchBinary(artifact.mediaUrl);\n"
if old not in s:
    print("patch: KHÔNG tìm thấy đoạn cần vá - upstream đã đổi"); sys.exit(1)
new = """          // [vbaibot patch] Tải qua request của browser context để có đủ cookie
          // .google.com/googleusercontent.com (jar RPC chỉ chứa cookie host notebook).
          let bytes: any;
          let contentType: any;
          {
            const dlCtx = await this.sessionManager.getSharedContextManager().getOrCreateContext();
            const resp = await dlCtx.request.get(artifact.mediaUrl, { maxRedirects: 10, timeout: 180000 });
            bytes = Buffer.from(await resp.body());
            contentType = resp.headers()['content-type'] || '';
            log.info(`  [vbaibot] context download: HTTP ${resp.status()} ${contentType} ${bytes.length} bytes`);
            if (!resp.ok() || String(contentType).includes('text/html')) {
              const r = await client.fetchBinary(artifact.mediaUrl);
              bytes = r.bytes;
              contentType = r.contentType;
            }
          }
"""
s = s.replace(old, new, 1)
open(p, "w", encoding="utf-8").write(s)
print("patch: đã vá download_content")
PY

docker build -q -t "$TAG" . | tail -1
docker rm -f notebooklm >/dev/null 2>&1 || true
# Phiên Google + profile Chrome nằm ở ~/.local/share/notebooklm-mcp (KHÔNG phải
# /data dù có biến NOTEBOOKLM_DATA_DIR) - phải mount thư mục này thì tạo lại
# container mới không mất đăng nhập.
mkdir -p /root/.notebooklm && chown -R 999:996 /root/.notebooklm
docker run -d --name notebooklm --restart unless-stopped \
  -p 127.0.0.1:3000:3000 -p 127.0.0.1:6080:6080 \
  -v /root/.notebooklm:/home/notebooklm/.local/share/notebooklm-mcp \
  -v /var/www/vbaibot/data/notebooklm-inbox:/inbox:ro \
  -v /var/www/vbaibot/data/notebooklm-out:/out \
  -e HEADLESS=true -e STEALTH_ENABLED=true \
  -e NOTEBOOKLM_UI_LOCALE=en -e NOTEBOOKLM_CONTENT_LANGUAGE=vi \
  --memory 1536m --log-opt max-size=10m --log-opt max-file=3 \
  "$TAG"
sleep 25
curl -s -m 10 http://127.0.0.1:3000/health; echo
