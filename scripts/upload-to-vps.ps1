# Script day source code Zaloagent len VPS 202.92.7.138:24700

param (
    [string]$VpsHost = "202.92.7.138",
    [int]$VpsPort = 24700,
    [string]$VpsUser = "root",
    [string]$RemoteDir = "/var/www/zaloagent"
)

Write-Host "=== 1. Tao thu muc tren VPS ===" -ForegroundColor Cyan
ssh -p $VpsPort "$VpsUser@$VpsHost" "mkdir -p $RemoteDir"

Write-Host "=== 2. Dong bo source code len VPS ===" -ForegroundColor Cyan
scp -P $VpsPort -r package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json ecosystem.config.cjs src scripts web "$VpsUser@${VpsHost}:$RemoteDir/"

Write-Host "=== 3. Chuyen doi dinh dang Unix cho deploy script ===" -ForegroundColor Cyan
ssh -p $VpsPort "$VpsUser@$VpsHost" "sed -i 's/\r$//' $RemoteDir/scripts/deploy-to-vps.sh && chmod +x $RemoteDir/scripts/deploy-to-vps.sh"

Write-Host "=== 4. Thuc thi script deploy tren VPS ===" -ForegroundColor Cyan
ssh -p $VpsPort "$VpsUser@$VpsHost" "cd $RemoteDir && set -a && . ./.env && set +a && export DOMAIN=\"vbaibot.chauphienbanso.com\" && bash scripts/deploy-to-vps.sh"

Write-Host "=== 5. Khoi dong lai ung dung (du lieu VPS duoc giu nguyen) ===" -ForegroundColor Cyan
ssh -p $VpsPort "$VpsUser@$VpsHost" "pm2 restart vbaibot"

Write-Host "HOAN TAT TRIEN KHAI LEN VPS!" -ForegroundColor Green
Write-Host "Truy cap Dashboard tai: https://vbaibot.chauphienbanso.com" -ForegroundColor Yellow
