from django.contrib import admin
from .models import Purchase, PurchaseItem


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 0


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ['po_number', 'supplier', 'total_cost', 'purchase_date']
    list_filter = ['supplier', 'purchase_date']
    search_fields = ['supplier__name', 'invoice_number']
    inlines = [PurchaseItemInline]
    readonly_fields = ['total_cost', 'created_at']
