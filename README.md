# Saeed Skin Care Pharmacy

Full-stack pharmacy management software for **Saeed Skin Care Pharmacy**, built for daily store operations across web and Windows desktop.

The project now covers medicine inventory, point-of-sale, purchases, customer and supplier ledgers, invoice-based returns, partial and pending payments, dashboard receivables/payables, PDF invoices, compact thermal receipts, and a Flutter Windows desktop app that uses the same Django API.

For a client-ready handover checklist and deployment guidance, see `CLIENT_HANDOVER_GUIDE.md`.

## What This System Handles

- medicine inventory with batch, expiry, supplier, stock level, and low-stock alerts
- cart-based sales workflow with registered customers or walk-in customers
- supplier purchases with stock increase, batch capture, and supplier invoice references
- customer returns from sale history with stock added back automatically
- supplier returns from purchase history with stock reduced automatically
- partial, pending, and paid sales and purchases with real payment entries
- customer and supplier ledger views with full invoice history and pay-now actions
- dashboard visibility for daily sales, receivables, payables, low stock, and reporting
- printable full invoices plus compact thermal-style receipts
- WhatsApp-ready balance summary actions for customers and suppliers
- Windows desktop workflow for pharmacy staff using the same backend and data

## Main Features

### Pharmacy Operations

- medicine management with quantity, expiry, purchase cost, sale price, and supplier linkage
- POS / New Sale screen with search, cart, tax, discount, and customer selection
- sales history with invoice printing, thermal receipt printing, returns, and admin-only voids
- purchase entry with batch number, expiry date, invoice reference, payment status, and notes
- compact receipt output for quick counter printing

### Returns and Adjustments

- customer returns are recorded against the original invoice
- supplier returns are recorded against the original purchase
- stock is updated automatically when returns are saved
- invoice totals, net totals, and outstanding balances update after returns
- return history is visible directly inside invoice detail views

### Payments and Ledgers

- `paid`, `partial`, and `pending` payment states are derived from real payment records
- amount-paid-now support during sale and purchase creation
- later payments can be recorded from invoice history
- customer ledger modal shows:
  - full invoice history
  - total paid
  - total pending
  - pending and partial counts
  - ledger-level payment allocation across oldest open invoices
- supplier ledger modal provides the same workflow for payables
- WhatsApp summary actions generate ready-to-send balance messages using saved phone numbers

### Dashboards and Reports

- dashboard cards for revenue, payments received, customer pending, supplier pending, low stock, and medicine totals
- receivables and payables panels with registered customer balance and supplier balance breakdowns
- daily, monthly, stock, and expiry reporting
- CSV exports for daily sales and stock reports
- report totals reflect returns and payment tracking

### Access and Security

- JWT-based authentication with refresh-token session restore
- role-based access for admin, staff, and viewer roles
- branded login screens for both the web app and the Windows desktop app
- admin user management and activation controls

## Applications Included

### Web Application

- React + Vite frontend for browser-based pharmacy operations
- optimized for daily staff workflows on desktop browsers

### Windows Desktop Application

- Flutter Windows app in `windows_application/`
- shares the same backend, authentication, and pharmacy workflows
- includes dashboard, medicines, customers, suppliers, sales, purchases, reports, and user management screens
- supports sales and purchases history, payment recording, and the updated simplified login UI

## Tech Stack

| Layer | Technology |
| --- | --- |
| Web Frontend | React 18, Vite, Tailwind CSS, React Query, React Hook Form, Zod, Recharts |
| Desktop Frontend | Flutter, Provider, Dio, fl_chart |
| Backend | Django 4.2, Django REST Framework, Simple JWT |
| Database | PostgreSQL |
| Auth | JWT access and refresh tokens |
| Documents | HTML invoice templates, PDF generation, compact thermal receipt HTML |
| Infra | Docker, Docker Compose, Nginx, Gunicorn |

## Project Structure

```text
msms/
|- backend/
|  |- apps/
|  |  |- accounts/
|  |  |- customers/
|  |  |- medicines/
|  |  |- purchases/
|  |  |- reports/
|  |  |- sales/
|  |  `- suppliers/
|  |- msms_project/
|  `- templates/invoices/
|- frontend/
|  `- src/
|     |- api/
|     |- components/
|     |- config/
|     |- context/
|     |- pages/
|     `- utils/
|- windows_application/
|  |- lib/
|  `- windows/
|- start.bat
|- start_windows_application.bat
|- docker-compose.yml
`- nginx.conf
```

## Key Screens and Modules

