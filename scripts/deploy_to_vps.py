import paramiko
import sys
import time

HOST = "103.142.25.252"
USER = "root"
# Không ghi mật khẩu vào repo: mặc định đăng nhập bằng SSH key (~/.ssh/id_ed25519);
# cần mật khẩu thì đặt biến môi trường VPS_PASSWORD.
PASS = __import__("os").environ.get("VPS_PASSWORD")

cmd = """bash -c '
set -e
echo "=== 1. PULL LATEST REPO ON VPS ==="
cd /var/www/vbaibot
git pull origin main

echo "=== 2. BUILD TYPESCRIPT ==="
pnpm run build

echo "=== 3. RELOAD PM2 ==="
pm2 reload vbaibot --update-env

echo "=== 4. SYNC TO HERMES SKILLS ==="
mkdir -p /root/.hermes/skills/vietnam-administrative/soan-thao-vb-nd30/references
cp -r /var/www/vbaibot/.agents/skills/soan-thao-vb-nd30/* /root/.hermes/skills/vietnam-administrative/soan-thao-vb-nd30/
ls -lh /root/.hermes/skills/vietnam-administrative/soan-thao-vb-nd30/references/toan_bo_27_mau_noi_chinh.md

echo "=== 5. PM2 STATUS ==="
pm2 status vbaibot
'"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Connecting to {HOST}...")
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    print("Connected. Executing deployment...")
    stdin, stdout, stderr = client.exec_command(cmd)
    
    for line in iter(stdout.readline, ""):
        print(line, end="")
    for line in iter(stderr.readline, ""):
        print("ERR:", line, end="", file=sys.stderr)
        
    exit_status = stdout.channel.recv_exit_status()
    print(f"Finished with exit status: {exit_status}")
    client.close()
    sys.exit(exit_status)
except Exception as e:
    print(f"SSH Exception: {e}", file=sys.stderr)
    sys.exit(1)
