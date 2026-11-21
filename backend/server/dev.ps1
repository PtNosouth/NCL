# Start the site and the admin locally, against a snapshot of the live content.
#
#   .\backend\server\dev.ps1            # serves http://127.0.0.1:8788
#
# It uses backend\data\content.snapshot.json (pulled from the server) so edits made in the
# local admin never touch production. Copy it to .devdata\content.json before editing.

param(
  [int]$Port = 8788
)

$here = $PSScriptRoot                     # backend\server
$backend = Split-Path -Parent $here       # backend
$root = Split-Path -Parent $backend       # repository root
$data = Join-Path $backend ".devdata"
$snapshot = Join-Path $backend "data\content.snapshot.json"

New-Item -ItemType Directory -Force -Path (Join-Path $data "uploads"), (Join-Path $data "backups") | Out-Null
if (-not (Test-Path (Join-Path $data "content.json"))) {
  if (Test-Path $snapshot) {
    Copy-Item $snapshot (Join-Path $data "content.json")
    Write-Host "seeded .devdata\content.json from data\content.snapshot.json"
  } else {
    Write-Host "no snapshot yet - the server will seed from server\seed.json"
  }
}

$env:NCL_PORT = "$Port"
$env:NCL_HOST = "127.0.0.1"
$env:NCL_DATA = $data
$env:NCL_ADMIN = Join-Path $backend "admin"
$env:NCL_SITE = Join-Path $root "home"
$env:NCL_INSECURE = "1"     # local http, so the session cookie can be non-secure

Write-Host "site  : http://127.0.0.1:$Port/"
Write-Host "admin : http://127.0.0.1:$Port/admin/"
Write-Host "data  : $data"
node (Join-Path $here "app.js")
