param([string]$Message = "Agent updated via Antigravity")

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  নিবেদিকা এজেন্ট - আপডেট হচ্ছে..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Set-Location "d:\google antigravity\Nibedika whatsapp agent"

$changes = git status --porcelain
if (-not $changes) {
    Write-Host "কোনো পরিবর্তন নেই।" -ForegroundColor Yellow
    exit 0
}

Write-Host "পরিবর্তিত ফাইল:" -ForegroundColor White
git status --short

git add .
git commit -m "[$Timestamp] $Message"
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  সফলভাবে আপডেট হয়েছে!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "Railway এখন নতুন version deploy করছে (2-5 min)" -ForegroundColor White
    Write-Host "Dashboard: https://railway.app/dashboard" -ForegroundColor Cyan
} else {
    Write-Host "Push সমস্যা হয়েছে!" -ForegroundColor Red
}
