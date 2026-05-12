$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$frontendTitle = 'ReadWithMe Frontend'
$proxyTitle = 'ReadWithMe Proxy'

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$projectRoot'; `$Host.UI.RawUI.WindowTitle = '$frontendTitle'; python -m http.server 3000"
)

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$projectRoot'; `$Host.UI.RawUI.WindowTitle = '$proxyTitle'; python proxy_server.py"
)

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:3000/app.html"

Write-Output 'Started frontend on http://127.0.0.1:3000/app.html'
Write-Output 'Started proxy on http://127.0.0.1:11435'
