#!/bin/bash
# ==============================================================================
# Script triển khai Zaloagent lên VPS Ubuntu/Debian với tên miền vbaibot.chauphienbanso.com
# ==============================================================================

set -e

DOMAIN="${DOMAIN:?Set DOMAIN before deploying}"
APP_DIR="${APP_DIR:-/var/www/vbaibot}"
PORT="${DASHBOARD_PORT:-3900}"
CREDENTIALS_ENCRYPTION_KEY="${CREDENTIALS_ENCRYPTION_KEY:?Set CREDENTIALS_ENCRYPTION_KEY before deploying}"
DASHBOARD_PASSWORD="${DASHBOARD_PASSWORD:?Set DASHBOARD_PASSWORD before deploying}"

echo "=== 1. Kiểm tra hệ thống & dependency deploy ==="
# Không chạy apt mỗi lần deploy nếu các công cụ đã có. Việc apt-get install
# luôn gọi dpkg --configure -a; trên VPS có thể có kernel pending bị lỗi
# initramfs-tools và làm deploy ứng dụng thất bại dù app không cần kernel mới.
REQUIRED_COMMANDS=(git curl nginx certbot node npm)
MISSING_COMMANDS=()
for command_name in "${REQUIRED_COMMANDS[@]}"; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        MISSING_COMMANDS+=("$command_name")
    fi
done

if [ "${#MISSING_COMMANDS[@]}" -gt 0 ]; then
    echo "Thiếu dependency: ${MISSING_COMMANDS[*]}. Tiến hành cài đặt qua apt."
    sudo apt-get update -y
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git curl nginx certbot python3-certbot-nginx build-essential nodejs npm
else
    echo "Các dependency hệ thống đã sẵn sàng; bỏ qua apt-get để không kích hoạt kernel pending."
fi

# Cài đặt Node.js 22.x nếu chưa có hoặc thấp hơn major 22
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v22.* && "$(node -v)" != v23.* && "$(node -v)" != v24.* ]]; then
    echo "=== Cài đặt Node.js 22.x LTS ==="
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

if dpkg --audit 2>/dev/null | grep -q .; then
    echo "CẢNH BÁO: VPS còn package pending (thường là linux-image/initramfs-tools)."
    echo "Bỏ qua sửa kernel trong deploy ứng dụng; cần xử lý riêng khi có maintenance window."
fi

# Cài đặt pnpm và PM2
sudo corepack enable || true
sudo npm install -g pnpm pm2 --force

echo "=== 2. Thiết lập thư mục ứng dụng tại $APP_DIR ==="
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
mkdir -p "$APP_DIR"

cd "$APP_DIR"

echo "=== 3. Cài đặt dependencies, Build TypeScript và Web UI ==="
pnpm install
pnpm build
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
