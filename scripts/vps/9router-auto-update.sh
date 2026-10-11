#!/usr/bin/env bash
# Tự cập nhật 9router (Docker) trên VPS từ gói npm chính thức.
# Cron: 0 3 * * *  /opt/9router-build/auto-update.sh >> /var/log/9router-auto-update.log 2>&1
#
# Luồng: so bản npm mới nhất với bản đang chạy -> build image -> chạy thử trên
# BẢN SAO dữ liệu (cổng phụ, chỉ 127.0.0.1) -> gọi thật /v1/models + chat bằng
# API key của bot -> đạt mới sao lưu + chuyển container chính; không đạt thì giữ
# nguyên bản đang chạy. Kết quả ghi ra STATUS_FILE để bot báo Zalo cho Admin.
#   --force   build lại kể cả khi đã là bản mới nhất (dùng để thử script)
set -uo pipefail

NAME=9router
DATA=/root/.9router
BUILD_DIR=/opt/9router-build
STATUS_FILE=/var/www/vbaibot/data/9router-update.json
TEST_NAME=9router-autotest
TEST_DATA=/tmp/9r-autotest
LOCK=/tmp/9router-auto-update.lock
FORCE=${1:-}

exec 9>"$LOCK"; flock -n 9 || { echo "Đang có tiến trình cập nhật khác"; exit 0; }
log() { echo "[$(date '+%F %T')] $*"; }

write_status() { # action current latest [from] [error]
  python3 - "$@" <<'EOF'
import json, sys, datetime
a = sys.argv[1:] + ["", ""]
d = {"checkedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
     "action": a[0], "current": a[1], "latest": a[2]}
if a[3]: d["from"] = a[3]
if a[4]: d["error"] = a[4][:300]
open("/var/www/vbaibot/data/9router-update.json.tmp", "w").write(json.dumps(d, ensure_ascii=False))
EOF
  mv -f "${STATUS_FILE}.tmp" "$STATUS_FILE"
}

current_version() { curl -s -m 10 http://127.0.0.1:20128/api/version | python3 -c "import sys,json;print(json.load(sys.stdin)['currentVersion'])" 2>/dev/null; }
api_key() { sqlite3 "$1/db/data.sqlite" "SELECT key FROM apiKeys WHERE isActive=1 LIMIT 1" 2>/dev/null; }

smoke() { # port datadir -> 0 nếu đạt
  local port=$1 key; key=$(api_key "$2")
  [ -n "$key" ] || { echo "không đọc được API key"; return 1; }
  local code; code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -H "Authorization: Bearer $key" "http://127.0.0.1:$port/v1/models")
  [ "$code" = 200 ] || { echo "/v1/models HTTP $code"; return 1; }
  local reply; reply=$(curl -s -m 120 "http://127.0.0.1:$port/v1/chat/completions" -H "Authorization: Bearer $key" \
    -H 'Content-Type: application/json' \
    -d '{"model":"smart-pool","stream":false,"messages":[{"role":"user","content":"Reply with one word: OK"}],"max_tokens":200}' \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['choices'][0]['message'].get('content','').strip())" 2>/dev/null)
  [ -n "$reply" ] || { echo "chat smart-pool không trả lời"; return 1; }
  return 0
}

CUR=$(current_version)
LATEST=$(npm view 9router version --prefer-online 2>/dev/null | tail -1)
log "Đang chạy: ${CUR:-?} | npm mới nhất: ${LATEST:-?}"
if [ -z "$LATEST" ]; then write_status failed "${CUR:-?}" "?" "" "Không lấy được phiên bản từ npm"; exit 1; fi
if [ -n "$CUR" ] && [ "$CUR" = "$LATEST" ] && [ "$FORCE" != "--force" ]; then
  write_status none "$CUR" "$LATEST"; log "Đã là bản mới nhất"; exit 0
fi

fail() { log "THẤT BẠI: $1"; docker rm -f "$TEST_NAME" >/dev/null 2>&1; rm -rf "$TEST_DATA"; write_status failed "${CUR:-?}" "$LATEST" "" "$1"; exit 1; }

log "Build image local/9router:$LATEST"
docker build -q -t "local/9router:$LATEST" --build-arg NR_VERSION="$LATEST" "$BUILD_DIR" >/dev/null || fail "docker build lỗi"

ENVF=$(ls -t /root/.9router-env-* 2>/dev/null | head -1)
[ -n "$ENVF" ] || fail "thiếu file env của container"

PORT=$(for p in 29128 29228 29328 29428; do ss -ltn | grep -q ":$p " || { echo $p; break; }; done)
[ -n "$PORT" ] || fail "không có cổng thử trống"
docker rm -f "$TEST_NAME" >/dev/null 2>&1; rm -rf "$TEST_DATA"; cp -a "$DATA" "$TEST_DATA"
docker run -d --name "$TEST_NAME" -p "127.0.0.1:$PORT:20128" -v "$TEST_DATA:/app/data" --env-file "$ENVF" "local/9router:$LATEST" >/dev/null || fail "không chạy được container thử"
for i in $(seq 1 45); do curl -sf "http://127.0.0.1:$PORT/api/version" >/dev/null && break; sleep 2; done
ERR=$(smoke "$PORT" "$TEST_DATA") || fail "kiểm thử bản sao: $ERR"
docker rm -f "$TEST_NAME" >/dev/null; rm -rf "$TEST_DATA"
log "Kiểm thử bản sao đạt, chuyển container chính"

TS=$(date +%Y%m%d-%H%M%S)
OLD_IMAGE=$(docker inspect "$NAME" --format '{{.Config.Image}}' 2>/dev/null)
docker stop "$NAME" >/dev/null
tar czf "/root/backups/9router-data-pre-$LATEST-$TS.tgz" -C /root .9router
docker rename "$NAME" "$NAME-old" >/dev/null
# Chỉ mở trên 127.0.0.1 (bot gọi 127.0.0.1; Admin vào dashboard qua `tailscale serve`)
docker run -d --name "$NAME" --restart unless-stopped -p "${NR_BIND:-127.0.0.1}:20128:20128" -v "$DATA:/app/data" \
  --env-file "$ENVF" --memory 2g "local/9router:$LATEST" >/dev/null
for i in $(seq 1 45); do curl -sf http://127.0.0.1:20128/api/version >/dev/null && break; sleep 2; done

if ERR=$(smoke 20128 "$DATA"); then
  docker rm "$NAME-old" >/dev/null
  write_status updated "$LATEST" "$LATEST" "${CUR:-?}"
  log "Thành công: ${CUR:-?} -> $LATEST (backup /root/backups/9router-data-pre-$LATEST-$TS.tgz)"
  # Giữ 3 image local gần nhất + image rollback gốc
  docker images 'local/9router' --format '{{.Tag}}' | sort -V | head -n -3 | xargs -r -I{} docker rmi "local/9router:{}" >/dev/null 2>&1
  ls -t /root/backups/9router-data-pre-*.tgz 2>/dev/null | tail -n +6 | xargs -r rm -f
  exit 0
fi

log "Bản chính không đạt ($ERR) -> QUAY VỀ $OLD_IMAGE"
docker rm -f "$NAME" >/dev/null
rm -rf "$DATA" && mkdir -p "$DATA" && tar xzf "/root/backups/9router-data-pre-$LATEST-$TS.tgz" -C /root
docker rename "$NAME-old" "$NAME" && docker start "$NAME" >/dev/null
write_status failed "${CUR:-?}" "$LATEST" "" "bản chính sau khi chuyển: $ERR (đã quay về bản cũ)"
exit 1
