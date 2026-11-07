@echo off
chcp 936 >nul
title 极速简历
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo 没有检测到 Node.js。
  echo 请先到 https://nodejs.org/ 下载安装 LTS 版本，安装完成后重新双击本文件。
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 首次运行，正在安装依赖，大约需要 1 分钟...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto fail
)

if not exist "dist\index.html" (
  echo 正在构建页面，大约需要 40 秒...
  call npm run build:h5
  if errorlevel 1 goto fail
)

echo.
echo 正在启动本地服务...
echo 浏览器会自动打开 http://127.0.0.1:10087/
echo.
echo 使用期间请不要关闭这个黑色窗口；关闭窗口即可停止。
echo.

if not defined NO_BROWSER (
  start "" cmd /c "timeout /t 3 >nul & start http://127.0.0.1:10087/"
)

rem Node 输出 UTF-8，切到 65001 避免中文日志乱码
chcp 65001 >nul
call npm run serve:h5
chcp 936 >nul
echo.
echo 服务已停止。
pause
exit /b 0

:fail
echo.
echo 启动失败，请把上面的报错信息发给帮你处理的人。
pause
exit /b 1
