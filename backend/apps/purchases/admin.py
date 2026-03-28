from django.contrib import admin

from .models import Purchase, PurchaseItem, PurchasePayment, PurchaseReturn, PurchaseReturnItem


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 0


class PurchaseReturnItemInline(admin.TabularInline):
    model = PurchaseReturnItem
    extra = 0
    readonly_fields = ['line_total']


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ['po_number', 'supplier', 'total_cost', 'payment_status', 'purchase_date']
    list_filter = ['supplier', 'payment_status', 'purchase_date']
    search_fields = ['supplier__name', 'invoice_number']
    inlines = [PurchaseItemInline]
    readonly_fields = ['total_cost', 'created_at']


@admin.register(PurchaseReturn)
class PurchaseReturnAdmin(admin.ModelAdmin):
    list_display = ['reference_number', 'purchase', 'total_amount', 'recorded_by', 'return_date']
    list_filter = ['return_date']
    search_fields = ['purchase__supplier__name', 'purchase__invoice_number']
    inlines = [PurchaseReturnItemInline]
    readonly_fields = ['total_amount', 'return_date']


@admin.register(PurchasePayment)
class PurchasePaymentAdmin(admin.ModelAdmin):
    list_display = ['reference_number', 'purchase', 'amount', 'payment_method', 'recorded_by', 'payment_date']
    list_filter = ['payment_method', 'payment_date']
    search_fields = ['purchase__supplier__name', 'purchase__invoice_number']
    readonly_fields = ['payment_date']
