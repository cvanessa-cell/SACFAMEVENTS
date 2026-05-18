# Kill, rebuild (prisma client), and run public UI (:3333) + admin UI (:3111), then open both in the browser.
param(
  [switch]$SkipGenerate,
  [int]$ReadyTimeoutSeconds = 300
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$PublicPort = 3333
$AdminPort = 3111
$PublicUrl = "http://localhost:$PublicPort/discover"
$AdminUrl = "http://localhost:$AdminPort/admin/event-monitoring"

# Under node_modules/.cache so OneDrive does not try to sync leading-dot build folders.
$PublicDistDir = "node_modules/.cache/next-dist-public"
$AdminDistDir = "node_modules/.cache/next-dist-admin"

function Stop-ListenersOnPort {
  param([int]$Port)

  $pids = @()
  try {
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  } catch {
    # Get-NetTCPConnection may be unavailable; fall back to netstat.
  }

  if (-not $pids) {
    $pids = netstat -ano |
      Select-String -Pattern ":\s*$Port\s+" |
      ForEach-Object {
        $parts = ($_ -split '\s+') | Where-Object { $_ -ne "" }
        $parts[-1]
      } |
      Sort-Object -Unique
  }

  foreach ($procId in $pids) {
    if ($procId -match '^\d+$' -and [int]$procId -gt 0) {
      Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
    }
  }
}

function Wait-ForPorts {
  param(
    [int[]]$Ports,
    [int]$TimeoutSeconds
  )

  $pending = [System.Collections.Generic.HashSet[int]]::new($Ports)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ($pending.Count -gt 0 -and (Get-Date) -lt $deadline) {
    foreach ($port in @($pending)) {
      try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect("127.0.0.1", $port)
        $client.Close()
        [void]$pending.Remove($port)
        Write-Host "  localhost:$port is ready" -ForegroundColor DarkGreen
      } catch {
        # still starting
      }
    }
    if ($pending.Count -gt 0) {
      Start-Sleep -Seconds 2
    }
  }

  if ($pending.Count -gt 0) {
    $missing = ($pending | Sort-Object) -join ", "
    throw "Timed out after ${TimeoutSeconds}s waiting for port(s): $missing"
  }
}

function Start-DevWindow {
  param(
    [string]$Label,
    [string]$NpmScript,
    [int]$Port,
    [string]$DistDir
  )

  $title = "SacFam $Label (:$Port)"
  $cmdLine = "cd /d `"$Root`" && set NEXT_DIST_DIR=$DistDir && title $title && echo [$Label] http://localhost:$Port && npm run $NpmScript"

  Start-Process -FilePath "cmd.exe" -ArgumentList @("/k", $cmdLine) | Out-Null
}

Set-Location -LiteralPath $Root

Write-Host "Stopping listeners on ports $PublicPort and $AdminPort..." -ForegroundColor Yellow
Stop-ListenersOnPort -Port $PublicPort
Stop-ListenersOnPort -Port $AdminPort
Start-Sleep -Seconds 1

if (-not $SkipGenerate) {
  Write-Host "Regenerating Prisma client..." -ForegroundColor Yellow
  & npx prisma generate
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Starting public UI on :$PublicPort and admin UI on :$AdminPort..." -ForegroundColor Yellow
Start-DevWindow -Label "public" -NpmScript "dev:public" -Port $PublicPort -DistDir $PublicDistDir
Start-Sleep -Seconds 2
Start-DevWindow -Label "admin" -NpmScript "dev:admin" -Port $AdminPort -DistDir $AdminDistDir

Write-Host "Waiting for servers to accept connections (first compile may take a few minutes)..." -ForegroundColor Yellow
Wait-ForPorts -Ports @($PublicPort, $AdminPort) -TimeoutSeconds $ReadyTimeoutSeconds

Write-Host "Opening browsers..." -ForegroundColor Green
Start-Process $PublicUrl
Start-Process $AdminUrl

Write-Host ""
Write-Host "Public: $PublicUrl" -ForegroundColor Green
Write-Host "Admin:  $AdminUrl" -ForegroundColor Green
Write-Host "Dev servers run in separate terminal windows. Close those windows to stop them." -ForegroundColor DarkGray
