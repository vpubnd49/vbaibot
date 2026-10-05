import paramiko
import sys
import io

HOST = "103.142.25.252"
USER = "root"
PASS = "Chau@2026#LD"

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=20)

hermes_conf = """server {
    listen 80;
    listen [::]:80;
    server_name chauphienbanso.com www.chauphienbanso.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:9119;
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

print("=== 1. UPLOADING NGINX CONFIG FOR chauphienbanso.com ===")
sftp = ssh.open_sftp()
sftp.putfo(io.BytesIO(hermes_conf.encode('utf-8')), "/etc/nginx/sites-available/chauphienbanso.com")
sftp.close()

cmds = """
set -e
ln -sf /etc/nginx/sites-available/chauphienbanso.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

echo "=== 2. REQUESTING SSL CERTIFICATE FOR chauphienbanso.com ==="
certbot --nginx -d chauphienbanso.com -d www.chauphienbanso.com --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo "=== 3. RELOADING NGINX ==="
nginx -t
systemctl reload nginx

echo "=== 4. TESTING HTTPS TO chauphienbanso.com ==="
curl -I -k https://127.0.0.1/skills?profile=default -H "Host: chauphienbanso.com"
"""

stdin, stdout, stderr = ssh.exec_command(cmds)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print(out)
if err:
    print("STDERR:\n", err)

ssh.close()
