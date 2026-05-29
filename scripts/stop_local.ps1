# Archisynapse Local Microservices Shutdown Orchestrator
# Gracefully stops all Node and Python background service instances.

$ErrorActionPreference = "Continue"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "     Archisynapse Local Services Shutdown Orchestrator" -ForegroundColor Cyan -Bold
Write-Host "========================================================" -ForegroundColor Cyan

$pidFile = "./scripts/local_pids.txt"

if (-not (Test-Path $pidFile)) {
    Write-Host "No active local processes records found. Services might already be stopped." -ForegroundColor Yellow
    exit 0
}

$lines = Get-Content $pidFile
foreach ($line in $lines) {
    if ($line -match "^(\d+):(.+)$") {
        $pid = $Matches[1]
        $name = $Matches[2]
        
        Write-Host "Stopping $name (PID $pid)..." -ForegroundColor Yellow
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped $name successfully." -ForegroundColor Green
        } catch {
            Write-Host "Process $name (PID $pid) was already stopped." -ForegroundColor DarkGray
        }
    }
}

Remove-Item $pidFile
Write-Host "`nAll background microservice instances terminated." -ForegroundColor Green -Bold
Write-Host "========================================================" -ForegroundColor Cyan
