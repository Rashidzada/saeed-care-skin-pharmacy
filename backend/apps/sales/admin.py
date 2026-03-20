from django.contrib import admin
from .models import Sale, SaleItem


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ['line_total']


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'customer', 'total_amount', 'payment_status', 'is_voided', 'sale_date']
    list_filter = ['payment_status', 'is_voided', 'sale_date']
    search_fields = ['customer__name', 'id']
    inlines = [SaleItemInline]
    readonly_fields = ['subtotal', 'tax_amount', 'total_amount', 'sale_date']
