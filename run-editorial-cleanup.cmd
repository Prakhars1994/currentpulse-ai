@echo off
setlocal EnableExtensions DisableDelayedExpansion

cd /d "%~dp0"
set "CP_SECRET="
set "CP_SITE=https://currentpulse-ai.vercel.app"
set "CP_APPLY=0"

if /I "%~1"=="apply" set "CP_APPLY=1"

if not exist ".env.local" (
  echo ERROR: .env.local was not found in %CD%
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B /C:"CRON_SECRET=" ".env.local"`) do set "CP_SECRET=%%B"

if not defined CP_SECRET (
  echo ERROR: CRON_SECRET is missing from .env.local.
  exit /b 1
)

for %%S in ("%CP_SECRET%") do set "CP_SECRET=%%~S"

if "%CP_APPLY%"=="1" (
  echo Applying strict editorial cleanup to the latest 120 days...
) else (
  echo Previewing strict editorial cleanup. No database rows will change.
  echo Run this file with: run-editorial-cleanup.cmd apply
)

curl.exe --silent --show-error --fail-with-body --max-time 310 -H "Authorization: Bearer %CP_SECRET%" "%CP_SITE%/api/editorial-cleanup?days=120&limit=3000&apply=%CP_APPLY%"
echo.

endlocal
