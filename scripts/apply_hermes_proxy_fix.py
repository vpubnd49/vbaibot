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

config = """map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    server_name chauphienbanso.com www.chauphienbanso.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:9119;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host 127.0.0.1:9119;
        proxy_set_header Origin "http://127.0.0.1:9119";
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/chauphienbanso.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/chauphienbanso.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.chauphienbanso.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = chauphienbanso.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;
    server_name chauphienbanso.com www.chauphienbanso.com;
    return 301 https://$host$request_uri;
}
"""

sftp = ssh.open_sftp()
sftp.putfo(io.BytesIO(config.encode('utf-8')), "/etc/nginx/sites-available/chauphienbanso.com")
sftp.close()

cmds = """
nginx -t
systemctl reload nginx
"""
stdin, stdout, stderr = ssh.exec_command(cmds)
print(stdout.read().decode('utf-8', errors='replace'))
print('STDERR:', stderr.read().decode('utf-8', errors='replace'))
ssh.close()
