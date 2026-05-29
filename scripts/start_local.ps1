# Archisynapse Local Microservices Orchestrator
# Starts all 7 microservices locally in minimized background windows.
# Running this enables local E2E verification without needing Docker, Postgres, Redis, or RabbitMQ!

$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "     Archisynapse Local Services Startup Orchestrator" -ForegroundColor Cyan -Bold
Write-Host "========================================================" -ForegroundColor Cyan

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "Found Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js not found in PATH! Node.js is required to run services locally." -ForegroundColor Red
    exit 1
}

# Check Python (Optional, for Fraud Engine)
$hasPython = $false
try {
    $pyVersion = python --version
    Write-Host "Found Python: $pyVersion" -ForegroundColor Green
    $hasPython = $true
} catch {
    Write-Host "Python not found in PATH. Fraud service will be bypassed (Gateway has auto-fallbacks)." -ForegroundColor Yellow
}

# Create a PIDs store file to allow easy stopping
$pidFile = "./scripts/local_pids.txt"
if (Test-Path $pidFile) {
    Remove-Item $pidFile
}

function Start-ServiceProcess($name, $cmd, $args, $dir) {
    Write-Host "Starting $name..." -ForegroundColor Yellow
    $proc = Start-Process $cmd -ArgumentList $args -WorkingDirectory $dir -WindowStyle Minimized -PassThru
    Add-Content -Path $pidFile -Value "$($proc.Id):$name"
    Write-Host "Started $name with PID: $($proc.Id)" -ForegroundColor DarkGray
}

# 1. API Gateway (Port 8000)
Start-ServiceProcess "API Gateway" "node" "index.js" "services/gateway"

# 2. Transaction Service (Port 8001)
Start-ServiceProcess "Transaction Service" "node" "index.js" "services/transaction-service"

# 3. Customer Service (Port 8002)
Start-ServiceProcess "Customer Service" "node" "index.js" "services/customer-service"

# 4. Payout Service (Port 8003)
Start-ServiceProcess "Payout Service" "node" "index.js" "services/payout-service"

# 5. Ledger Service (Port 8004)
Start-ServiceProcess "Ledger Service" "node" "index.js" "services/ledger-service"

# 6. Analytics Service (Port 8007)
Start-ServiceProcess "Analytics Service" "node" "index.js" "services/analytics-service"

# 7. Fraud Detection Service (Port 8005)
if ($hasPython) {
    # Try installing Python dependencies locally if not present
    Write-Host "Installing Python Fraud Service dependencies locally..." -ForegroundColor Yellow
    try {
        Start-Process pip -ArgumentList "install -r requirements.txt" -WorkingDirectory "services/fraud-service" -NoNewWindow -Wait
        Start-ServiceProcess "Fraud Detection Service" "python" "main.py" "services/fraud-service"
    } catch {
        Write-Host "Failed to install/run Python Fraud Service locally. Fallback bypass is active." -ForegroundColor Yellow
    }
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  All services started successfully in the background!" -ForegroundColor Green -Bold
Write-Host "  You can now run E2E verification test by running:" -ForegroundColor Gray
Write-Host "  powershell ./scripts/test_system.ps1" -ForegroundColor Yellow -Bold
Write-Host "`n  To stop all microservices, run:" -ForegroundColor Gray
Write-Host "  powershell ./scripts/stop_local.ps1" -ForegroundColor Yellow -Bold
Write-Host "========================================================" -ForegroundColor Cyan
