import os
import sys
import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HOST = "103.142.25.252"
USER = "root"
PASS = os.environ.get("VPS_PASSWORD")

# Danh sách tất cả file đã chỉnh sửa của cả 2 dự án
VBAIBOT_FILES = [
    # Agent & Tools
    "src/agent/action-result-guard.ts",
    "src/agent/file-send-guard.ts",
    "src/agent/persona-tool-routing.ts",
    "src/agent/persona-tool-rules.ts",
    "src/agent/tools/create-admin-document-tool.ts",
    "src/agent/tools/create-document-tools.ts",
    "src/agent/tools/create-text-document-tool.ts",
    "src/agent/tools/create-image-tool-description.ts",
    "src/agent/tools/create-image-tool.ts",
    "src/agent/tools/create-voice-tool.ts",
    "src/agent/tools/document-delivery.ts",
    "src/agent/tools/draw-image-with-one-retry.ts",
    "src/agent/tools/notebooklm-tool.ts",
    "src/agent/tools/recent-image-paths.ts",
    "src/agent/tools/save-memory-tool.ts",
    "src/agent/tools/send-attachment-with-caption.ts",
    "src/agent/tools/tool-registry.ts",
    # Conversation & Zalo
    "src/conversation/media-store.ts",
    "src/zalo/zalo-listener.ts",
    # Config & Documents
    "src/config/env.ts",
    "src/config/runtime-notebooklm-settings.ts",
    "src/documents/admin-document-schema.ts",
    "src/documents/batch-ocr-engine.ts",
    "src/documents/document-content-schema.ts",
    "src/documents/document-reader.ts",
    "src/documents/pptx-content-schema.ts",
    # Images & Voice & Legal & NotebookLM
    "src/images/image-generation-client.ts",
    "src/images/image-retry-policy.ts",
    "src/legal/services/legal-docs-crawler.ts",
    "src/notebooklm/notebooklm-client.ts",
    "src/notebooklm/notebooklm-jobs.ts",
    "src/voice/gemini-tts.ts",
    "src/voice/wav-to-mp3.ts",
    "scripts/sync-vbaibot-legal.cjs",
    # Realtime & Facebook
    "src/realtime/facebook/facebook-browser-scraper.ts",
    "src/realtime/facebook/facebook-session.ts",
    # Server & Routes
    "src/server/dashboard-server.ts",
    "src/server/routes/facebook-routes.ts",
    "src/server/routes/voice-routes.ts",
    "src/server/routes/mcp-routes.ts",
    "src/server/routes/notion-routes.ts",
    "src/server/routes/webchat-routes.ts",
    # Web Dashboard frontend
    "web/src/dashboard-api-client.ts",
    "web/src/facebook-api-client.ts",
    "web/src/pages/facebook-monitor-page.tsx",
    "web/src/pages/facebook-session-modal.tsx",
    "web/src/pages/tools-page.tsx",
    "web/src/pages/mcp-settings-modal.tsx",
    "web/src/pages/notion-settings-modal.tsx",
    # Skills
    ".agents/skills/zalo-agent-notebooklm/SKILL.md",
    ".agents/skills/zalo-agent-notebooklm/references/gemini-notebook-2026-guide.md",
    ".agents/skills/zalo-agent-notebooklm/references/prompts-and-checklists.md",
]

VBAI_FILES = [
    # Webapp
    ("webapp/index.html", "/var/www/vbai/webapp/index.html"),
    ("webapp/style.css", "/var/www/vbai/webapp/style.css"),
    ("webapp/main.js", "/var/www/vbai/webapp/main.js"),
    ("webapp/modules/zalo-bot.js", "/var/www/vbai/webapp/modules/zalo-bot.js"),
    ("webapp/modules/chat-assistant.js", "/var/www/vbai/webapp/modules/chat-assistant.js"),
    ("webapp/modules/admin-panel.js", "/var/www/vbai/webapp/modules/admin-panel.js"),
    ("webapp/modules/legal-search.js", "/var/www/vbai/webapp/modules/legal-search.js"),
    ("webapp/modules/meeting-minutes.js", "/var/www/vbai/webapp/modules/meeting-minutes.js"),
    ("webapp/modules/system-config.js", "/var/www/vbai/webapp/modules/system-config.js"),
    # Proxy backend
    ("proxy/server.js", "/var/www/vbai/proxy/server.js"),
    ("proxy/services/auth.service.js", "/var/www/vbai/proxy/services/auth.service.js"),
    ("proxy/legal/services/legal-search-orchestrator.js", "/var/www/vbai/proxy/legal/services/legal-search-orchestrator.js"),
]

