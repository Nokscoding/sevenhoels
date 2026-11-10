# Seven Gestion — compilation de l'installateur avec mises à jour
# Ouvrir PowerShell sur Windows après avoir cloné les deux dépôts.
param(
 [string]$AdminPath = "",
 [switch]$PrepareRelease
)
$ErrorActionPreference = "Stop"
$DesktopRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProjectRoot = (Resolve-Path (Join-Path $DesktopRoot "..")).Path
if (-not $AdminPath) {
 $AdminPath = Join-Path (Split-Path $ProjectRoot -Parent) "seven-hotels-gestion"
}
if (-not (Test-Path (Join-Path $AdminPath "index.html"))) {
 throw "Dépôt admin introuvable : $AdminPath. Clonez https://github.com/Nokscoding/seven-hotels-gestion à côté de sevenhoels, ou passez -AdminPath."
}
$env:SEVEN_ADMIN_SOURCE_DIR = (Resolve-Path $AdminPath).Path
Push-Location $DesktopRoot
try {
 Write-Host "Seven Gestion — portail source : $env:SEVEN_ADMIN_SOURCE_DIR" -ForegroundColor Cyan
 npm install --no-audit --no-fund
 if ($LASTEXITCODE -ne 0) { throw "npm install a échoué" }
 npm run check
 if ($LASTEXITCODE -ne 0) { throw "Contrôle JavaScript échoué" }
 npm test
 if ($LASTEXITCODE -ne 0) { throw "Tests automatiques échoués" }
 if ($PrepareRelease) {
  if (-not $env:GH_TOKEN) { throw "GH_TOKEN doit être configuré localement pour créer un brouillon de release. Ne partagez jamais ce jeton." }
  npm run dist:release
 } else {
  npm run dist:win
 }
 if ($LASTEXITCODE -ne 0) { throw "Compilation Windows échouée" }
 $releaseDir = Join-Path $ProjectRoot "release"
 Write-Host "Compilation terminée. Fichiers dans : $releaseDir" -ForegroundColor Green
 Get-ChildItem $releaseDir -Filter "Seven-Gestion-Setup-*.exe" | Select-Object Name,Length,LastWriteTime
 if ($PrepareRelease) {
  Write-Host "Vérifiez le brouillon dans https://github.com/Nokscoding/sevenhoels/releases avant publication." -ForegroundColor Yellow
 }
} finally {
 Pop-Location
}
