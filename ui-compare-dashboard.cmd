@echo off
setlocal
cd /d "%~dp0"
echo Starting UI Compare dashboard...
node tools/ui-compare/server.mjs
pause
