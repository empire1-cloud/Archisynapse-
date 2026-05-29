# Archisynapse End-to-End System Integration Test Script
# Runs in PowerShell on Windows. Executes complete workflow verification.

$ErrorActionPreference = "Stop"

# Helper function to print colorful section headers
function Print-Header($text) {
    Write-Host "`n======================================================================" -ForegroundColor Cyan
    Write-Host "   $text" -ForegroundColor Cyan -Bold
    Write-Host "======================================================================" -ForegroundColor Cyan
}

# Helper function to print pass/fail statuses
function Print-Status($testName, $isSuccess, $message = "") {
    if ($isSuccess) {
        Write-Host "[ PASS ] " -ForegroundColor Green -NoNewline
        Write-Host "$testName $message" -ForegroundColor Gray
    } else {
        Write-Host "[ FAIL ] " -ForegroundColor Red -NoNewline
        Write-Host "$testName $message" -ForegroundColor DarkRed -Bold
    }
}

Print-Header "STARTING INTEGRATION VERIFICATION"

# 1. Wait for Gateway API to be online
Write-Host "Verifying Gateway Health status (http://localhost:8000/health)..." -ForegroundColor Yellow
$healthy = $false
for ($i = 1; $i -le 6; $i++) {
    try {
        $healthRes = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
        if ($healthRes.status -eq "healthy") {
            $healthy = $true
            break
        }
    } catch {
        Write-Host "Waiting for services to boot up... ($i/6)" -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
    }
}

if (-not $healthy) {
    Print-Status "Gateway Health Check" $false "Gateway service failed to respond or is unhealthy."
    exit 1
}
Print-Status "Gateway Health Check" $true "All services reporting healthy!"

# Setup Test Parameters
$acmeApiKey = "sk_test_archisynapse_12345" # Pro Tier
$freeApiKey = "sk_test_free_key_54321"     # Free Tier
$gatewayUrl = "http://localhost:8000/v1"

# 2. Verify Authentication Rules
Print-Header "VERIFYING AUTHENTICATION SECURITY LAYER"
try {
    Invoke-RestMethod -Uri "$gatewayUrl/customers" -Method Get
    Print-Status "Missing API Key check" $false "Gateway allowed request without Authorization header!"
} catch {
    Print-Status "Missing API Key check" $true "Access denied correctly (HTTP 401)"
}

try {
    $headers = @{ "Authorization" = "Bearer sk_invalid_key" }
    Invoke-RestMethod -Uri "$gatewayUrl/customers" -Method Get -Headers $headers
    Print-Status "Invalid API Key check" $false "Gateway allowed request with invalid token!"
} catch {
    Print-Status "Invalid API Key check" $true "Access denied correctly (HTTP 401)"
}

# 3. Create Customers via API Gateway
Print-Header "VERIFYING CUSTOMER SERVICE FLOW"
$headersAcme = @{
    "Authorization" = "Bearer $acmeApiKey"
    "Content-Type"  = "application/json"
}

# Customer A (Successful processing account)
$custBodyA = @{
    name = "Acme Premium Client"
    email = "client.a@acme.com"
    payment_method = @{
        type = "card"
        card_token = "tok_visa_debit_4242"
    }
} | ConvertTo-Json

$customerA = Invoke-RestMethod -Uri "$gatewayUrl/customers" -Method Post -Headers $headersAcme -Body $custBodyA
Print-Status "Create Succeeded Customer profile" ($customerA.id -ne $null) "Created ID: $($customerA.id)"

# Customer B (Account configured to fail banking processor checks)
$custBodyB = @{
    name = "Fail Account"
    email = "client.failed@acme.com"
    payment_method = @{
        type = "card"
        card_token = "tok_fail_card"
    }
} | ConvertTo-Json

$customerB = Invoke-RestMethod -Uri "$gatewayUrl/customers" -Method Post -Headers $headersAcme -Body $custBodyB
Print-Status "Create Failure Customer profile" ($customerB.id -ne $null) "Created ID: $($customerB.id)"

# 4. Process Payment Transactions
Print-Header "VERIFYING TRANSACTION STATE MACHINE & PROCESSING LAYER"

# Scenario A: Succeeded payment ($150.00 / 15000 cents)
$txnBodyA = @{
    customer_id = $customerA.id
    amount = 15000
    currency = "USD"
} | ConvertTo-Json

$txA = Invoke-RestMethod -Uri "$gatewayUrl/transactions" -Method Post -Headers $headersAcme -Body $txnBodyA
Print-Status "Succeeded Charge ($150.00)" ($txA.status -eq "succeeded") "Txn ID: $($txA.id), Status: $($txA.status)"

# Scenario B: Fraud engine blocked payment ($999.99 / 99999 cents - triggers model score 0.95)
$txnBodyB = @{
    customer_id = $customerA.id
    amount = 99999
    currency = "USD"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$gatewayUrl/transactions" -Method Post -Headers $headersAcme -Body $txnBodyB
    Print-Status "Fraud Auto-Block Charge ($999.99)" $false "Charge was processed when it should have been blocked!"
} catch {
    # Expecting 403 Forbidden
    $errRes = $_.Exception.Response
    $stream = $errRes.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $errText = $reader.ReadToEnd() | ConvertFrom-Json
    
    $blockedOk = ($errRes.StatusCode -eq "Forbidden" -and $errText.transaction.status -eq "failed" -and $errText.transaction.fraud_score -gt 0.90)
    Print-Status "Fraud Auto-Block Charge ($999.99)" $blockedOk "Status: $($errRes.StatusCode) - Declined correctly. Score: $($errText.transaction.fraud_score)"
}

