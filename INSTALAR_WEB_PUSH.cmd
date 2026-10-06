@echo off
cd /d "%~dp0"
echo Instalando Web Push no projeto...
npm install web-push
npm install -D @types/web-push
echo.
echo Dependencias instaladas. Reinicie com npm run dev.
pause
