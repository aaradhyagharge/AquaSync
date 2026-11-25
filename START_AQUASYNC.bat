@echo off
title AquaSync AI SCADA - Dual Tank Digital Twin
color 0B
cls
echo ================================================================
echo   AQUASYNC AI(TM) - Next-Gen Smart Water Grid Digital Twin
echo ================================================================
echo.

:: Detect Node.js or agy-node
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

if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Programs\node\node.exe"
    goto :node_found
)

echo [ERROR] Node.js runtime was not found on your system!
echo Please download and install the free Node.js LTS from:
echo https://nodejs.org/
echo.
pause
exit /b 1

:node_found
echo [*] Node.js runtime located: %NODE_CMD%
echo [*] Starting AquaSync SCADA Server on port 5050...
echo [*] Opening your browser to http://localhost:5050...
echo.

:: Auto-launch browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5050"

:: Start Node.js server
"%NODE_CMD%" server.js

pause
