<#
.SYNOPSIS
  Runs the Hue Harbor test suites on Windows against real browsers and writes a report you can paste back.

.DESCRIPTION
  Runs the seven Playwright suites (build\test*.py) against
    - Playwright's Firefox build            (-Browsers firefox)
    - the installed Microsoft Edge           (-Browsers msedge, Playwright "msedge" channel, no download)
  and the Developer Edition smoke test (build\test_ffdev.py) via Selenium against the real
  Firefox Developer Edition install        (-Browsers ffdev).

  Creates a private venv at build\.venv-win (gitignored), installs playwright + selenium + pillow + numpy,
  downloads Playwright's Firefox/Chromium once (skip with -SkipInstall), keeps going when a suite fails,
  and writes:
    shots\windows_report.txt     summary + environment + tail of failing logs   <- paste this back
    shots\windows_logs\*.log     full output per suite per browser

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File build\run_tests_windows.ps1
  powershell -ExecutionPolicy Bypass -File build\run_tests_windows.ps1 -Browsers msedge -Only test_preview.py
  powershell -ExecutionPolicy Bypass -File build\run_tests_windows.ps1 -SkipInstall -FFDevBin "D:\Apps\FirefoxDev\firefox.exe"

.PARAMETER Browsers   Comma-separated subset of firefox,msedge,ffdev (default: all three).
.PARAMETER Only       Run just one suite, e.g. test_preview.py (ffdev ignores this).
.PARAMETER FFDevBin   Path to Firefox Developer Edition firefox.exe (a PortableApps FirefoxPortable.exe is resolved to the firefox.exe it wraps).
.PARAMETER SkipInstall  Skip pip install / playwright install (after the first successful run). Ignored when the venv is
                        missing the packages, e.g. in a freshly unzipped copy of the repo.
.PARAMETER Geckodriver  Optional geckodriver.exe path; by default Selenium Manager fetches one.
#>
[CmdletBinding()]
param(
  [string[]]$Browsers = @('firefox', 'msedge', 'ffdev'),
  [string]$Only = '',
  [string]$FFDevBin = "$env:ProgramFiles\Firefox Developer Edition\firefox.exe",
  [string]$Geckodriver = '',
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
# The test scripts print characters outside cp1252 (arrows, ticks); make Python and the console use UTF-8.
$env:PYTHONUTF8 = '1'; $env:PYTHONIOENCODING = 'utf-8'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$Browsers = @($Browsers | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ })
$Suites = @('test.py', 'test_export.py', 'test_bg.py', 'test_ff_probe.py', 'test_preview.py', 'test_perf.py', 'test_magnify.py')
if ($Only) { $Suites = @($Suites | Where-Object { $_ -ieq $Only }); if (-not $Suites) { Write-Error "Unknown suite '$Only'"; exit 2 } }

$LogDir = Join-Path $Root 'shots\windows_logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Report = Join-Path $Root 'shots\windows_report.txt'
$VenvDir = Join-Path $Root 'build\.venv-win'
$IsWin = ($env:OS -eq 'Windows_NT')
$Sep = '-' * 78

function Say($m) { Write-Host $m }

# ---------- Python / venv ----------
$PyBoot = $null
foreach ($cand in @(@('py', '-3'), @('python', $null), @('python3', $null))) {
  $exe = $cand[0]; $arg = $cand[1]
  if (Get-Command $exe -ErrorAction SilentlyContinue) {
    try {
      $v = if ($arg) { & $exe $arg -c 'import sys;print(sys.version_info[0])' 2>$null } else { & $exe -c 'import sys;print(sys.version_info[0])' 2>$null }
      if ("$v".Trim() -eq '3') { $PyBoot = @{ Exe = $exe; Args = @($arg | Where-Object { $_ }) }; break }
    } catch {}
  }
}
if (-not $PyBoot) { Write-Error 'Python 3 not found. Install it from https://www.python.org/downloads/ (tick "Add python.exe to PATH" / py launcher) and rerun.'; exit 2 }

