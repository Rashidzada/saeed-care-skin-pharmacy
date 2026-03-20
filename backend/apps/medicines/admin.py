from django.contrib import admin
from .models import Medicine


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'batch_number', 'expiry_date', 'quantity', 'unit_price', 'is_active']
    list_filter = ['category', 'is_active', 'supplier']
    search_fields = ['name', 'batch_number', 'generic_name']
    date_hierarchy = 'expiry_date'
