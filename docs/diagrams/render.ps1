# Render all Mermaid diagrams to PNG
# Requires: npm install -g @mermaid-js/mermaid-cli
#
# Usage:
#   cd "C:\Users\elgas\OneDrive\Desktop\MSPR\MSPR pipeline\docs\diagrams"
#   .\render.ps1
#
# Optional — render a single file:
#   .\render.ps1 -File auth_flow.mmd

param(
    [string]$File = ""
)

$scriptDir = $PSScriptRoot
$outDir    = Join-Path $scriptDir "output"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
    Write-Host "Dossier créé : $outDir"
}

# Vérifier que mmdc est installé
if (-not (Get-Command mmdc -ErrorAction SilentlyContinue)) {
    Write-Error "mmdc introuvable. Installez-le avec : npm install -g @mermaid-js/mermaid-cli"
    exit 1
}

if ($File) {
    $diagrams = @(Get-Item (Join-Path $scriptDir $File) -ErrorAction Stop)
} else {
    $diagrams = Get-ChildItem -Path $scriptDir -Filter "*.mmd"
}

if ($diagrams.Count -eq 0) {
    Write-Warning "Aucun fichier .mmd trouvé dans $scriptDir"
    exit 0
}

foreach ($diagram in $diagrams) {
    $outFile = Join-Path $outDir ($diagram.BaseName + ".png")
    Write-Host "  $($diagram.Name)  →  $outFile"
    mmdc -i $diagram.FullName -o $outFile -t default -b white --width 1400
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Erreur lors du rendu de $($diagram.Name)"
    }
}

Write-Host ""
Write-Host "Terminé. Images dans : $outDir"
