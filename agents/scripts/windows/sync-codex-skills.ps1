param(
  [string]$CodexHome = $env:CODEX_HOME
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($CodexHome)) {
  $CodexHome = Join-Path $HOME ".codex"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$sourceRoot = Join-Path $repoRoot "agents\codex\skills"
$targetRoot = Join-Path $CodexHome "skills"

if (-not (Test-Path $sourceRoot)) {
  throw "Source skill directory not found: $sourceRoot"
}

New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null

Get-ChildItem -Path $sourceRoot -Directory | ForEach-Object {
  $src = $_.FullName
  $dst = Join-Path $targetRoot $_.Name
  if (Test-Path $dst) {
    Remove-Item -Path $dst -Recurse -Force
  }
  Copy-Item -Path $src -Destination $dst -Recurse -Force
  Write-Host "Synced skill: $($_.Name)"
}

Write-Host "Done. Skills synced to $targetRoot"
