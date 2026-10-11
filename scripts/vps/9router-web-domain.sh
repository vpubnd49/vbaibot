#!/bin/bash
# Mở trang quản trị 9router qua https://9router.chauphienbanso.com (Caddy tự cấp
# HTTPS) có thêm lớp mật khẩu Basic Auth trước trang đăng nhập 9router.
# 9router vẫn chỉ nghe 127.0.0.1:20128 - không mở lại cổng ra Internet.
set -euo pipefail
CF=/opt/hermes/Caddyfile
DOMAIN_9R=9router.chauphienbanso.com
CRED=/root/9router-web-credentials.txt

if grep -q "$DOMAIN_9R" "$CF"; then echo "Đã có cấu hình $DOMAIN_9R"; exit 0; fi

PASS=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 16)
HASH=$(caddy hash-password --plaintext "$PASS")
cp "$CF" "$CF.bak.pre-9router"

cat >> "$CF" <<EOF

$DOMAIN_9R {
	encode gzip zstd
	basic_auth {
		admin $HASH
	}
	header {
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}
	reverse_proxy 127.0.0.1:20128 {
		flush_interval -1
		transport http {
			read_timeout 300s
		}
	}
}
EOF

set -a; . /opt/hermes/.env; set +a
if ! caddy validate --config "$CF" --adapter caddyfile >/tmp/caddy-validate.log 2>&1; then
  echo "Cấu hình lỗi - hoàn tác"; tail -5 /tmp/caddy-validate.log
  cp "$CF.bak.pre-9router" "$CF"; exit 1
fi
systemctl restart caddy
sleep 3
systemctl is-active caddy || { cp "$CF.bak.pre-9router" "$CF"; systemctl restart caddy; echo "Caddy không lên - đã hoàn tác"; exit 1; }

printf 'URL: https://%s/dashboard\nUser: admin\nPass: %s\n' "$DOMAIN_9R" "$PASS" > "$CRED"
chmod 600 "$CRED"
cat "$CRED"
