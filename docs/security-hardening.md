# Sổ Tay Hướng Dẫn Xiết Chặt Bảo Mật & Vận Hành An Ninh (vbaibot)

Tài liệu này quy định các chuẩn mực an ninh bắt buộc khi triển khai và vận hành **vbaibot** trên máy chủ Production (VPS/Cloud/On-Premise).

---

## 1. Phân Quyền Hệ Thống & Tệp Tin (File & Directory Permissions)

Trên máy chủ Linux, tuyệt đối **không chạy bot dưới quyền root**. Tạo một user riêng (ví dụ: `vbaibot` hoặc user `node` trong Docker):

```bash
# 1. Tạo user riêng (nếu chạy trực tiếp không qua Docker)
sudo useradd -m -s /bin/bash vbaibot

# 2. Khóa quyền thư mục dữ liệu nhạy cảm (chỉ user chạy bot mới đọc/ghi được)
chmod 700 /path/to/vbaibot/data
chmod 700 /path/to/vbaibot/data/accounts
chmod 600 /path/to/vbaibot/.env
chmod 600 /path/to/vbaibot/data/zalo-agent.db*

# 3. Đảm bảo quyền sở hữu
chown -R vbaibot:vbaibot /path/to/vbaibot
```

---

## 2. Quản Lý Khóa Bí Mật & Mã Hóa (Secret Management)

1. **`CREDENTIALS_ENCRYPTION_KEY`**:
   - Đây là khóa AES-256-GCM 64 ký tự hex dùng để mã hóa thông tin đăng nhập Zalo (`credentials.enc`).
   - Tạo khóa ngẫu nhiên chuẩn mật mã:
     ```bash
     node -e "console.log(crypto.randomBytes(32).toString('hex'))"
     ```
   - **Tuyệt đối không commit file `.env` lên Git**.

2. **`DASHBOARD_PASSWORD`**:
   - Mật khẩu truy cập Web Dashboard.
   - Bắt buộc đặt mật khẩu mạnh (tối thiểu 12 ký tự gồm chữ hoa, chữ thường, số và ký tự đặc biệt).

3. **`DASHBOARD_BEHIND_PROXY=true`**:
   - Bắt buộc bật `true` khi triển khai phía sau Nginx/Cloudflare HTTPS để bật cookie `Secure` + `SameSite=Lax`.

---

## 3. Tường Lửa Máy Chủ (Host Firewall Hardening)

Chỉ mở các cổng tối thiểu cần thiết:

```bash
# Cài đặt và cấu hình UFW (Ubuntu/Debian)
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Chỉ mở SSH (nên đổi cổng mặc định 22)
sudo ufw allow 22/tcp

# Chỉ mở HTTP và HTTPS cho Nginx
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Tuyệt đối KHÔNG mở cổng 3000 ra ngoài Internet (chỉ bind localhost 127.0.0.1)
sudo ufw enable
```

---

## 4. Phương Thức Triển Khai Docker An Ninh Cao

```bash
# 1. Clone source và chuẩn bị file .env
cp .env.example .env
nano .env # Điền các khóa bảo mật và API keys

# 2. Khởi động qua Docker Compose
docker compose up -d --build

# 3. Kiểm tra log
docker compose logs -f vbaibot
```

---

## 5. Quy Trình Sao Lưu Dữ Liệu An Toàn (Encrypted Backup)

Dữ liệu quan trọng nhất cần sao lưu định kỳ:
- `data/zalo-agent.db` (Cơ sở dữ liệu SQLite)
- `data/accounts/` (Thư mục tài khoản đã mã hóa)

Script sao lưu mã hóa mẫu với GPG:
```bash
#!/bin/bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/vbaibot"
mkdir -p $BACKUP_DIR

# Sao lưu và nén
tar -czf - /path/to/vbaibot/data | gpg --symmetric --cipher-algo AES256 -o $BACKUP_DIR/backup_$BACKUP_DATE.tar.gz.gpg

# Xóa các bản sao lưu cũ hơn 30 ngày
find $BACKUP_DIR -name "*.gpg" -type f -mtime +30 -delete
```

---

## 6. Danh Mục Kiểm Tra An Ninh Định Kỳ (Security Checklist)

- [ ] `.env` không nằm trong Git tracking (`git status` sạch sẽ).
- [ ] Dashboard chạy trên HTTPS với chứng chỉ SSL hợp lệ.
- [ ] User chạy tiến trình là non-root.
- [ ] Cổng 3000 không mở trực tiếp ra public Internet.
- [ ] Nginx đã bật rate limit cho `/api/auth/login`.
- [ ] File log trong `data/logs/` không bị lộ ra web.
- [ ] Khóa `CREDENTIALS_ENCRYPTION_KEY` được lưu giữ ở nơi an toàn.
