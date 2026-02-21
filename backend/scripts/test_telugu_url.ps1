$stdoutFile = "server_stdout.log"
$stderrFile = "server_stderr.log"
$respFile = "telugu_url_response.json"

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
} else {
    $bodyObj = @{
        url = "https://www.eenadu.net/telugu-news/world/trump-global-tariffs-struck-down-by-us-supreme-court/0801/126032018"
        language = "telugu"
    }
    $body = $bodyObj | ConvertTo-Json -Compress

    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/analyse" -Method Post -ContentType "application/json" -Body $body
        $response | ConvertTo-Json -Depth 20 | Set-Content $respFile
        Write-Output "API_REQUEST_SUCCESS"
    } catch {
        Write-Output "API_REQUEST_FAILED"
        if ($_.Exception.Response -ne $null) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Output $errorBody
            $errorBody | Set-Content $respFile
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

Write-Output "---RESPONSE---"
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
