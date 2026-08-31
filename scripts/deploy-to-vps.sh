#!/bin/bash
# ==============================================================================
# Script triển khai Zaloagent lên VPS Ubuntu/Debian với tên miền vbaibot.chauphienbanso.com
# ==============================================================================

set -e

DOMAIN="${DOMAIN:?Set DOMAIN before deploying}"
APP_DIR="${APP_DIR:-/var/www/zaloagent}"
PORT="${DASHBOARD_PORT:-3900}"
CREDENTIALS_ENCRYPTION_KEY="${CREDENTIALS_ENCRYPTION_KEY:?Set CREDENTIALS_ENCRYPTION_KEY before deploying}"
DASHBOARD_PASSWORD="${DASHBOARD_PASSWORD:?Set DASHBOARD_PASSWORD before deploying}"

echo "=== 1. Cập nhật hệ thống & Cài đặt Nginx, Certbot, Node.js ==="
sudo apt-get update -y
sudo apt-get install -y git curl nginx certbot python3-certbot-nginx build-essential

# Cài đặt Node.js 22.x nếu chưa có
if ! command -v node &> /dev/null || [[ "$(node -v)" < "v22" ]]; then
    echo "=== Cài đặt Node.js 22.x LTS ==="
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Cài đặt pnpm và PM2
sudo corepack enable || true
sudo npm install -g pnpm pm2 --force

echo "=== 2. Thiết lập thư mục ứng dụng tại $APP_DIR ==="
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
mkdir -p "$APP_DIR"

cd "$APP_DIR"

echo "=== 3. Cài đặt dependencies và Build Web UI ==="
pnpm install
pnpm build:web

echo "=== 4. Cấu hình file .env trên VPS ==="
if [ ! -f "$APP_DIR/.env" ]; then
    cat > "$APP_DIR/.env" << 'EOF'
NODE_ENV=production
DATA_DIR=./data

LOG_LEVEL=info
LOG_FILE_ENABLED=true
LOG_FILE_KEEP_DAYS=14

DASHBOARD_PORT=$PORT
DASHBOARD_BEHIND_PROXY=true

CREDENTIALS_ENCRYPTION_KEY=$CREDENTIALS_ENCRYPTION_KEY
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD
EOF
    echo "Đã tạo file .env mới trên VPS."
fi

echo "=== 5. Cấu hình Nginx Reverse Proxy cho $DOMAIN ==="
NGINX_CONF="/etc/nginx/sites-available/zaloagent"

sudo bash -c "cat > $NGINX_CONF" << EOF
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
EOF

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Tự động cấp phát chứng chỉ SSL HTTPS miễn phí Let's Encrypt
echo "=== 6. Cấp phát SSL HTTPS qua Certbot ==="
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || echo "Bỏ qua certbot nếu DNS chưa trỏ về IP VPS"

echo "=== 7. Khởi chạy Zaloagent với PM2 ==="
pm2 delete vbaibot 2>/dev/null || true
pm2 start ecosystem.config.cjs --env production
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME || true

echo "======================================================================"
echo "🎉 ZALOAGENT ĐÃ ĐƯỢC TRIỂN KHAI THÀNH CÔNG LÊN VPS!"
echo "📍 Domain: https://$DOMAIN (hoặc http://$DOMAIN)"
echo "📍 Dashboard Port nội bộ: $PORT"
echo "======================================================================"
