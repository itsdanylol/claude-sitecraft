# Copies the five skills into your Claude skills folder and installs the browser the scripts use.
# usage: .\install.ps1             (personal: ~\.claude\skills)
#        .\install.ps1 -Project    (this project only: .\.claude\skills)
param([switch]$Project)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = if ($Project) { Join-Path (Get-Location) ".claude\skills" } else { Join-Path $env:USERPROFILE ".claude\skills" }
New-Item -ItemType Directory -Force $dest | Out-Null
foreach ($s in "unswappable","unslop","marketing","dataviz","run") {
  $target = Join-Path $dest $s
  if (Test-Path $target) { Remove-Item $target -Recurse -Force -Confirm:$false }
  Copy-Item (Join-Path $here "skills\$s") $target -Recurse
  Write-Output "installed $s -> $target"
}
if (Get-Command npm -ErrorAction SilentlyContinue) {
  Push-Location $here; npm install --silent; npx playwright install chromium; Pop-Location
} else {
  Write-Output "Node.js not found. Install Node 18+, then: npm i -g playwright; npx playwright install chromium"
}
Write-Output "Done. Ask Claude to build or redo a site, or type /unswappable."
