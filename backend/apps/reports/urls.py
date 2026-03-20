# G:/msms/backend/apps/reports/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.dashboard_stats, name='dashboard-stats'),
    path('daily-sales/', views.daily_sales, name='daily-sales'),
    path('monthly-sales/', views.monthly_sales, name='monthly-sales'),
    path('stock/', views.stock_report, name='stock-report'),
    path('expiry/', views.expiry_report, name='expiry-report'),
    path('daily-sales/export/', views.export_daily_sales_csv, name='export-daily-sales'),
    path('stock/export/', views.export_stock_csv, name='export-stock'),
]