def main():
    print("=" * 65)
    print(f"[*] BAT DAU FULL DEPLOY CA 2 DU AN LEN VPS: {HOST}")
    print("=" * 65)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        if PASS:
            ssh.connect(HOST, username=USER, password=PASS, timeout=20)
        else:
            ssh.connect(HOST, username=USER, timeout=20)
        print("[+] Ket noi SSH toi VPS thanh cong!")
    except Exception as e:
        print(f"[-] Loi ket noi SSH: {e}")
        sys.exit(1)

    sftp = ssh.open_sftp()
    vbaibot_root = r"e:\OneDrive\HSCV\Antigravity\vbaibot"
    vbai_root = r"e:\OneDrive\HSCV\Antigravity\VBAI"

    print("\n--- 1. TAI FILE VBAIBOT LEN VPS ---")
    for rel_path in VBAIBOT_FILES:
        local_path = os.path.normpath(os.path.join(vbaibot_root, rel_path))
        remote_path = f"/var/www/vbaibot/{rel_path}".replace("\\", "/")
        if not os.path.exists(local_path):
            print(f"  [!] Bo qua (khong tim thay file local): {rel_path}")
            continue

        remote_dir = os.path.dirname(remote_path)
        ssh.exec_command(f"mkdir -p '{remote_dir}'")
        sftp.put(local_path, remote_path)
        size = os.path.getsize(local_path)
        print(f"  [OK] {rel_path} ({size} bytes)")

    print("\n--- 2. TAI FILE VBAI (vbai.tracuu.lamdong.vn) LEN VPS ---")
    for rel_path, remote_path in VBAI_FILES:
        local_path = os.path.normpath(os.path.join(vbai_root, rel_path))
        if not os.path.exists(local_path):
            print(f"  [!] Bo qua (khong tim thay file local): {rel_path}")
            continue

        remote_dir = os.path.dirname(remote_path)
        ssh.exec_command(f"mkdir -p '{remote_dir}'")
        sftp.put(local_path, remote_path)
        size = os.path.getsize(local_path)
        print(f"  [OK] {rel_path} -> {remote_path} ({size} bytes)")

    sftp.close()
    print("\n[+] Hoan tat tai len toan bo cac file sua.")

    print("\n--- 3. TIEN HANH BUILD & RELOAD TREN VPS ---")
    build_cmd = """bash -c '
set -e
echo "=== [A] BUILD VA RELOAD VBAIBOT ==="
cd /var/www/vbaibot
pnpm run build
if [ -d "web" ]; then
    echo "Dang build frontend web dashboard..."
    pnpm run build:web 2>/dev/null || true
fi
pm2 reload vbaibot --update-env

echo "=== [B] RELOAD VBAI PROXY ==="
if [ -d "/var/www/vbai/proxy" ]; then
    pm2 reload vbai-proxy --update-env 2>/dev/null || true
fi

echo "=== [C] KIEM TRA TRANG THAI CAC DICH VU PM2 ==="
pm2 status
'"""

    stdin, stdout, stderr = ssh.exec_command(build_cmd)
    for line in iter(stdout.readline, ""):
        print(line, end="")
    for line in iter(stderr.readline, ""):
        print("ERR:", line, end="", file=sys.stderr)

    exit_code = stdout.channel.recv_exit_status()
    ssh.close()

    print("\n" + "=" * 65)
    if exit_code == 0:
        print("[+] THANH CONG: DA DEPLOY TOAN BO FILE MOI LEN VPS!")
        print("    1. VBAIBot : https://vbaibot.chauphienbanso.com")
        print("    2. VBAI Web: https://vbai.tracuu.lamdong.vn/#zalo-bot")
    else:
        print(f"[-] Tien trinh ket thuc voi ma loi: {exit_code}")
    print("=" * 65)

if __name__ == "__main__":
    main()
