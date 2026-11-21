# Copies the five skills into your Claude skills folder and installs the browser the scripts use.
# usage: .\install.ps1                  (personal: ~\.claude\skills)
#        .\install.ps1 -Project         (this project only: .\.claude\skills)
#        .\install.ps1 -Force           (also replace skills of the same name that sitecraft did not install)
#        .\install.ps1 -SkipBrowser     (copy the skills only)
param([switch]$Project, [switch]$Force, [switch]$SkipBrowser)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = if ($Project) { Join-Path (Get-Location) ".claude\skills" } else { Join-Path $env:USERPROFILE ".claude\skills" }
New-Item -ItemType Directory -Force $dest | Out-Null

# Every copied skill gets this marker, so a later run knows it may replace it.
$marker = ".installed-by-sitecraft"
$skipped = @()
foreach ($s in "sitecraft","unslop","marketing","dataviz","run") {
  $target = Join-Path $dest $s
  if ((Test-Path $target) -and -not (Test-Path (Join-Path $target $marker)) -and -not $Force) {
    $skipped += $s
    Write-Output "skipped ${s}: $target already exists and was not installed by sitecraft"
    continue
  }
  if (Test-Path $target) { Remove-Item $target -Recurse -Force -Confirm:$false }
  Copy-Item (Join-Path $here "skills\$s") $target -Recurse
  Set-Content -Path (Join-Path $target $marker) -Value "sitecraft $(Get-Date -Format yyyy-MM-dd)"
  Write-Output "installed $s -> $target"
}
if ($skipped.Count -gt 0) {
  Write-Output ""
  Write-Output "Kept your existing $($skipped -join ', '). Sitecraft falls back to its own steps when a sibling skill is different."
  Write-Output "To replace them with sitecraft's versions, run again with -Force."
}

# Playwright goes into <skills>\.sitecraft-deps, which every script looks in (see scripts\_pw.mjs).
if (-not $SkipBrowser) {
  $deps = Join-Path $dest ".sitecraft-deps"
  if (Get-Command npm -ErrorAction SilentlyContinue) {
    New-Item -ItemType Directory -Force $deps | Out-Null
    $pkg = Join-Path $deps "package.json"
    if (-not (Test-Path $pkg)) { Set-Content -Path $pkg -Value '{ "name": "sitecraft-deps", "private": true }' }
    Push-Location $deps
    try {
      npm install --silent --no-audit --no-fund playwright@^1.48.0
      npx playwright install chromium
      Write-Output "Playwright and Chromium installed in $deps"
    } catch {
      Write-Output "Playwright setup failed. Run: cd `"$deps`"; npm install playwright; npx playwright install chromium"
    } finally { Pop-Location }
  } else {
    Write-Output "Node.js not found. Install Node 18+, then run this script again."
  }
}
Write-Output "Done. Ask Claude to build or redo a site, or type /sitecraft."
