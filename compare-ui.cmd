@echo off
setlocal

cd /d "%~dp0"

echo Starting UI branch comparison from:
echo %CD%
echo.

npm run compare:ui

echo.
echo Script exited with code %ERRORLEVEL%.
echo Press any key to close this window.
pause >nul
