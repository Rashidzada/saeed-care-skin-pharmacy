# G:/msms/backend/msms_project/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/medicines/', include('apps.medicines.urls')),
    path('api/v1/suppliers/', include('apps.suppliers.urls')),
    path('api/v1/customers/', include('apps.customers.urls')),
    path('api/v1/sales/', include('apps.sales.urls')),
    path('api/v1/purchases/', include('apps.purchases.urls')),
    path('api/v1/reports/', include('apps.reports.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
