# ============================================================
# নিবেদিকা এজেন্ট - এক ক্লিকে আপডেট স্ক্রিপ্ট
# ============================================================
# ব্যবহার: PowerShell খুলে এই কমান্ড দিন:
#   .\deploy.ps1
# অথবা কাস্টম মেসেজ সহ:
#   .\deploy.ps1 "নতুন ভাড়া তালিকা আপডেট"
# ============================================================

param(
    [string]$Message = "Agent updated via Antigravity"
)

$ProjectDir = "d:\google antigravity\Nibedika whatsapp agent"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  নিবেদিকা এজেন্ট - আপডেট হচ্ছে..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Project directory তে যাও
Set-Location $ProjectDir

# Git status চেক করো
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "ℹ️  কোনো পরিবর্তন নেই। Deploy করার কিছু নেই।" -ForegroundColor Yellow
    exit 0
}

Write-Host "📝 পরিবর্তিত ফাইলসমূহ:" -ForegroundColor White
git status --short

Write-Host ""
Write-Host "📦 আপলোড করা হচ্ছে GitHub-এ..." -ForegroundColor Green

# Stage all changes
git add .

# Commit with timestamp
$CommitMsg = "[$Timestamp] $Message"
git commit -m $CommitMsg

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit করতে সমস্যা হয়েছে!" -ForegroundColor Red
    exit 1
}

# Push to GitHub
Write-Host ""
Write-Host "🚀 GitHub-এ Push করা হচ্ছে..." -ForegroundColor Green
git push origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  ✅ সফলভাবে আপডেট হয়েছে!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔄 Railway এখন স্বয়ংক্রিয়ভাবে নতুন version deploy করছে।" -ForegroundColor White
    Write-Host "   সাধারণত ২-৫ মিনিটের মধ্যে সম্পন্ন হবে।" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📊 Railway Dashboard: https://railway.app/dashboard" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Push করতে সমস্যা হয়েছে!" -ForegroundColor Red
    Write-Host "   GitHub credentials ঠিক আছে কিনা দেখুন।" -ForegroundColor Yellow
    Write-Host "   setup.ps1 আবার চালান।" -ForegroundColor Yellow
    exit 1
}
