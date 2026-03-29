from django.contrib import admin

from .models import Sale, SaleItem, SalePayment, SaleReturn, SaleReturnItem


class ReadOnlyInlineMixin:
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class SaleItemInline(ReadOnlyInlineMixin, admin.TabularInline):
    model = SaleItem
    fields = [
        'medicine',
        'quantity',
        'unit_price',
        'line_total',
        'returned_quantity',
        'returnable_quantity',
    ]
    readonly_fields = fields


class SaleReturnItemInline(ReadOnlyInlineMixin, admin.TabularInline):
    model = SaleReturnItem
    fields = ['sale_item', 'medicine', 'quantity', 'unit_price', 'line_total']
    readonly_fields = fields


class ReadOnlyTransactionalAdmin(admin.ModelAdmin):
    actions = None

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Sale)
class SaleAdmin(ReadOnlyTransactionalAdmin):
    list_display = [
        'invoice_number',
        'customer',
        'processed_by',
        'net_total_amount',
        'total_paid_amount',
        'outstanding_amount',
        'payment_status',
        'is_voided',
        'sale_date',
    ]
    list_filter = ['payment_status', 'is_voided', 'sale_date']
    search_fields = ['id', 'customer__name', 'customer__phone', 'processed_by__username']
    list_select_related = ['customer', 'processed_by']
    date_hierarchy = 'sale_date'
    inlines = [SaleItemInline]
    readonly_fields = [
        'invoice_number',
        'customer',
        'processed_by',
        'sale_date',
        'subtotal',
        'tax_rate',
        'tax_amount',
        'discount',
        'total_amount',
        'returned_amount',
        'net_total_amount',
        'total_paid_amount',
        'outstanding_amount',
        'credit_amount',
        'payment_status',
        'notes',
        'is_voided',
    ]
    fieldsets = (
        ('Sale', {'fields': ('invoice_number', 'customer', 'processed_by', 'sale_date')}),
        (
            'Totals',
            {
                'fields': (
                    'subtotal',
                    'tax_rate',
                    'tax_amount',
                    'discount',
                    'total_amount',
                    'returned_amount',
                    'net_total_amount',
                    'total_paid_amount',
                    'outstanding_amount',
                    'credit_amount',
                    'payment_status',
                )
            },
        ),
        ('Status', {'fields': ('is_voided', 'notes')}),
    )


@admin.register(SaleReturn)
class SaleReturnAdmin(ReadOnlyTransactionalAdmin):
    list_display = [
        'reference_number',
        'sale',
        'processed_by',
        'total_amount',
        'return_date',
    ]
    list_filter = ['return_date', 'processed_by']
    search_fields = [
        'id',
        'sale__id',
        'sale__customer__name',
        'sale__customer__phone',
        'processed_by__username',
    ]
    list_select_related = ['sale', 'sale__customer', 'processed_by']
    date_hierarchy = 'return_date'
    inlines = [SaleReturnItemInline]
    readonly_fields = ['reference_number', 'sale', 'processed_by', 'return_date', 'notes', 'total_amount']
    fieldsets = (
        ('Return', {'fields': ('reference_number', 'sale', 'processed_by', 'return_date')}),
        ('Details', {'fields': ('notes', 'total_amount')}),
    )


@admin.register(SalePayment)
class SalePaymentAdmin(ReadOnlyTransactionalAdmin):
    list_display = [
        'reference_number',
        'sale',
        'recorded_by',
        'amount',
        'payment_method',
        'payment_date',
    ]
    list_filter = ['payment_method', 'payment_date', 'recorded_by']
    search_fields = [
        'id',
        'sale__id',
        'sale__customer__name',
        'sale__customer__phone',
        'recorded_by__username',
        'notes',
    ]
    list_select_related = ['sale', 'sale__customer', 'recorded_by']
    date_hierarchy = 'payment_date'
    readonly_fields = [
        'reference_number',
        'sale',
        'recorded_by',
        'payment_date',
        'amount',
        'payment_method',
        'notes',
    ]
    fieldsets = (
        ('Payment', {'fields': ('reference_number', 'sale', 'recorded_by', 'payment_date')}),
        ('Details', {'fields': ('amount', 'payment_method', 'notes')}),
    )