$VenvPy = if ($IsWin) { Join-Path $VenvDir 'Scripts\python.exe' } else { Join-Path $VenvDir 'bin/python' }
if (-not (Test-Path $VenvPy)) {
  Say "Creating venv at $VenvDir ..."
  & $PyBoot.Exe @($PyBoot.Args + @('-m', 'venv', $VenvDir))
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $VenvPy)) { Write-Error 'venv creation failed'; exit 2 }
}

$NeedPw = ($Browsers -contains 'firefox') -or ($Browsers -contains 'msedge')
if ($SkipInstall) {
  # The venv lives inside the repo (build\.venv-win): a freshly unzipped copy has an empty one, so -SkipInstall must not skip then
  & $VenvPy -c 'import playwright, selenium, PIL, numpy' 2>$null
  if ($LASTEXITCODE -ne 0) { Say '-SkipInstall given but the venv has no playwright/selenium yet (new checkout?): installing anyway'; $SkipInstall = $false }
}
if (-not $SkipInstall) {
  Say 'Installing/updating playwright, selenium, pillow, numpy in the venv ...'
  & $VenvPy -m pip install --quiet --upgrade pip playwright selenium pillow numpy
  if ($LASTEXITCODE -ne 0) { Write-Error 'pip install failed'; exit 2 }
  if ($NeedPw) {
    Say 'Downloading Playwright Firefox + Chromium (once; Edge uses your installed browser) ...'
    & $VenvPy -m playwright install firefox chromium
    if ($LASTEXITCODE -ne 0) { Write-Error 'playwright install failed'; exit 2 }
  }
}

# ---------- environment info ----------
function FileVersion($path) {
  if ($path -and (Test-Path $path)) { try { return (Get-Item $path).VersionInfo.ProductVersion } catch { return '?' } }
  return 'not found'
}
# A PortableApps launcher (FirefoxPortable.exe) reports its own version (2.x) and cannot be driven: use the real firefox.exe inside it
if ($FFDevBin -and ((Split-Path -Leaf $FFDevBin) -ieq 'FirefoxPortable.exe')) {
  $pd = Split-Path -Parent $FFDevBin
  foreach ($cand in @((Join-Path $pd 'App\Firefox64\firefox.exe'), (Join-Path $pd 'App\Firefox\firefox.exe'))) {
    if (Test-Path $cand) { Say "Portable Firefox launcher given; using $cand"; $FFDevBin = $cand; break }
  }
}
$EdgeExe = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
$PyVer = (& $VenvPy -c 'import sys;print(sys.version.split()[0])' 2>$null)
$PwVer = "$(& $VenvPy -m playwright --version 2>&1)".Replace('Version ', '').Trim()
$SeVer = (& $VenvPy -c 'import selenium;print(selenium.__version__)' 2>$null)
$OsInfo = if ($IsWin) { try { (Get-CimInstance Win32_OperatingSystem).Caption + ' ' + (Get-CimInstance Win32_OperatingSystem).Version } catch { [Environment]::OSVersion.VersionString } } else { [Environment]::OSVersion.VersionString }
$EnvLines = @(
  "Hue Harbor Windows test report  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  "Repo:        $Root",
  "Git:         $(try { (git rev-parse --short HEAD 2>$null) + ' ' + (git rev-parse --abbrev-ref HEAD 2>$null) } catch { 'n/a' })",
  "OS:          $OsInfo",
  "PowerShell:  $($PSVersionTable.PSVersion)",
  "Python:      $PyVer   Playwright: $PwVer   Selenium: $SeVer",
  "Edge:        $(FileVersion $EdgeExe)  $EdgeExe",
  "FF Dev Ed.:  $(FileVersion $FFDevBin)  $FFDevBin",
  "Browsers:    $($Browsers -join ', ')   Suites: $($Suites -join ', ')"
)
$EnvLines | ForEach-Object { Say $_ }

