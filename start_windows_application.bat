@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "APP_EXE=%ROOT%windows_application\build\windows\x64\runner\Release\saeed_pharmacy_windows.exe"

if not exist "%APP_EXE%" (
  echo Windows application executable not found:
  echo %APP_EXE%
  echo Build it first with:
  echo   cd /d "%ROOT%windows_application"
  echo   flutter build windows --release
  pause
  exit /b 1
)

for /f %%P in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue ^| Select-Object -First 1 -ExpandProperty OwningProcess; if ($p) { $p }"') do set "BACKEND_PID=%%P"

if not defined BACKEND_PID (
  echo Starting Django backend on port 8000...
  start "Saeed Backend" /min cmd /c "cd /d ""%BACKEND_DIR%"" && set DEBUG=True && venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000 --noreload"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(20); do { $ready = Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue; if ($ready) { exit 0 }; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline); exit 1"
  if errorlevel 1 (
    echo Backend did not start on port 8000.
    pause
    exit /b 1
  )
) else (
  echo Backend already running on port 8000.
)

echo Launching Saeed Pharmacy Windows...
start "" "%APP_EXE%"

endlocal
