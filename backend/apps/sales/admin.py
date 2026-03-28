from django.contrib import admin

from .models import Sale, SaleItem, SalePayment, SaleReturn, SaleReturnItem


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ['line_total']


class SaleReturnItemInline(admin.TabularInline):
    model = SaleReturnItem
    extra = 0
    readonly_fields = ['line_total']


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'customer', 'total_amount', 'payment_status', 'is_voided', 'sale_date']
    list_filter = ['payment_status', 'is_voided', 'sale_date']
    search_fields = ['customer__name', 'id']
    inlines = [SaleItemInline]
    readonly_fields = ['subtotal', 'tax_amount', 'total_amount', 'sale_date']


@admin.register(SaleReturn)
class SaleReturnAdmin(admin.ModelAdmin):
    list_display = ['reference_number', 'sale', 'total_amount', 'processed_by', 'return_date']
    list_filter = ['return_date']
    search_fields = ['sale__id', 'sale__customer__name']
    inlines = [SaleReturnItemInline]
    readonly_fields = ['total_amount', 'return_date']


@admin.register(SalePayment)
class SalePaymentAdmin(admin.ModelAdmin):
    list_display = ['reference_number', 'sale', 'amount', 'payment_method', 'recorded_by', 'payment_date']
    list_filter = ['payment_method', 'payment_date']
    search_fields = ['sale__id', 'sale__customer__name']
    readonly_fields = ['payment_date']
