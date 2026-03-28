# Saeed Pharmacy Windows App

Flutter Windows desktop client for the Saeed Skin Care Pharmacy management system.

## What It Includes

- branded login screen
- dashboard with receivables, payables, and stock visibility
- medicines, customers, suppliers, sales, purchases, reports, and users
- sale and purchase payment tracking
- customer and supplier balance workflows
- invoice and compact receipt opening through the shared Django backend

## Run in Development

```powershell
cd windows_application
flutter pub get
flutter run -d windows
```

## Build Release

```powershell
cd windows_application
flutter build windows --release
```

The root launcher script `start_windows_application.bat` can then be used to start the backend and open the desktop executable.
