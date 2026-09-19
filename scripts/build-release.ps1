<#
.SYNOPSIS
  Builds the signed Play Store release for Khata Ledger.

.DESCRIPTION
  Runs the whole pipeline in one go:
    1. verify  — ledger engine checks (a failure here aborts the build)
    2. vite    — production web bundle into dist/
    3. sync    — copy dist/ into the Android project
    4. gradle  — signed .aab (for Play) and .apk (for sideloading)

  Outputs land in build-output/.

.PARAMETER SkipTests
  Build without running the verification checks first.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\build-release.ps1
#>
param(
    [switch]$SkipTests,
    [switch]$ApkOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# Android Gradle Plugin 8.9 requires JDK 17; the JDK on PATH may be newer.
$jdk = 'C:\Users\HP\jdk17\jdk-17.0.20.1+1'
$sdk = 'C:\Users\HP\.android-sdk'

if (-not (Test-Path "$jdk\bin\java.exe")) { throw "JDK 17 not found at $jdk" }
if (-not (Test-Path $sdk)) { throw "Android SDK not found at $sdk" }

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:PATH = "$jdk\bin;$env:PATH"

function Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }

if (-not $SkipTests) {
    Step 1 'Verifying ledger engine'
    & node "$root\scripts\verify-ledger-engine.mjs"
    if ($LASTEXITCODE -ne 0) { throw 'Ledger engine checks failed — refusing to build a release.' }
} else {
    Write-Host "`n[1] Skipping verification (-SkipTests)" -ForegroundColor Yellow
}

Step 2 'Building web bundle'
Push-Location $root
try {
    & npx vite build
    if ($LASTEXITCODE -ne 0) { throw 'Vite build failed.' }

    Step 3 'Syncing web assets into the Android project'
    & npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
} finally {
    Pop-Location
}

Step 4 'Assembling signed release'
Push-Location "$root\android"
try {
    $tasks = if ($ApkOnly) { @('assembleRelease') } else { @('bundleRelease', 'assembleRelease') }
    & "$root\android\gradlew.bat" clean @tasks --no-daemon
    if ($LASTEXITCODE -ne 0) { throw 'Gradle release build failed.' }
} finally {
    Pop-Location
}

Step 5 'Verifying the release signature'
$apk = "$root\android\app\build\outputs\apk\release\app-release.apk"
$aab = "$root\android\app\build\outputs\bundle\release\app-release.aab"

$buildToolsDir = Get-ChildItem "$sdk\build-tools" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$apksigner = "$sdk\build-tools\$($buildToolsDir.Name)\lib\apksigner.jar"

if ((Test-Path $apk) -and (Test-Path $apksigner)) {
    $verifyOutput = & "$jdk\bin\java.exe" -jar $apksigner verify --print-certs $apk 2>&1
    $dnLine = $verifyOutput | Select-String 'certificate DN:'

    # A debug-signed release cannot be uploaded to Play and, worse, is a silent
    # failure mode if a keystore misconfiguration falls through unnoticed — so
    # this check turns that into a hard build failure instead of a surprise at
    # upload time.
    if ($dnLine -match 'CN=Android Debug') {
        throw "Release APK is signed with the DEBUG key, not the release keystore. Check android/keystore.properties and android/app/release.keystore. $dnLine"
    }
    Write-Host "  Signer: $dnLine" -ForegroundColor Green
} else {
    Write-Host '  Could not locate apksigner to verify the signature — check manually before uploading.' -ForegroundColor Yellow
}

Step 6 'Collecting artefacts'
$out = Join-Path $root 'build-output'
New-Item -ItemType Directory -Force -Path $out | Out-Null

if (Test-Path $apk) {
    Copy-Item $apk "$out\Khata-Ledger-release.apk" -Force
    Write-Host "  APK  $out\Khata-Ledger-release.apk ($([math]::Round((Get-Item $apk).Length / 1MB, 2)) MB)"
}
if (Test-Path $aab) {
    Copy-Item $aab "$out\Khata-Ledger-release.aab" -Force
    Write-Host "  AAB  $out\Khata-Ledger-release.aab ($([math]::Round((Get-Item $aab).Length / 1MB, 2)) MB)"
}

Write-Host "`nDone. Upload the .aab to the Play Console; the .apk is for sideloading only." -ForegroundColor Green
