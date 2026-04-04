param(
    [string]$OutputDir = (Join-Path $PSScriptRoot "..\dist")
)

$ErrorActionPreference = "Stop"

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$manifestPath = Join-Path $projectRoot "manifest.json"

if (-not (Test-Path $manifestPath)) {
    throw "manifest.json not found at $manifestPath"
}

$manifestRaw = Get-Content $manifestPath -Raw
$versionMatch = [regex]::Match($manifestRaw, '"version"\s*:\s*"([^"]+)"')
if (-not $versionMatch.Success) {
    throw "Could not read version from manifest.json"
}
$version = $versionMatch.Groups[1].Value
$zipName = "krw-master-pro-v$version.zip"
$outputRoot = [System.IO.Path]::GetFullPath($OutputDir)
$zipPath = Join-Path $outputRoot $zipName
$stagingDir = Join-Path ([System.IO.Path]::GetTempPath()) ("krw-master-pro-" + [System.Guid]::NewGuid().ToString("N"))

$includeFiles = @(
    "manifest.json",
    "background.js",
    "content.js",
    "logger.js",
    "popup-core.js",
    "popup.css",
    "popup.html",
    "popup.js",
    "icon16.png",
    "icon48.png",
    "icon128.png"
)

$includeDirs = @(
    "images"
)

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

try {
    foreach ($file in $includeFiles) {
        $source = Join-Path $projectRoot $file
        if (-not (Test-Path $source)) {
            throw "Missing required release file: $file"
        }

        Copy-Item -Path $source -Destination (Join-Path $stagingDir $file) -Force
    }

    foreach ($dir in $includeDirs) {
        $source = Join-Path $projectRoot $dir
        if (-not (Test-Path $source)) {
            throw "Missing required release directory: $dir"
        }

        Copy-Item -Path $source -Destination (Join-Path $stagingDir $dir) -Recurse -Force
    }

    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }

    Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
    Write-Host "Release package created: $zipPath"
}
finally {
    if (Test-Path $stagingDir) {
        Remove-Item $stagingDir -Recurse -Force
    }
}
