# ============================================================
# প্রথমবার সেটআপ স্ক্রিপ্ট - GitHub Token কনফিগার
# ============================================================
# প্রথমবার শুধু একবার চালান: .\setup.ps1
# ============================================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  নিবেদিকা এজেন্ট - GitHub সেটআপ" -ForegroundColor Cyan  
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "এই স্ক্রিপ্ট GitHub Token সেটআপ করবে যাতে" -ForegroundColor White
Write-Host "পরবর্তীতে এক কমান্ডে deploy করা যায়।" -ForegroundColor White
Write-Host ""

# Step 1: GitHub Username
$githubUsername = Read-Host "👤 আপনার GitHub Username লিখুন"

# Step 2: GitHub Token
Write-Host ""
Write-Host "🔑 GitHub Personal Access Token লাগবে।" -ForegroundColor Yellow
Write-Host ""
Write-Host "Token তৈরি করতে:" -ForegroundColor White
Write-Host "  1. https://github.com/settings/tokens/new এ যান" -ForegroundColor Cyan
Write-Host "  2. Note: 'Nibedika Agent Deploy'" -ForegroundColor Cyan
Write-Host "  3. Expiration: No expiration" -ForegroundColor Cyan
Write-Host "  4. Scopes: repo (সম্পূর্ণ চেক করুন)" -ForegroundColor Cyan
Write-Host "  5. Generate token চাপুন" -ForegroundColor Cyan
Write-Host "  6. Token কপি করুন (ghp_xxxx...)" -ForegroundColor Cyan
Write-Host ""

$githubToken = Read-Host "🔑 Token এখানে paste করুন" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($githubToken)
$tokenPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Step 3: Repository Name
Write-Host ""
$repoName = Read-Host "📁 GitHub Repository নাম লিখুন (যেমন: nibedika-agent)"

# Configure git credentials
Write-Host ""
Write-Host "⚙️  Git credentials কনফিগার করা হচ্ছে..." -ForegroundColor Green

$ProjectDir = "d:\google antigravity\Nibedika whatsapp agent"
Set-Location $ProjectDir

git config user.email "nibedika@hostel.com"
git config user.name "Nibedika Hostel"

# Set remote URL with token
$remoteUrl = "https://${githubUsername}:${tokenPlain}@github.com/${githubUsername}/${repoName}.git"
git remote remove origin 2>$null
git remote add origin $remoteUrl

# Save config to .env.deploy (not tracked by git)
$deployConfig = @"
GITHUB_USERNAME=$githubUsername
GITHUB_REPO=$repoName
REMOTE_URL=$remoteUrl
"@
$deployConfig | Out-File -FilePath ".env.deploy" -Encoding UTF8

Write-Host ""
Write-Host "✅ সেটআপ সম্পন্ন!" -ForegroundColor Green
Write-Host ""
Write-Host "এখন যেকোনো সময় আপডেট করতে:" -ForegroundColor White
Write-Host "  .\deploy.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "কাস্টম মেসেজ সহ:" -ForegroundColor White
Write-Host '  .\deploy.ps1 "ভাড়া তালিকা আপডেট"' -ForegroundColor Cyan
Write-Host ""

# Test push
$testPush = Read-Host "🧪 এখনই test push করবেন? (y/n)"
if ($testPush -eq 'y' -or $testPush -eq 'Y') {
    Write-Host ""
    Write-Host "🚀 Test push করা হচ্ছে..." -ForegroundColor Green
    git push -u origin master --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Test push সফল! GitHub এ code আপলোড হয়েছে।" -ForegroundColor Green
    } else {
        Write-Host "❌ Push সমস্যা। Token ও repository নাম ঠিক আছে কিনা দেখুন।" -ForegroundColor Red
    }
}
