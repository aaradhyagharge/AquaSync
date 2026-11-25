@echo off
title AquaSync AI SCADA - Public Internet Tunnel
color 0A
cls
echo ================================================================
echo   AQUASYNC AI(TM) - Local Server + Instant Public Live Link
echo ================================================================
echo.

:: Detect Node.js
set "NODE_CMD=node"
where node >nul 2>nul
if %errorlevel% equ 0 goto :node_found

where agy-node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_CMD=agy-node"
    goto :node_found
)

if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
    set "NODE_CMD=%APPDATA%\Antigravity\bin\agy-node.cmd"
    goto :node_found
)

if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files\nodejs\node.exe"
    goto :node_found
)

echo [ERROR] Node.js was not found. Please install Node.js from https://nodejs.org/
pause
exit /b 1

:node_found
echo [*] Starting Local Backend Server on port 5050...
start "AquaSync Server" /min "%NODE_CMD%" server.js

echo [*] Opening Local Dashboard at http://localhost:5050...
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5050"

echo.
echo ================================================================
echo   CONNECTING PUBLIC INTERNET TUNNEL (serveo.net)
echo   Copy the HTTPS link below to send to your friends!
echo ================================================================
echo.

ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -R 80:localhost:5050 serveo.net

pause
