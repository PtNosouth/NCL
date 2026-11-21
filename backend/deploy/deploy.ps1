# Upload and activate the site on the server.
#
#   .\deploy.ps1 -User root -HostName 120.24.169.250
#   .\deploy.ps1 -User ubuntu -HostName 120.24.169.250 -IdentityFile C:\Users\you\.ssh\id_ed25519
#
# Layout on the server: /var/www/ncl/releases/<timestamp> + a `current` symlink, so a bad
# deploy is one symlink away from being rolled back.

param(
  [string]$User = 'root',
  [string]$HostName = '120.24.169.250',
  [string]$IdentityFile = '',
  [string]$RemoteRoot = '/var/www/ncl',
  [string]$Zip = (Join-Path $PSScriptRoot 'ncl-site.zip')
)

$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyy-MM-ddTHHmm'
$release = "$RemoteRoot/releases/$stamp"
$target = "$User@$HostName"

$sshArgs = @('-o', 'StrictHostKeyChecking=accept-new')
if ($IdentityFile) { $sshArgs += @('-i', $IdentityFile) }

Write-Host "→ release $stamp" -ForegroundColor Cyan

Write-Host "→ uploading $Zip ($([math]::Round((Get-Item $Zip).Length/1MB,1)) MB)"
scp @sshArgs $Zip "${target}:/tmp/ncl-site.zip"

Write-Host "→ unpacking into $release"
$remote = @(
  "set -e",
  "sudo mkdir -p '$release'",
  "sudo rm -rf '$release'/*",
  "sudo unzip -q -o /tmp/ncl-site.zip -d '$release'",
  "sudo chown -R `$USER:www-data '$release'",
  "sudo find '$release' -type d -exec chmod 755 {} +",
  "sudo find '$release' -type f -exec chmod 644 {} +",
  "sudo ln -sfn '$release' '$RemoteRoot/current'",
  "sudo nginx -t",
  "sudo systemctl reload nginx",
  "rm -f /tmp/ncl-site.zip",
  "echo '--- response ---'",
  "curl -sI http://127.0.0.1/ | head -n 5"
) -join ' && '

ssh @sshArgs $target $remote

Write-Host "`n✓ deployed $stamp" -ForegroundColor Green
Write-Host "  http://$HostName/"
Write-Host "  rollback: ssh $target 'ln -sfn $RemoteRoot/releases/<previous> $RemoteRoot/current && sudo systemctl reload nginx'"
