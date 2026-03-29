from django.contrib import admin

from .models import Purchase, PurchaseItem, PurchasePayment, PurchaseReturn, PurchaseReturnItem


class ReadOnlyInlineMixin:
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class PurchaseItemInline(ReadOnlyInlineMixin, admin.TabularInline):
    model = PurchaseItem
    fields = [
        'medicine',
        'quantity',
        'unit_cost',
        'line_total',
        'batch_number',
        'expiry_date',
        'returned_quantity',
        'returnable_quantity',
    ]
    readonly_fields = fields


class PurchaseReturnItemInline(ReadOnlyInlineMixin, admin.TabularInline):
    model = PurchaseReturnItem
    fields = ['purchase_item', 'medicine', 'quantity', 'unit_cost', 'line_total']
    readonly_fields = fields


class ReadOnlyTransactionalAdmin(admin.ModelAdmin):
    actions = None

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Purchase)
class PurchaseAdmin(ReadOnlyTransactionalAdmin):
    list_display = [
        'po_number',
        'supplier',
        'recorded_by',
        'net_total_cost',
        'total_paid_amount',
        'outstanding_amount',
        'payment_status',
        'purchase_date',
    ]
    list_filter = ['supplier', 'payment_status', 'purchase_date']
    search_fields = ['invoice_number', 'supplier__name', 'supplier__phone', 'recorded_by__username']
    list_select_related = ['supplier', 'recorded_by']
    date_hierarchy = 'purchase_date'
    inlines = [PurchaseItemInline]
    readonly_fields = [
        'po_number',
        'supplier',
        'recorded_by',
        'purchase_date',
        'invoice_number',
        'total_cost',
        'returned_amount',
        'net_total_cost',
        'total_paid_amount',
        'outstanding_amount',
        'credit_amount',
        'payment_status',
        'notes',
        'created_at',
    ]
    fieldsets = (
        ('Purchase', {'fields': ('po_number', 'supplier', 'recorded_by', 'purchase_date', 'invoice_number')}),
        (
            'Totals',
            {
                'fields': (
                    'total_cost',
                    'returned_amount',
                    'net_total_cost',
                    'total_paid_amount',
                    'outstanding_amount',
                    'credit_amount',
                    'payment_status',
                )
            },
        ),
        ('Notes', {'fields': ('notes', 'created_at')}),
    )


@admin.register(PurchaseReturn)
class PurchaseReturnAdmin(ReadOnlyTransactionalAdmin):
    list_display = [
        'reference_number',
        'purchase',
        'recorded_by',
        'total_amount',
        'return_date',
    ]
    list_filter = ['return_date', 'recorded_by']
    search_fields = [
        'id',
        'purchase__invoice_number',
        'purchase__supplier__name',
        'purchase__supplier__phone',
        'recorded_by__username',
    ]
    list_select_related = ['purchase', 'purchase__supplier', 'recorded_by']
    date_hierarchy = 'return_date'
    inlines = [PurchaseReturnItemInline]
    readonly_fields = ['reference_number', 'purchase', 'recorded_by', 'return_date', 'notes', 'total_amount']
    fieldsets = (
        ('Return', {'fields': ('reference_number', 'purchase', 'recorded_by', 'return_date')}),
        ('Details', {'fields': ('notes', 'total_amount')}),
    )


@admin.register(PurchasePayment)
class PurchasePaymentAdmin(ReadOnlyTransactionalAdmin):
    list_display = [
        'reference_number',
        'purchase',
        'recorded_by',
        'amount',
        'payment_method',
        'payment_date',
    ]
    list_filter = ['payment_method', 'payment_date', 'recorded_by']
    search_fields = [
        'id',
        'purchase__invoice_number',
        'purchase__supplier__name',
        'purchase__supplier__phone',
        'recorded_by__username',
        'notes',
    ]
    list_select_related = ['purchase', 'purchase__supplier', 'recorded_by']
    date_hierarchy = 'payment_date'
    readonly_fields = [
        'reference_number',
        'purchase',
        'recorded_by',
        'payment_date',
        'amount',
        'payment_method',
        'notes',
    ]
    fieldsets = (
        ('Payment', {'fields': ('reference_number', 'purchase', 'recorded_by', 'payment_date')}),
        ('Details', {'fields': ('amount', 'payment_method', 'notes')}),
    )
