# deploy_1click.ps1 - 1-Click Automated PowerShell Deployer for Cloudflare Workers AI Gateway
# Powered by https://ziploot.app

# Set execution policy for current process
try { Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force -ErrorAction SilentlyContinue } catch {}

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ⚡ Cloudflare Workers AI 1-Click Automated Deployer     " -ForegroundColor Cyan
Write-Host "  Powered by https://ziploot.app                           " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check & Auto-Install Node.js / npm
Write-Host "`n[1/4] Checking Node.js environment..." -NoNewline
$hasNode = $false
try {
    $nodeVer = cmd /c "node --version" 2>&1
    if ($nodeVer -like "v*") {
        Write-Host " [FOUND: $nodeVer]" -ForegroundColor Green
        $hasNode = $true
    }
} catch {}

if (-not $hasNode) {
    Write-Host " [NOT FOUND]" -ForegroundColor Yellow
    Write-Host "--> Installing Node.js via winget..." -ForegroundColor Cyan
    try {
        winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements | Out-Null
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Host "--> Node.js installed successfully!" -ForegroundColor Green
    } catch {
        Write-Host "--> Please install Node.js manually from https://nodejs.org" -ForegroundColor Red
        Exit 1
    }
}

# 2. Setup Project Workspace Directory with Unique Random Name
$WorkDir = Join-Path $env:TEMP ("cf-ai-gw-" + (Get-Random))
New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null

Write-Host "[2/4] Downloading project repository..." -ForegroundColor Cyan
$downloadSuccess = $false

# Method 1: Try Git Clone if git is available
if (Get-Command git -ErrorAction SilentlyContinue) {
    try {
        & git clone --depth 1 https://github.com/Ziplootapp/cloudflare-workers-ai-free-guide.git $WorkDir 2>&1 | Out-Null
        if (Test-Path (Join-Path $WorkDir "worker.js")) {
            $downloadSuccess = $true
        }
    } catch {}
}

# Method 2: Download Zip from GitHub if Git Clone was not used or failed
if (-not $downloadSuccess) {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $zipUrl = "https://github.com/Ziplootapp/cloudflare-workers-ai-free-guide/archive/refs/heads/main.zip"
        $zipFile = Join-Path $env:TEMP ("repo-" + (Get-Random) + ".zip")
        $extractDir = Join-Path $env:TEMP ("ext-" + (Get-Random))
        
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile -UseBasicParsing
        Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force
        
        $unzippedFolder = Join-Path $extractDir "cloudflare-workers-ai-free-guide-main"
        if (Test-Path $unzippedFolder) {
            Copy-Item -Path "$unzippedFolder\*" -Destination $WorkDir -Recurse -Force
            $downloadSuccess = $true
        }
        
        Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "--> Zip download error: $_" -ForegroundColor Yellow
    }
}

if ($downloadSuccess) {
    Write-Host "--> Repository downloaded successfully!" -ForegroundColor Green
} else {
    Write-Host "--> Failed to download repository. Please check your internet connection." -ForegroundColor Red
    Exit 1
}

# 3. Install Dependencies
Set-Location $WorkDir
Write-Host "[3/4] Preparing Wrangler..." -ForegroundColor Cyan
cmd /c "npm install --no-audit --no-fund" | Out-Null

# 4. Deploy to Cloudflare Workers via cmd.exe to bypass PowerShell npx.ps1 policy
Write-Host "[4/4] Deploying Worker to Cloudflare..." -ForegroundColor Cyan
Write-Host "--> If your browser opens, please click 'Allow' to authorize Cloudflare login.`n" -ForegroundColor Yellow

$deployProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx wrangler deploy" -NoNewWindow -Wait -PassThru

if ($deployProc.ExitCode -eq 0) {
    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host "  🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!                  " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "Visit your Worker URL to access your Cloudflare Workers AI Studio!" -ForegroundColor Yellow
    Write-Host "OpenAI Endpoint: /v1/chat/completions" -ForegroundColor Yellow
    Write-Host "Powered by https://ziploot.app" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
} else {
    Write-Host "`n[!] Notice: If you are not logged in to Cloudflare, please run:" -ForegroundColor Yellow
    Write-Host "    npx wrangler login" -ForegroundColor Cyan
    Write-Host "    npx wrangler deploy" -ForegroundColor Cyan
}
