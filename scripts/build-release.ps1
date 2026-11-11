param(
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

# 注意：本文件必须以「UTF-8 带 BOM」保存。
# Windows PowerShell 5.1 会把无 BOM 的 UTF-8 当成 ANSI/GBK，
# 中文注释末尾的字节可能吞掉换行，导致下一行代码被并进注释里。
$systemRoot = $env:SystemRoot
if (-not $systemRoot) { $systemRoot = $env:WINDIR }
if (-not $systemRoot) { $systemRoot = "C:\Windows" }

$projectRoot = Split-Path -Parent $PSScriptRoot
$portableDir = Join-Path $PSScriptRoot "portable"
$distDir = Join-Path $projectRoot "dist"
$releaseRoot = Join-Path $projectRoot "release"
$stageRoot = Join-Path $releaseRoot "build"
$stageName = "crash-resume-v$Version"
$stageDir = Join-Path $stageRoot $stageName
$zipPath = Join-Path $releaseRoot "crash-resume-v$Version-windows-x64.zip"

if (-not (Test-Path -LiteralPath (Join-Path $distDir "index.html"))) {
    throw "dist/index.html not found. Run: npm run build:h5"
}

$cscCandidates = @(
    (Join-Path $systemRoot "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
    (Join-Path $systemRoot "Microsoft.NET\Framework\v4.0.30319\csc.exe")
)
$csc = $cscCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $csc) {
    throw "csc.exe not found. Windows .NET Framework 4.x is required."
}

if (Test-Path -LiteralPath $stageRoot) {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

$exePath = Join-Path $stageDir "CrashResume.exe"
$serverSource = Join-Path $portableDir "server.cs"
& $csc /nologo /codepage:65001 /target:exe /platform:anycpu "/out:$exePath" "$serverSource"
if ($LASTEXITCODE -ne 0) {
    throw "C# compilation failed with exit code $LASTEXITCODE"
}

Copy-Item -LiteralPath $distDir -Destination $stageDir -Recurse

Get-ChildItem -LiteralPath $portableDir -File |
    Where-Object { $_.Extension -ne ".cs" } |
    ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $stageDir -Force
    }

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

# 使用 Windows 自带的 bsdtar 创建 zip：
# Compress-Archive 写入的是反斜杠路径，部分解压工具会出错；
# bsdtar 写入标准的 "/" 分隔符和 UTF-8 文件名。
$tarExe = Join-Path $systemRoot "System32\tar.exe"
if (-not (Test-Path -LiteralPath $tarExe)) {
    throw "tar.exe not found. Windows 10/11 is required."
}
& $tarExe -a -c -f $zipPath -C $stageRoot $stageName
if ($LASTEXITCODE -ne 0) {
    throw "zip creation failed with exit code $LASTEXITCODE"
}

$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$sizeMb = [math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 2)

Write-Host "Built:  $zipPath"
Write-Host "Size:   $sizeMb MB"
Write-Host "SHA256: $hash"
