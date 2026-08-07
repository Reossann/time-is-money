param(
  [string]$InstallDir
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildDir = Join-Path $repoRoot "src-tauri\target\debug"

Set-Location $repoRoot

cargo build --manifest-path src-tauri/Cargo.toml --bin native-messaging-setup --bin native-messaging-host
if ($LASTEXITCODE -ne 0) {
  throw "Failed to build the Native Messaging binaries (exit code: $LASTEXITCODE)."
}

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
  $InstallDir = $buildDir
} else {
  $InstallDir = [System.IO.Path]::GetFullPath($InstallDir)
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

foreach ($binary in @("native-messaging-host.exe", "native-messaging-setup.exe")) {
  $source = Join-Path $buildDir $binary
  $destination = Join-Path $InstallDir $binary

  if ($source -ne $destination) {
    Copy-Item -LiteralPath $source -Destination $destination -Force
  }
}

$setupExe = Join-Path $InstallDir "native-messaging-setup.exe"
& $setupExe install $InstallDir
if ($LASTEXITCODE -ne 0) {
  throw "Failed to register the Native Messaging Host (exit code: $LASTEXITCODE)."
}

Write-Host "Native Messaging Host registered for development: $InstallDir"