# ---------- run ----------
$Results = @()
function Run-One($label, $browser, $script, $envMap) {
  $log = Join-Path $LogDir ("{0}_{1}.log" -f $browser, ($script -replace '\.py$', ''))
  Say "$Sep`n>> $label  ($script)  ... running, output goes to $(Split-Path -Leaf $log)"
  $saved = @{}
  foreach ($k in $envMap.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k); [Environment]::SetEnvironmentVariable($k, $envMap[$k]) }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  # Run through cmd.exe so stdout+stderr land in the log as plain UTF-8 text (Windows PowerShell 5.1 would otherwise
  # wrap every stderr line in a red NativeCommandError record).
  $scriptPath = Join-Path $Root "build\$script"
  if ($IsWin) {
    & cmd.exe /d /c "`"$VenvPy`" `"$scriptPath`" > `"$log`" 2>&1"
  } else {
    & $VenvPy $scriptPath *> $log
  }
  $code = $LASTEXITCODE
  $sw.Stop()
  foreach ($k in $envMap.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k]) }
  $text = if (Test-Path $log) { Get-Content $log -Raw -Encoding UTF8 } else { '' }
  $okN = ([regex]::Matches($text, '(?m)^ok\b')).Count
  $failN = ([regex]::Matches($text, '(?m)^FAIL\b')).Count
  $status = if ($code -eq 0) { 'PASS' } else { 'FAIL' }
  Say ("   {0}  exit={1}  {2:n1}s  ok-lines={3} fail-lines={4}" -f $status, $code, $sw.Elapsed.TotalSeconds, $okN, $failN)
  $script:Results += [pscustomobject]@{ Browser = $browser; Suite = $script; Status = $status; Exit = $code; Seconds = [math]::Round($sw.Elapsed.TotalSeconds, 1); Ok = $okN; Fail = $failN; Log = $log }
}

foreach ($b in $Browsers) {
  switch ($b) {
    'firefox' { foreach ($s in $Suites) { Run-One "Playwright Firefox" 'firefox' $s @{ BROWSER = 'firefox' } } }
    'msedge' {
      if (-not $EdgeExe) { Say 'Microsoft Edge not found - skipping msedge'; $Results += [pscustomobject]@{ Browser = 'msedge'; Suite = '(all)'; Status = 'SKIP'; Exit = -1; Seconds = 0; Ok = 0; Fail = 0; Log = '' }; continue }
      foreach ($s in $Suites) { Run-One "Microsoft Edge" 'msedge' $s @{ BROWSER = 'msedge' } }
    }
    'ffdev' {
      if (-not (Test-Path $FFDevBin)) { Say "Firefox Developer Edition not found at $FFDevBin - skipping ffdev (use -FFDevBin)"; $Results += [pscustomobject]@{ Browser = 'ffdev'; Suite = 'test_ffdev.py'; Status = 'SKIP'; Exit = -1; Seconds = 0; Ok = 0; Fail = 0; Log = '' }; continue }
      $e = @{ FFDEV_BIN = $FFDevBin }
      if ($Geckodriver) { $e['GECKODRIVER'] = $Geckodriver } else { $e['GECKODRIVER'] = $null }
      Run-One "Firefox Developer Edition (Selenium)" 'ffdev' 'test_ffdev.py' $e
    }
    default { Say "Unknown browser '$b' (use firefox, msedge, ffdev)" }
  }
}

# ---------- report ----------
$Table = $Results | Format-Table Browser, Suite, Status, Exit, Seconds, Ok, Fail -AutoSize | Out-String
$Failed = @($Results | Where-Object { $_.Status -eq 'FAIL' })
$Lines = @() + $EnvLines + '' + $Table.TrimEnd() + ''
$Lines += "Totals: $(@($Results | Where-Object Status -eq 'PASS').Count) passed, $($Failed.Count) failed, $(@($Results | Where-Object Status -eq 'SKIP').Count) skipped"
foreach ($f in $Failed) {
  $Lines += ''; $Lines += "$Sep"; $Lines += "LAST 40 LINES: $($f.Browser) / $($f.Suite)  ($($f.Log))"
  if (Test-Path $f.Log) { $Lines += (Get-Content $f.Log -Tail 40 -Encoding UTF8) }
}
$Lines | Set-Content -Path $Report -Encoding UTF8
Say $Sep
Say $Table
Say "Report written to: $Report"
if ($Failed.Count -gt 0) { Say "RESULT: $($Failed.Count) suite(s) FAILED"; exit 1 }
Say 'RESULT: all run suites passed'
exit 0