- `Dashboard` - pharmacy KPIs, receivables, payables, stock alerts, and recent activity
- `Medicines` - inventory, pricing, supplier linkage, and stock filtering
- `New Sale` - customer sale workflow with amount paid now and invoice creation
- `Sales History` - review invoices, record payments, process returns, print invoice or thermal receipt
- `Purchases` - record supplier purchases with payment tracking and return workflow
- `Customers` - customer records, pending balances, full ledger history, and WhatsApp summaries
- `Suppliers` - supplier records, pending payables, full ledger history, and WhatsApp summaries
- `Reports` - daily, monthly, stock, and expiry reports
- `User Management` - role-based user administration
- `Windows Desktop App` - same operational modules for local desktop use

## Quick Start

### Option 1: Start the web system on Windows

Double-click:

```text
start.bat
```

This starts:

- backend at `http://localhost:8000`
- frontend at `http://localhost:5151`

### Option 2: Start the Windows desktop app

Build the desktop app once:

```powershell
cd windows_application
flutter pub get
flutter build windows --release
```

Then launch:

```text
start_windows_application.bat
```

The launcher:

- checks for a release Windows executable
- starts the Django backend on port `8000` if needed
- forces `DEBUG=True` for the launcher-started backend process
- opens the Windows desktop application

### Option 3: Manual local development

#### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver 0.0.0.0:8000 --noreload
```

#### Web frontend

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Web URL:

```text
http://localhost:5151
```

#### Flutter Windows app

```powershell
cd windows_application
flutter pub get
flutter run -d windows
```

### Option 4: Docker

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

These credentials work against both the web frontend and the Windows desktop app because they share the same backend.

## Payment and Return Workflow

### Sales

- create a sale as `paid`, `partial`, or `pending`
- require a registered customer for pending or partial customer balances
- record additional customer payments later from sale history or customer ledger
- process customer returns from the original invoice
- print the full invoice or compact thermal receipt

### Purchases

- create a purchase as `paid`, `partial`, or `pending`
- record later supplier payments from purchase history or supplier ledger
- process supplier returns from the original purchase
- print the full purchase invoice or compact receipt

### Customer and Supplier Ledgers

- full invoice history grouped by account
- running pending totals
- pay-now from the ledger screen
- per-invoice payment actions
- WhatsApp summary buttons for balance communication

## Documents and Printing

The backend now includes branded templates for:

- sale invoices
- purchase invoices
- sale thermal receipts
- purchase thermal receipts

The compact receipts are lightweight HTML documents intended for browser or system printing, including thermal-printer-friendly small invoice layouts.

## Configuration

### Store Branding

Current store configuration:

- Store name: `Saeed Skin Care Pharmacy`
- Address: `Opposite RHC Hospital, Deolai Colony`
- Contact: `0318 9413433 | 0346 9413433`

These values are used in the branded UI, invoices, receipts, and WhatsApp summaries.

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
| `STORE_ADDRESS` | Store address | `Opposite RHC Hospital, Deolai Colony` |
| `STORE_PHONE` | Store contact numbers | `0318 9413433 | 0346 9413433` |
| `STORE_EMAIL` | Store email for invoices | optional |

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
- `POST /sales/{id}/payments/`
- `POST /sales/{id}/returns/`
- `POST /sales/{id}/void/`
- `GET /sales/{id}/invoice/`
- `GET /sales/{id}/receipt/`

### Purchases

- `GET /purchases/`
- `POST /purchases/`
- `POST /purchases/{id}/payments/`
- `POST /purchases/{id}/returns/`
- `GET /purchases/{id}/invoice/`
- `GET /purchases/{id}/receipt/`

### Reports

- `GET /reports/dashboard/`
- `GET /reports/daily-sales/`
- `GET /reports/monthly-sales/`
- `GET /reports/stock/`
- `GET /reports/expiry/`
- `GET /reports/daily-sales/export/`
- `GET /reports/stock/export/`

## Quality Checks

Useful verification commands:

```powershell
cd backend
.\venv\Scripts\python.exe manage.py check
```

```powershell
cd frontend
npm run build
```

```powershell
cd windows_application
flutter analyze
flutter build windows --release
```

## Troubleshooting

### Web login fails

Check:

- backend is running on port `8000`
- frontend is running on port `5151`
- PostgreSQL is available
- sample data has been seeded if you are using default credentials

### Windows app opens but cannot connect

Check:

- backend is running on `http://127.0.0.1:8000` or `http://localhost:8000`
- the desktop app was built after the latest Flutter changes
- firewall rules are not blocking the local backend

### Launcher says the Windows executable is missing

Build the release executable first:

```powershell
cd windows_application
flutter build windows --release
```

### Browser refresh logs the user out

The project already includes refresh-token rotation and session restore. If this still happens after a change, clear the browser session and log in again.

## Repository Purpose

This repository contains the customized pharmacy management system for **Saeed Skin Care Pharmacy**, with both browser and Windows desktop clients, real-world billing and return workflows, and documentation for local development and deployment.
