@echo off
setlocal EnableExtensions DisableDelayedExpansion

cd /d "%~dp0"
set "CP_SECRET="
set "CP_SITE=https://currentpulse-ai.vercel.app"

if not exist ".env.local" (
  echo ERROR: .env.local was not found in %CD%
  echo Put this CMD file in the project root beside .env.local.
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B /C:"CRON_SECRET=" ".env.local"`) do set "CP_SECRET=%%B"

if not defined CP_SECRET (
  echo ERROR: CRON_SECRET is missing from .env.local.
  exit /b 1
)

for %%S in ("%CP_SECRET%") do set "CP_SECRET=%%~S"

echo [1/3] Collecting all configured News and Current Affairs sources...
curl.exe --silent --show-error --fail-with-body --max-time 310 -H "Authorization: Bearer %CP_SECRET%" "%CP_SITE%/api/auto-publish?wait=1"
if errorlevel 1 exit /b 1
echo.

echo [2/3] Processing the publishing queue in four safe sequential runs...
for /L %%N in (1,1,4) do (
  echo Queue run %%N of 4
  curl.exe --silent --show-error --fail-with-body --max-time 310 -H "Authorization: Bearer %CP_SECRET%" "%CP_SITE%/api/process-queue?wait=1"
  if errorlevel 1 exit /b 1
  echo.
)

echo [3/3] Current automation status...
curl.exe --silent --show-error --fail-with-body --max-time 60 "%CP_SITE%/api/automation-status"
echo.
echo Finished.

endlocal
