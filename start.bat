@echo off
setlocal

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"
set "BACKEND_PY=%BACKEND_DIR%\venv\Scripts\python.exe"

if not exist "%BACKEND_DIR%\manage.py" (
  echo [ERROR] Backend folder not found at "%BACKEND_DIR%".
  pause
  exit /b 1
)

if not exist "%BACKEND_PY%" (
  echo [ERROR] Backend Python not found at "%BACKEND_PY%".
  echo Create the virtual environment or install dependencies first.
  pause
  exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
  echo [ERROR] Frontend folder not found at "%FRONTEND_DIR%".
  pause
  exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm.cmd was not found. Install Node.js first.
  pause
  exit /b 1
)

set "BACKEND_PID="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "(Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1)"`) do set "BACKEND_PID=%%P"

if defined BACKEND_PID (
  echo [INFO] Backend already running on port 8000 ^(PID %BACKEND_PID%^).
) else (
  echo [INFO] Starting backend...
  start "MSMS Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && ""%BACKEND_PY%"" manage.py runserver 0.0.0.0:8000 --noreload"
)

set "FRONTEND_PID="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "(Get-NetTCPConnection -State Listen -LocalPort 5151 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1)"`) do set "FRONTEND_PID=%%P"

if defined FRONTEND_PID (
  echo [INFO] Frontend already running on port 5151 ^(PID %FRONTEND_PID%^).
) else (
  echo [INFO] Starting frontend...
  start "MSMS Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm.cmd run dev -- --host 0.0.0.0"
)

echo [INFO] Opening application in your browser...
start "" "http://localhost:5151"

echo.
echo [DONE] Use this file again any time to start the project.
exit /b 0
