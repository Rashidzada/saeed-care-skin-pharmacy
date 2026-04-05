@echo off
setlocal

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

cd /d "%ROOT%"

if not exist "%ROOT%\docker-compose.yml" (
  echo [ERROR] docker-compose.yml was not found in "%ROOT%".
  echo Make sure this file stays in the project root folder.
  pause
  exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker was not found.
  echo Install Docker Desktop first, then run this file again.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker Desktop is not running.
  echo Start Docker Desktop, wait until it is ready, then run this file again.
  pause
  exit /b 1
)

set "COMPOSE_MODE="
docker compose version >nul 2>&1
if not errorlevel 1 set "COMPOSE_MODE=v2"

if not defined COMPOSE_MODE (
  docker-compose --version >nul 2>&1
  if not errorlevel 1 set "COMPOSE_MODE=v1"
)

if not defined COMPOSE_MODE (
  echo [ERROR] Docker Compose is not available.
  echo Update Docker Desktop or install docker-compose, then run this file again.
  pause
  exit /b 1
)

if not exist "%ROOT%\.env" (
  if exist "%ROOT%\.env.example" (
    copy /Y "%ROOT%\.env.example" "%ROOT%\.env" >nul
    echo [INFO] Created .env from .env.example.
  ) else (
    echo [ERROR] .env.example was not found, so .env could not be created.
    pause
    exit /b 1
  )
)

echo [INFO] Starting MSMS with Docker...

if "%COMPOSE_MODE%"=="v2" (
  docker compose up -d
) else (
  docker-compose up -d
)

if errorlevel 1 (
  echo [ERROR] Docker containers could not be started.
  echo Check the Docker output above for the failing service.
  pause
  exit /b 1
)

echo [INFO] Waiting a few seconds for services to come online...
timeout /t 5 /nobreak >nul

echo [INFO] Opening the application in your browser...
start "" "http://localhost"

echo.
echo [DONE] MSMS is starting with Docker.
echo [TIP] Use this file for normal daily startup.
echo [TIP] If you update the software files later, run rebuild_docker.bat once.
echo [TIP] First-time demo users can be created with:
echo       docker compose exec backend python manage.py seed_data
echo [TIP] To stop the software later, run:
echo       docker compose down
exit /b 0
