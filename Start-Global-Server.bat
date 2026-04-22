@echo off
title ROMS Global Server (romsah.dpdns.org)
color 0A

echo =======================================================
echo    RESTAURANT ORDER MANAGEMENT SYSTEM - GLOBAL SERVER
echo =======================================================
echo.
echo Your website will be live at: https://romsah.dpdns.org
echo.
echo [1/2] Starting Cloudflare Tunnel in background...
start "Cloudflare Tunnel (romsah.dpdns.org)" cmd /c ".\cloudflared.exe tunnel run roms-tunnel"
timeout /t 3 /nobreak >nul

echo [2/2] Starting Local Web Server...
echo.
echo (Keep this window open to keep the website LIVE)
echo.
npm run dev
