import paramiko
import os
import sys

HOST = "103.142.25.252"
USER = "root"
PASS = "Chau@2026#LD"

FILES_TO_UPLOAD = [
    ("src/knowledge/noi-chinh-templates.ts", "/var/www/vbaibot/src/knowledge/noi-chinh-templates.ts"),
    (".agents/skills/soan-thao-vb-nd30/SKILL.md", "/var/www/vbaibot/.agents/skills/soan-thao-vb-nd30/SKILL.md"),
    (".agents/skills/soan-thao-vb-nd30/references/toan_bo_27_mau_noi_chinh.md", "/var/www/vbaibot/.agents/skills/soan-thao-vb-nd30/references/toan_bo_27_mau_noi_chinh.md"),
    (".agents/skills/soan-thao-vb-nd30/references/toan_bo_27_mau_noi_chinh.md", "/root/.hermes/skills/vietnam-administrative/soan-thao-vb-nd30/references/toan_bo_27_mau_noi_chinh.md"),
    (".agents/skills/soan-thao-vb-nd30/SKILL.md", "/root/.hermes/skills/vietnam-administrative/soan-thao-vb-nd30/SKILL.md"),
]

print(f"Connecting to {HOST} via SSH & SFTP...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=20)

sftp = ssh.open_sftp()

for local_path, remote_path in FILES_TO_UPLOAD:
    remote_dir = os.path.dirname(remote_path).replace("\\", "/")
    # ensure remote dir
    ssh.exec_command(f"mkdir -p '{remote_dir}'")
    print(f"Uploading {local_path} -> {remote_path}...")
    sftp.put(local_path, remote_path)
    print(f"Uploaded {local_path} ({os.path.getsize(local_path)} bytes)")

sftp.close()

# Rebuild and reload PM2
cmd = """bash -c '
set -e
echo "=== REBUILDING TYPESCRIPT ON VPS ==="
cd /var/www/vbaibot
pnpm run build

echo "=== RELOADING PM2 ==="
pm2 reload vbaibot --update-env

echo "=== CHECKING PROCESS ==="
pm2 status vbaibot
'"""

stdin, stdout, stderr = ssh.exec_command(cmd)
for line in iter(stdout.readline, ""):
    print(line, end="")
for line in iter(stderr.readline, ""):
    print("ERR:", line, end="", file=sys.stderr)

exit_code = stdout.channel.recv_exit_status()
ssh.close()
print(f"Deployment completed with code {exit_code}")
sys.exit(exit_code)
