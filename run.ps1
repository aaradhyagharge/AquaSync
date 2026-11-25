Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  AQUASYNC AI(TM) - Starting Dual-Tank Digital Twin SCADA" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[*] Opening browser to http://localhost:5050 ..." -ForegroundColor Green
Start-Process "http://localhost:5050"
Write-Host "[*] Starting server on port 5050..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    node server.js
} else {
    agy-node server.js
}
