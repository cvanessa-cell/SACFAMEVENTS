@echo off
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-ui.ps1" %*
if errorlevel 1 exit /b %errorlevel%
