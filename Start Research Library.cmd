@echo off
cd /d "%~dp0"
node --env-file-if-exists=.env --use-system-ca --use-env-proxy src/server.mjs
pause
