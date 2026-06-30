@echo off
title Zentra RH - Inicializador

echo ============================================
echo        INICIANDO ZENTRA RH
echo ============================================
echo.

start "Next.js" cmd /k "cd /d C:\Users\grego\zentra-rh && npm run dev"

timeout /t 5 >nul

start "WhatsApp Server" cmd /k "cd /d C:\Users\grego\zentra-rh\whatsapp-server && node server.js"

timeout /t 3 >nul

start "Worker RH" cmd /k "cd /d C:\Users\grego\zentra-rh && npx tsx scripts/zentra-worker.ts"

timeout /t 2 >nul

start http://localhost:3000
start http://localhost:3011/health

echo.
echo ============================================
echo Sistema iniciado!
echo ============================================
echo.
echo Next.js............. http://localhost:3000
echo WhatsApp Server..... http://localhost:3011/health
echo.
pause