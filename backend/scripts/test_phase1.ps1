$stdoutFile = "server_stdout.log"
$stderrFile = "server_stderr.log"
$respFile = "phase1_response.json"

Remove-Item $stdoutFile, $stderrFile, $respFile -ErrorAction SilentlyContinue

$proc = Start-Process -FilePath "go" -ArgumentList "run", "." -WorkingDirectory (Get-Location) -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile -PassThru

$isReady = $false
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get
        if ($health.status -eq "ok") {
            $isReady = $true
            break
        }
    } catch {
    }
}

if (-not $isReady) {
    Write-Output "SERVER_NOT_READY"
}

$body = '{"text":"Ola Electric reported Rs 487 crore loss in Q3 FY26","language":"telugu"}'

if ($isReady) {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/analyse" -Method Post -ContentType "application/json" -Body $body
        $response | ConvertTo-Json -Depth 10 | Set-Content $respFile
        Write-Output "API_REQUEST_SUCCESS"
    } catch {
        Write-Output "API_REQUEST_FAILED"
        if ($_.Exception.Response -ne $null) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Output ($reader.ReadToEnd())
        } else {
            Write-Output $_.Exception.Message
        }
    }
}

Start-Sleep -Seconds 2
if ($null -ne $proc -and !$proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
}

Start-Sleep -Seconds 1

Write-Output "---PHASE1_RESPONSE---"
if (Test-Path $respFile) {
    Get-Content -Raw $respFile
}

Write-Output "---SERVER_STDOUT---"
if (Test-Path $stdoutFile) {
    Get-Content -Raw $stdoutFile
}

Write-Output "---SERVER_STDERR---"
if (Test-Path $stderrFile) {
    Get-Content -Raw $stderrFile
}
