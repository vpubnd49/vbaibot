#!/bin/bash
# Sao lưu hằng ngày phiên Google NotebookLM (/root/.notebooklm) - mất là phải đăng nhập lại
cat > /etc/cron.daily/notebooklm-backup <<'EOF'
#!/bin/sh
mkdir -p /root/backups
tar czf /root/backups/notebooklm-$(date +%Y%m%d).tgz -C /root .notebooklm --exclude='.notebooklm/chrome_profile_instances' 2>/dev/null
find /root/backups -name 'notebooklm-*.tgz' -mtime +7 -delete
EOF
chmod +x /etc/cron.daily/notebooklm-backup
/etc/cron.daily/notebooklm-backup && ls -la /root/backups/notebooklm-*.tgz
