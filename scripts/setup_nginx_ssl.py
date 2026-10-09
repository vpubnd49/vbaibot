import paramiko
import sys
import io

HOST = "103.142.25.252"
USER = "root"
# Không ghi mật khẩu vào repo: mặc định đăng nhập bằng SSH key (~/.ssh/id_ed25519);
# cần mật khẩu thì đặt biến môi trường VPS_PASSWORD.
PASS = __import__("os").environ.get("VPS_PASSWORD")

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=20)

nginx_conf = """server {
    listen 80;
    listen [::]:80;
    server_name vbaibot.chauphienbanso.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3900;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
"""

print("=== 1. UPLOADING NGINX CONFIG VIA SFTP ===")
sftp = ssh.open_sftp()
sftp.putfo(io.BytesIO(nginx_conf.encode('utf-8')), "/etc/nginx/sites-available/vbaibot.chauphienbanso.com")
sftp.close()

remote_cmds = """
set -e
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/vbaibot.chauphienbanso.com /etc/nginx/sites-enabled/

echo "=== 2. TESTING NGINX CONFIG ==="
nginx -t

echo "=== 3. STARTING / RESTARTING NGINX ==="
systemctl restart nginx
systemctl enable nginx

echo "=== 4. CHECKING NGINX STATUS ==="
systemctl status nginx --no-pager | head -n 12

echo "=== 5. RUNNING CERTBOT FOR SSL ==="
certbot --nginx -d vbaibot.chauphienbanso.com --non-interactive --agree-tos --register-unsafely-without-email --redirect || echo "Certbot warning"

echo "=== 6. VERIFYING LOCAL HTTPS ==="
curl -I -k https://127.0.0.1/ -H "Host: vbaibot.chauphienbanso.com"
"""

stdin, stdout, stderr = ssh.exec_command(remote_cmds)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print(out)
if err:
    print("STDERR:\n", err)

ssh.close()
