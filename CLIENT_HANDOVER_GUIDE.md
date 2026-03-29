# Client Handover Guide

This project is a pharmacy management system with:

- a Django + PostgreSQL backend
- a React web frontend
- a Flutter Windows desktop app

Do not hand the raw repository to a client without deciding which deployment model you are giving them. This repo contains developer tooling, local scripts, and sample seed credentials.

## What Your Client Actually Needs

Your client needs these six things:

1. A running backend server
2. A PostgreSQL database
3. At least one client application
4. Real login accounts
5. A backup and restore plan
6. A short operating guide

## Choose One Delivery Model First

### Option A: Single-PC Windows desktop setup

Use this only if one Windows PC will run both the backend and the desktop app locally.

Client needs:

- Windows machine
- Python 3.11
- PostgreSQL
- backend virtual environment in `backend/venv`
- built desktop app release folder from `windows_application/build/windows/x64/runner/Release/`
- configured `.env`

Important:

- the desktop app defaults to `http://127.0.0.1:8000/api/v1`
- `start_windows_application.bat` expects the backend to run on the same PC
- this is not the best option for multiple cashier PCs unless you rebuild the desktop app for a shared server URL

### Option B: Web app on one central server

Use this if multiple users will open the system in browsers from different PCs.

Client needs:

- one always-on server or office PC
- PostgreSQL
- backend service
- frontend served from the same host or reverse-proxied
- browser access from staff PCs

Recommended when:

- more than one user needs the system
- staff use different PCs
- you want simpler rollout and updates

### Option C: Docker-based server deployment

Use this when you want a cleaner server setup and easier service restarts.

Client needs:

- Docker Desktop or Docker Engine
- one machine for containers
- `.env` configured for that machine
- database volume backup process

Important:

- current `docker-compose.yml` uses `DJANGO_SETTINGS_MODULE=msms_project.settings.dev`
- for a real production handover, switch to `msms_project.settings.prod` and set secure environment values

## Minimum Deliverables You Should Hand Over

Prepare and give the client these items:

- the deployment package they will actually run
- a filled production `.env`
- the PostgreSQL database dump
- the admin username and password
- staff usernames and passwords
- store branding values
- startup instructions
- shutdown instructions
- backup instructions
- restore instructions
- your support contact and warranty period if applicable

## Files and Values You Must Prepare

From this codebase, the client deployment needs these values configured:

- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `STORE_NAME`
- `STORE_ADDRESS`
- `STORE_PHONE`
- `STORE_EMAIL`

For web builds:

- `VITE_API_BASE_URL` only if the frontend is hosted separately from the backend
- if frontend and backend are on the same host, the web app now works with the default same-origin `/api` path

For Windows desktop builds:

- rebuild with `--dart-define API_BASE_URL=http://SERVER_IP:8000/api/v1` if the backend will run on a different machine

Example:

```powershell
cd windows_application
flutter build windows --release --dart-define API_BASE_URL=http://192.168.1.10:8000/api/v1
```

## Accounts and Roles

The system has these roles:

- `admin`
- `staff`
- `viewer`

Current practical guidance:

- give `admin` only to the owner or manager
- give `staff` to cashier and operating staff
- do not ship default sample passwords
- change all passwords before handover

Important current caveat:

- the backend currently allows any authenticated user to create sales
- because of that, do not rely on `viewer` as a strict read-only role until role permissions are tightened further

## What the Client Does Not Need

The client does not need these unless they are also maintaining the source code:

- Node.js
- npm
- Flutter SDK
- frontend source code build workflow
- backend source code editing workflow

They only need those tools if you are giving them the raw development setup instead of a prepared deployment.

## Recommended Handover Checklist

Before delivery:

- choose deployment model
- set a new `SECRET_KEY`
- set `DEBUG=False` for production
- fill real `ALLOWED_HOSTS`
- fill real `CORS_ALLOWED_ORIGINS` if needed
- create a clean PostgreSQL database
- run migrations
- create real admin and staff users
- remove or ignore seed sample credentials
- set store branding values
- test login
- test medicine create and edit
- test sale create
- test purchase create
- test payment recording
- test return workflows
- test invoice PDF generation
- test compact receipt printing
- test daily and stock CSV export
- test backup and restore once

At handover time:

- give the client the URL or desktop shortcut
- give admin credentials in a secure way
- give staff credentials in a secure way
- show how to start and stop the system
- show how to take a database backup
- show how to restore a backup
- show how to print invoice and receipt
- show how to add new users
- show who to contact for support

After handover:

- change any temporary passwords
- schedule regular backups
- keep one restore-tested backup copy off the main machine
- document every environment value somewhere safe

## Recommended Deployment by Scenario

If the client has one machine only:

- use the Windows desktop app with a local backend

If the client has multiple PCs in one shop:

- use the web app on one office/server machine
- or rebuild the Windows app to point to a shared LAN server

If the client may expand later:

- prefer the web deployment first
- keep the desktop app as an optional extra

## Commands You Will Likely Use Before Delivery

Backend setup:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
```

Web frontend development build:

```powershell
cd frontend
npm install
npm run build
```

Windows desktop build:

```powershell
cd windows_application
flutter pub get
flutter build windows --release
```

Docker start:

```powershell
docker-compose up --build
```

## Best Practical Recommendation

For most real client handovers, the safest approach for this repository today is:

1. Deploy the backend and PostgreSQL on one dedicated machine
2. Use the web frontend for daily access from multiple PCs
3. Keep the Windows app only for a single-PC or specially rebuilt setup
4. Hand over a backup routine and real credentials, not the raw developer repo

## Final Warning Before You Deliver

Do not give the client this project with only:

- the source code
- default passwords
- `DEBUG=True`
- no backup routine
- no decision about web vs desktop deployment

That would be a developer transfer, not a client handover.
