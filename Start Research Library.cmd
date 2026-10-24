@echo off
cd /d "%~dp0"
node --use-system-ca --use-env-proxy src/server.mjs
pause
