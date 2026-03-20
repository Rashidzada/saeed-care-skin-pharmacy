# Saeed Skin Care Pharmacy

Professional pharmacy management software for medicine inventory, point-of-sale, purchases, suppliers, customers, reports, and printable invoices.

This project is a full-stack medical store management system customized for **Saeed Skin Care Pharmacy**. It provides a branded login experience, role-based access, live sales and purchase workflows, stock alerts, reporting, and invoice generation.

## Overview

The system is designed for day-to-day pharmacy operations:

- manage medicines with stock, expiry, pricing, supplier, and batch tracking
- create sales with a cart-based workflow and printable tax invoices
- record purchases and automatically increase stock
- manage suppliers, customers, and users
- view dashboard analytics, stock alerts, and sales reports
- export CSV reports and generate PDF documents

## Key Features

### Pharmacy Operations

- Medicine inventory with expiry dates, batch numbers, quantities, and minimum stock thresholds
- POS / New Sale screen with medicine search, cart, tax, discount, and customer selection
- Sales history with invoice printing and admin-only void support
- Purchase entry with supplier reference, batch number, and expiry tracking

### Business Visibility

- Dashboard cards for revenue, transactions, stock alerts, and expiry alerts
- Daily sales, monthly sales, stock, and expiry reports
- CSV export for daily sales and stock reports
- Sidebar alert badge for low-stock and near-expiry medicines

### Access and Security

- JWT-based authentication
- Role-based access for admin, staff, and viewer roles
- Session restore on refresh
- Admin user management with activate/deactivate actions

### Branding

- Customized for **Saeed Skin Care Pharmacy**
- Store details used on-screen and on generated invoices
- One-click local startup using `start.bat`

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, React Query, React Hook Form, Zod, Recharts |
| Backend | Django 4.2, Django REST Framework, Simple JWT |
| Database | PostgreSQL |
| Auth | JWT access and refresh tokens |
| PDF / Documents | HTML templates rendered as invoices and purchase orders |
| Infra | Docker, Docker Compose, Nginx, Gunicorn |

## Project Structure

```text
msms/
|- backend/
|  |- apps/
|  |  |- accounts/
|  |  |- medicines/
|  |  |- suppliers/
|  |  |- customers/
|  |  |- sales/
|  |  |- purchases/
|  |  `- reports/
|  |- msms_project/
|  `- templates/invoices/
|- frontend/
|  |- src/
|  |  |- api/
|  |  |- components/
|  |  |- config/
|  |  |- context/
|  |  `- pages/
|  `- favicon.svg
|- docker-compose.yml
|- nginx.conf
`- start.bat
```

## Screens and Modules

- `Dashboard` - summary cards, alerts, and revenue chart
- `Medicines` - inventory management and stock filtering
- `New Sale` - sales workflow with cart and invoice generation
- `Sales History` - transaction review, print, and void flow
- `Purchases` - supplier purchase recording
- `Suppliers` - supplier records and medicine counts
- `Customers` - customer records and purchase counts
- `Reports` - daily, monthly, stock, and expiry reporting
- `User Management` - role-based user administration

## Quick Start

### Option 1: One click on Windows

Double-click:

```text
start.bat
```

This starts:

- backend at `http://localhost:8000`
- frontend at `http://localhost:5151`

It also opens the application in your browser and avoids starting duplicate processes if the ports are already in use.

### Option 2: Local development

#### Backend

```powershell
cd backend
.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000 --noreload
```

If dependencies are not installed yet:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver 0.0.0.0:8000 --noreload
```

#### Frontend

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Frontend local URL:

```text
http://localhost:5151
```

### Option 3: Docker

```powershell
docker-compose up --build
```

Then open:

- Frontend: `http://localhost`
- Backend API: `http://localhost:8000/api/v1/`
- Django Admin: `http://localhost:8000/admin/`

## Default Login

After seeding sample data, the project includes:

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `Admin@1234` |
| Staff | `staff` | `Staff@1234` |

## Configuration

### Store Branding

Current store configuration:

- Store name: `Saeed Skin Care Pharmacy`
- Address: `Opposite RHC Hospital, Deolai Colony`
- Contact: `0318 9413433 | 0346 9413433`

These values are used by the frontend branding and invoice templates.

### Important Environment Variables

| Variable | Description | Example |
| --- | --- | --- |
| `SECRET_KEY` | Django secret key | `django-insecure-...` |
| `DEBUG` | Django debug mode | `True` |
| `DB_NAME` | PostgreSQL database name | `msms` |
| `DB_USER` | PostgreSQL username | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origins | `http://localhost:5151,http://localhost:5173` |
| `VITE_API_BASE_URL` | Frontend API base URL | `http://localhost:8000` |
| `STORE_NAME` | Store name for invoices | `Saeed Skin Care Pharmacy` |
| `STORE_ADDRESS` | Store address for invoices | `Opposite RHC Hospital, Deolai Colony` |
| `STORE_PHONE` | Store contact numbers | `0318 9413433 | 0346 9413433` |
| `STORE_EMAIL` | Store email for invoices | optional |

### Environment Files

- Root `.env` - shared local project defaults
- `backend/.env` - Django runtime settings
- `frontend/.env` - frontend environment values

## API Highlights

Base path:

```text
/api/v1/
```

### Authentication

- `POST /auth/login/`
- `POST /auth/refresh/`
- `POST /auth/logout/`
- `GET /auth/me/`

### Medicines

- `GET /medicines/`
- `POST /medicines/`
- `GET /medicines/{id}/`
- `PATCH /medicines/{id}/`
- `DELETE /medicines/{id}/`

### Sales

- `GET /sales/`
- `POST /sales/`
- `POST /sales/{id}/void/`
- `GET /sales/{id}/invoice/`

### Purchases

- `GET /purchases/`
- `POST /purchases/`
- `GET /purchases/{id}/invoice/`

### Reports

- `GET /reports/dashboard/`
- `GET /reports/daily-sales/`
- `GET /reports/monthly-sales/`
- `GET /reports/stock/`
- `GET /reports/expiry/`
- `GET /reports/daily-sales/export/`
- `GET /reports/stock/export/`

## Development Notes

- Frontend dev server runs on port `5151`
- Backend dev server runs on port `8000`
- Frontend uses Vite proxying in development
- JWT refresh handling is configured so the user stays signed in on browser refresh
- Sidebar route highlighting is configured with exact matching for smoother navigation

## Generated Documents

The backend includes branded templates for:

- sale invoices
- purchase orders

Documents include the configured store name, address, and contact numbers.

## Quality Checks

Useful verification commands:

```powershell
cd frontend
npm run build
```

```powershell
cd backend
.\venv\Scripts\python.exe manage.py check
```

## Troubleshooting

### Frontend opens but login fails

Check:

- backend is running on port `8000`
- frontend is running on port `5151`
- PostgreSQL is available

### Browser refresh logs the user out

This project already includes refresh-token rotation handling and session restore logic. If it still happens after a code change, log in once again and retest.

### `start.bat` says ports are already in use

That usually means the app is already running. Open:

```text
http://localhost:5151
```

## Repository Purpose

This repository contains the customized pharmacy management system for **Saeed Skin Care Pharmacy**, prepared for local development, branded operation, and deployment-ready extension.