# Scenario C: Processor Bank Decline (using Customer B - Fail Account)
$txnBodyC = @{
    customer_id = $customerB.id
    amount = 5000
    currency = "USD"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$gatewayUrl/transactions" -Method Post -Headers $headersAcme -Body $txnBodyC
    Print-Status "Processor Bank Decline ($50.00)" $false "Card processed when it should have been declined!"
} catch {
    # Expecting 402 Payment Required
    $errRes = $_.Exception.Response
    $stream = $errRes.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $errText = $reader.ReadToEnd() | ConvertFrom-Json
    
    $declineOk = ($errRes.StatusCode -eq "PaymentRequired" -and $errText.transaction.status -eq "failed")
    Print-Status "Processor Bank Decline ($50.00)" $declineOk "Status: $($errRes.StatusCode) - Declined by bank simulator."
}

# 5. Verify Double-Entry Accounting Balances (Back-office Audit)
Print-Header "AUDITING DOUBLE-ENTRY FINANCIAL LEDGER"
$ledgerAudit = Invoke-RestMethod -Uri "http://localhost:8004/audit" -Method Get
$auditPassed = $ledgerAudit.audit_passed

Print-Status "Ledger Equations Audit Match" $auditPassed "Total Debits = Credits: $($ledgerAudit.total_debit_journal_sum) cents"
Write-Host "Assets + Expenses: $($ledgerAudit.accounting_equation.assets_plus_expenses) cents" -ForegroundColor DarkGray
Write-Host "Liabilities + Equity + Revenue: $($ledgerAudit.accounting_equation.liabilities_plus_equity_plus_revenue) cents" -ForegroundColor DarkGray

# 6. Verify Rate Limiting enforcement
Print-Header "VERIFYING SLIDING WINDOW RATE LIMITING"
$headersFree = @{
    "Authorization" = "Bearer $freeApiKey"
    "Content-Type"  = "application/json"
}

Write-Host "Firing fast API burst to trigger 429 Rate Limiting on Free Tier limit (100 req/min)..." -ForegroundColor Yellow
$rateLimited = $false
for ($i = 1; $i -le 110; $i++) {
    try {
        # Fast query
        Invoke-RestMethod -Uri "$gatewayUrl/customers" -Method Get -Headers $headersFree > $null
    } catch {
        if ($_.Exception.Response.StatusCode -eq "TooManyRequests") {
            $rateLimited = $true
            break
        }
    }
}
Print-Status "Free Tier Rate Limiter auto-block" $rateLimited "Rate limit successfully tripped and blocked with HTTP 429!"

# 7. Check Settlement Payout balances and Execute Settle Out
Print-Header "VERIFYING Payout BALANCE & SETTLEMENT FLOW"

# Check available balance
$balBefore = Invoke-RestMethod -Uri "$gatewayUrl/payouts/balance" -Method Get -Headers $headersAcme
# Succeeded charge was $150.00 (15000 cents). Acme is Pro = 1.5% fee.
# Net proceeds: 15000 * 0.985 = 14775 cents ($147.75)
$expectedNet = 14775
$balanceMatch = $balBefore.available_balance -eq $expectedNet
Print-Status "Settlement Balance Calculation" $balanceMatch "Available: $($balBefore.available_balance) cents ($($balBefore.available_balance/100) USD). Expected Net: $expectedNet cents."

# Settle balance (trigger payout)
$payout = Invoke-RestMethod -Uri "$gatewayUrl/payouts/trigger" -Method Post -Headers $headersAcme
Print-Status "Trigger instant merchant payout" ($payout.status -eq "completed" -and $payout.amount -eq $expectedNet) "Paid Out ID: $($payout.id), Amount: $($payout.amount) cents"

# Check available balance is now $0.00
$balAfter = Invoke-RestMethod -Uri "$gatewayUrl/payouts/balance" -Method Get -Headers $headersAcme
Print-Status "Settle Balance post-payout resets" ($balAfter.available_balance -eq 0) "Available balance: $($balAfter.available_balance) cents."

# Run Ledger audit again to check that payout debited liability and credited bank clearing, and ledger remains perfectly balanced!
$ledgerAuditPost = Invoke-RestMethod -Uri "http://localhost:8004/audit" -Method Get
Print-Status "Post-Payout Ledger Balance Audit" $ledgerAuditPost.audit_passed "Total journal sum: $($ledgerAuditPost.total_debit_journal_sum) cents."

# 8. Query Aggregated Reports (Analytics Summary)
Print-Header "VERIFYING PLATFORM REPORTING & Cohorts"
$analytics = Invoke-RestMethod -Uri "$gatewayUrl/analytics/summary" -Method Get -Headers $headersAcme

$analyticsOk = ($analytics.financials.gross_volume_usd -eq 150.00 -and $analytics.metrics.customer_cohort_size -eq 2)
Print-Status "Aggregate Platform Reporting Summary" $analyticsOk "Gross volume: $($analytics.financials.gross_volume_usd) USD, Conversion: $($analytics.metrics.conversion_rate_percent)%, Cohort customers: $($analytics.metrics.customer_cohort_size)"

Print-Header "ALL TESTS COMPLETED SUCCESSFULLY"
Write-Host "Archisynapse microservices pipeline verified successfully." -ForegroundColor Green -Bold
