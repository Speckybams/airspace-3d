# Push main to GitHub → Cloudflare Pages rebuilds voluspace.com (production branch: main).
# Usage:
#   .\scripts\push-live.ps1 "Short description of the change"
# Requires: git, remote origin → github.com/Speckybams/airspace-3d

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Message
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$branch = git branch --show-current
if ($branch -ne "main") {
  Write-Error "Switch to main before deploying (current: $branch). Use: git checkout main"
}

Write-Host "Running typecheck..." -ForegroundColor Cyan
npm run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git status --short
$dirty = git status --porcelain
if (-not $dirty) {
  Write-Host "Nothing to commit. Pushing main anyway..." -ForegroundColor Yellow
} else {
  git add -A
  git commit -m $Message
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Pushing to origin main..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Cloudflare Pages will run npm run build on GitHub push." -ForegroundColor Green
Write-Host "Watch: Cloudflare dashboard → Workers & Pages → airspace-3d → Deployments"
Write-Host "Live site updates after the build finishes (usually a few minutes)."
