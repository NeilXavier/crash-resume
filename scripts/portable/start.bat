@echo off
chcp 65001 >nul
title 极速简历
cd /d "%~dp0"

if not exist "CrashResume.exe" (
  echo 缺少 CrashResume.exe，请重新解压完整的压缩包。
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo 缺少 dist 目录，请重新解压完整的压缩包，不要只复制单个文件。
  pause
  exit /b 1
)

"%~dp0CrashResume.exe"
if errorlevel 1 pause
