param(
  [string]$InstallDir = (Resolve-Path (Join-Path $PSScriptRoot "..\src-tauri\target\debug")).Path
)

$ErrorActionPreference = "Stop"

function Find-SetupExe {
  param([string]$Root)

  $release = Join-Path $Root "native-messaging-setup.exe"
  if (Test-Path $release) {
    return $release
  }

  $debug = Join-Path $Root "debug\native-messaging-setup.exe"
  if (Test-Path $debug) {
    return $debug
  }

  throw "native-messaging-setup.exe が見つかりません。先に cargo build --manifest-path src-tauri/Cargo.toml --bin native-messaging-setup --bin native-messaging-host を実行してください。"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

cargo build --manifest-path src-tauri/Cargo.toml --bin native-messaging-setup --bin native-messaging-host

$setupExe = Find-SetupExe -Root (Join-Path $repoRoot "src-tauri\target")
$hostExe = Join-Path $InstallDir "native-messaging-host.exe"
$setupTarget = Join-Path $InstallDir "native-messaging-setup.exe"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Force (Join-Path $repoRoot "src-tauri\target\debug\native-messaging-host.exe") $hostExe
Copy-Item -Force $setupExe $setupTarget

& $setupTarget install $InstallDir
if ($LASTEXITCODE -ne 0) {
  throw "Native Messaging Host の dev 登録に失敗しました (exit code: $LASTEXITCODE)。"
}

Write-Host "Native Messaging Host を dev 環境へ登録しました: $InstallDir"
