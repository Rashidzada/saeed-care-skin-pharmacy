from decimal import Decimal

from rest_framework import serializers
from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    purchase_count = serializers.SerializerMethodField()
    pending_balance = serializers.SerializerMethodField()
    total_paid_amount = serializers.SerializerMethodField()
    credit_amount = serializers.SerializerMethodField()
    open_invoice_count = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id',
            'name',
            'phone',
            'email',
            'address',
            'purchase_count',
            'pending_balance',
            'total_paid_amount',
            'credit_amount',
            'open_invoice_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_purchase_count(self, obj):
        return obj.sales.filter(is_voided=False).count()

    def _sales(self, obj):
        return obj.sales.filter(is_voided=False).prefetch_related('returns', 'payments')

    def get_pending_balance(self, obj):
        return sum((sale.outstanding_amount for sale in self._sales(obj)), Decimal('0'))

    def get_total_paid_amount(self, obj):
        return sum((sale.total_paid_amount for sale in self._sales(obj)), Decimal('0'))

    def get_credit_amount(self, obj):
        return sum((sale.credit_amount for sale in self._sales(obj)), Decimal('0'))

    def get_open_invoice_count(self, obj):
        return sum(1 for sale in self._sales(obj) if sale.outstanding_amount > 0)
