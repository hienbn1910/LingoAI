<#
.SYNOPSIS
    Cai dat tu dong moi truong de chay LingoAI tren Windows.

.DESCRIPTION
    Script se kiem tra va cai (neu thieu) Node.js LTS, MongoDB, Ollama bang winget,
    cai thu vien npm cho backend va frontend, tao file .env, tai 3 mo hinh Ollama
    va co the chay ung dung ngay sau khi cai.

.PARAMETER SkipModels
    Bo qua buoc tai mo hinh Ollama (dung khi da co mo hinh hoac mang cham).

.PARAMETER Run
    Chay "npm run dev" ngay sau khi cai dat xong.

.PARAMETER MongoUri
    Chuoi ket noi MongoDB (mac dinh: mongodb://127.0.0.1:27017/ai-translate).
    Neu dung MongoDB Atlas, truyen chuoi ket noi vao day va script se khong cai MongoDB local.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\setup.ps1
    powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Run
    powershell -ExecutionPolicy Bypass -File .\setup.ps1 -MongoUri "mongodb+srv://user:pass@cluster/ai-translate"
#>
[CmdletBinding()]
param(
    [switch]$SkipModels,
    [switch]$Run,
    [string]$MongoUri = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$Models = @("translategemma:4b", "qwen3:4b", "qwen3:4b-instruct")
$UseLocalMongo = [string]::IsNullOrWhiteSpace($MongoUri)
if ($UseLocalMongo) { $MongoUri = "mongodb://127.0.0.1:27017/ai-translate" }

function Write-Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    [!]  $msg" -ForegroundColor Yellow }

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    return ([Security.Principal.WindowsPrincipal]$id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user    = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Install-WithWinget($id, $label) {
    Write-Host "    Dang cai $label (winget)..." -ForegroundColor Gray
    winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements
    # 0 = thanh cong; -1978335189 = da cai / khong co ban cap nhat
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
        throw "Cai $label that bai (winget ma $LASTEXITCODE). Hay cai thu cong roi chay lai script."
    }
    Update-SessionPath
}

function Wait-Url($url, $seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null
            return $true
        } catch { Start-Sleep -Seconds 2 }
    }
    return $false
}

# ---------------------------------------------------------------- 0. Kiem tra
Write-Step "Kiem tra moi truong"

if ($env:OS -ne "Windows_NT") { throw "Script nay chi danh cho Windows." }
if (-not (Test-Path (Join-Path $ProjectRoot "package.json")) -or -not (Test-Path (Join-Path $ProjectRoot "client"))) {
    throw "Hay dat setup.ps1 o thu muc goc cua du an (cung cho voi package.json va thu muc client/)."
}
if (-not (Test-Command "winget")) {
    throw "Khong tim thay winget. Hay cap nhat 'App Installer' trong Microsoft Store, hoac cai Node.js, MongoDB, Ollama thu cong."
}
Write-Ok "Thu muc du an: $ProjectRoot"

