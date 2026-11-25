@echo off
title AquaSync SCADA
cls
echo ================================================================
echo   AQUASYNC AI(TM) - Starting Dual-Tank Digital Twin SCADA
echo ================================================================
echo.
echo [*] Opening browser to http://localhost:5050 ...
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5050"
echo [*] Running server on port 5050...
node server.js 2>nul || agy-node server.js
pause
