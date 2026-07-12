param(
  [string]$Version = "0.1.0"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Dist = Join-Path $Root "release-packages"
$BrowserSrc = Join-Path $Root "plugins/legacy/browser-extension/synapdome-browser-extension"
$BurpSrc = Join-Path $Root "plugins/legacy/burp-suite/synapdome-burp-extension"
$BurpBuild = Join-Path $BurpSrc "build"
$BurpClasses = Join-Path $BurpBuild "classes"

function Invoke-Native {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

New-Item -ItemType Directory -Force -Path $Dist | Out-Null

$BrowserZip = Join-Path $Dist "synapdome-browser-extension-v$Version.zip"
if (Test-Path $BrowserZip) {
  Remove-Item $BrowserZip -Force
}
Compress-Archive -Path (Join-Path $BrowserSrc "*") -DestinationPath $BrowserZip -Force

$javac = Get-Command javac -ErrorAction SilentlyContinue
$jar = Get-Command jar -ErrorAction SilentlyContinue
if (-not $javac -or -not $jar) {
  throw "Java JDK tools were not found. Install JDK 17+ or set PATH so javac and jar are available."
}

Remove-Item $BurpBuild -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $BurpClasses | Out-Null

$StubSources = Get-ChildItem -Recurse (Join-Path $BurpSrc "src/build-stubs") -Filter *.java | ForEach-Object { $_.FullName }
$MainSources = Get-ChildItem -Recurse (Join-Path $BurpSrc "src/main/java") -Filter *.java | ForEach-Object { $_.FullName }
$AllSources = @($StubSources) + @($MainSources)

$JavacArgs = @("-encoding", "UTF-8", "-d", $BurpClasses) + $AllSources
Invoke-Native $javac.Source $JavacArgs

$BurpJar = Join-Path $Dist "synapdome-burp-extension-v$Version.jar"
if (Test-Path $BurpJar) {
  Remove-Item $BurpJar -Force
}
Invoke-Native $jar.Source @("cfm", $BurpJar, (Join-Path $BurpSrc "MANIFEST.MF"), "-C", $BurpClasses, "com")

Write-Host "Created $BrowserZip"
Write-Host "Created $BurpJar"