# Cai MongoDB dang service can quyen quan tri; Node/Ollama thi khong bat buoc.
if ($UseLocalMongo -and -not (Test-Admin) -and -not (Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue)) {
    Write-Warn2 "Cai MongoDB can quyen Administrator. Dang mo lai script voi quyen quan tri..."
    $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$($MyInvocation.MyCommand.Path)`"")
    if ($SkipModels) { $argList += "-SkipModels" }
    if ($Run)        { $argList += "-Run" }
    Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Verb RunAs -WorkingDirectory $ProjectRoot
    return
}

# ---------------------------------------------------------------- 1. Node.js
Write-Step "Node.js"
if (Test-Command "node") {
    $nodeVer = (node -v).TrimStart("v")
    if ([version]($nodeVer.Split("-")[0]) -lt [version]"20.6.0") {
        Write-Warn2 "Node.js $nodeVer qua cu (can >= 20.6 de dung --env-file). Dang cai ban LTS moi..."
        Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS"
    } else {
        Write-Ok "Node.js $nodeVer"
    }
} else {
    Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS"
}
if (-not (Test-Command "node")) { throw "Da cai Node.js nhung chua nhan lenh 'node'. Hay mo lai terminal roi chay lai script." }
Write-Ok "node $(node -v), npm $(npm -v)"

# ---------------------------------------------------------------- 2. MongoDB
Write-Step "MongoDB"
if ($UseLocalMongo) {
    $mongoSvc = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    if (-not $mongoSvc -and -not (Test-Command "mongod")) {
        Install-WithWinget "MongoDB.Server" "MongoDB Community Server"
        $mongoSvc = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    }
    if ($mongoSvc) {
        if ($mongoSvc.Status -ne "Running") {
            try { Start-Service -Name "MongoDB"; Write-Ok "Da khoi dong dich vu MongoDB" }
            catch { Write-Warn2 "Khong the khoi dong dich vu MongoDB: $($_.Exception.Message)" }
        } else {
            Write-Ok "Dich vu MongoDB dang chay"
        }
    } else {
        Write-Warn2 "Khong thay dich vu MongoDB. Hay bao dam mongod dang chay o cong 27017 truoc khi dung ung dung."
    }
} else {
    Write-Ok "Dung MongoDB tu xa (khong cai MongoDB local)"
}

# ---------------------------------------------------------------- 3. Ollama
Write-Step "Ollama"
if (-not (Test-Command "ollama")) {
    Install-WithWinget "Ollama.Ollama" "Ollama"
    # Ollama thuong nam trong thu muc cai dat rieng cua nguoi dung
    $ollamaDir = Join-Path $env:LOCALAPPDATA "Programs\Ollama"
    if ((Test-Path $ollamaDir) -and ($env:Path -notlike "*$ollamaDir*")) { $env:Path += ";$ollamaDir" }
}
if (-not (Test-Command "ollama")) { throw "Da cai Ollama nhung chua nhan lenh 'ollama'. Hay mo lai terminal roi chay lai script." }
Write-Ok "Ollama $((ollama -v 2>&1 | Select-Object -Last 1))"

$ollamaUp = $false
try { Invoke-WebRequest -Uri "http://127.0.0.1:11434" -UseBasicParsing -TimeoutSec 3 | Out-Null; $ollamaUp = $true } catch { }
if (-not $ollamaUp) {
    Write-Host "    Dang khoi dong Ollama..." -ForegroundColor Gray
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    $ollamaUp = Wait-Url "http://127.0.0.1:11434" 40
}
if ($ollamaUp) { Write-Ok "Ollama dang chay o cong 11434" }
else { Write-Warn2 "Chua ket noi duoc Ollama. Hay mo ung dung Ollama thu cong." }

# ---------------------------------------------------------------- 4. Thu vien npm
Write-Step "Cai thu vien npm (backend)"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install (backend) that bai." }
Write-Ok "Backend xong"

Write-Step "Cai thu vien npm (frontend)"
npm install --prefix client
if ($LASTEXITCODE -ne 0) { throw "npm install (frontend) that bai." }
Write-Ok "Frontend xong"

# ---------------------------------------------------------------- 5. File .env
Write-Step "Tao file .env"
$envPath = Join-Path $ProjectRoot ".env"
if (Test-Path $envPath) {
    Write-Ok ".env da ton tai, giu nguyen"
} else {
    $envLines = @(
        "PORT=5001",
        "MONGODB_URI=$MongoUri",
        "OLLAMA_BASE_URL=http://127.0.0.1:11434",
        "OLLAMA_CHAT_MODEL=qwen3:4b-instruct",
        "OLLAMA_TRANSLATION_MODEL=translategemma:4b",
        "OLLAMA_DETECTION_MODEL=qwen3:4b",
        "OLLAMA_TRANSLATION_TIMEOUT_MS=120000"
    )
    # Ghi UTF-8 khong BOM de Node doc dung
    [System.IO.File]::WriteAllLines($envPath, $envLines, (New-Object System.Text.UTF8Encoding($false)))
    Write-Ok "Da tao .env"
}

# ---------------------------------------------------------------- 6. Mo hinh Ollama
if ($SkipModels) {
    Write-Step "Bo qua tai mo hinh (-SkipModels)"
} elseif (-not $ollamaUp) {
    Write-Step "Tai mo hinh Ollama"
    Write-Warn2 "Ollama chua chay nen bo qua. Sau khi mo Ollama, chay: ollama pull $($Models -join '; ollama pull ')"
} else {
    Write-Step "Tai mo hinh Ollama (dung luong lon, co the mat nhieu phut)"
    $installed = (ollama list 2>$null) -join "`n"
    foreach ($m in $Models) {
        if ($installed -match [regex]::Escape($m)) {
            Write-Ok "$m da co san"
        } else {
            Write-Host "    Dang tai $m ..." -ForegroundColor Gray
            ollama pull $m
            if ($LASTEXITCODE -ne 0) { Write-Warn2 "Tai $m that bai. Co the tai lai sau bang: ollama pull $m" }
            else { Write-Ok "$m xong" }
        }
    }
}

# ---------------------------------------------------------------- 7. Ket thuc
Write-Step "Hoan tat"
Write-Host "    Chay ung dung:   npm run dev"
Write-Host "    Giao dien:       http://localhost:5173"
Write-Host "    Kiem tra API:    http://localhost:5001/api/health"
Write-Host "    Tien ich Chrome: chrome://extensions > Che do nha phat trien > Tai tien ich da giai nen > thu muc extension/"

if ($Run) {
    Write-Step "Dang chay ung dung"
    npm run dev
}
