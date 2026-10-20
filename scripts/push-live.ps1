# Push main to GitHub -> Cloudflare Pages rebuilds voluspace.com (production branch: main).
# Usage:
#   .\scripts\push-live.ps1 "Short description of the change"
# Requires: git, remote origin -> github.com/Speckybams/airspace-3d

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

foreach ($secret in @(".env", ".env.local", ".env.production")) {
  $tracked = git ls-files $secret 2>$null
  if ($tracked) {
    Write-Error "Refusing to deploy: $secret is tracked in git. Remove it from the repo (see docs/DEPLOY.md)."
  }
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
  $stagedSecrets = git diff --cached --name-only | Where-Object { $_ -match '^\.env' -and $_ -ne '.env.example' }
  if ($stagedSecrets) {
    git reset HEAD -- $stagedSecrets
    Write-Error "Refusing to commit secret env files: $($stagedSecrets -join ', ')"
  }
  git commit -m $Message
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Pushing to origin main..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Cloudflare Pages will run npm run build on GitHub push." -ForegroundColor Green
Write-Host "Watch: Cloudflare dashboard -> Workers and Pages -> airspace-3d -> Deployments"
Write-Host "Live site updates after the build finishes (usually a few minutes)."
Write-Host ""
Write-Host "Before relying on production maps (see docs/DEPLOY.md):" -ForegroundColor Cyan
Write-Host "  - Do not commit .env; set VITE_CESIUM_ION_ACCESS_TOKEN and VITE_OS_API_KEY in"
Write-Host "    Cloudflare Pages -> Settings -> Environment variables (Production + Preview)."
Write-Host "  - After changing env vars there, use Deployments -> Retry deployment on the latest build."
Write-Host "  - Restrict Cesium ion and OS Data Hub keys to https://voluspace.com (and www if used)."
