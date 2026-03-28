from decimal import Decimal

from rest_framework import serializers
from .models import Supplier


class SupplierSerializer(serializers.ModelSerializer):
    medicine_count = serializers.SerializerMethodField()
    purchase_count = serializers.SerializerMethodField()
    pending_payable = serializers.SerializerMethodField()
    total_paid_amount = serializers.SerializerMethodField()
    credit_amount = serializers.SerializerMethodField()
    open_invoice_count = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            'id',
            'name',
            'contact_person',
            'phone',
            'email',
            'address',
            'is_active',
            'medicine_count',
            'purchase_count',
            'pending_payable',
            'total_paid_amount',
            'credit_amount',
            'open_invoice_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_medicine_count(self, obj):
        return obj.medicines.filter(is_active=True).count()

    def _purchases(self, obj):
        return obj.purchases.prefetch_related('returns', 'payments')

    def get_purchase_count(self, obj):
        return obj.purchases.count()

    def get_pending_payable(self, obj):
        return sum((purchase.outstanding_amount for purchase in self._purchases(obj)), Decimal('0'))

    def get_total_paid_amount(self, obj):
        return sum((purchase.total_paid_amount for purchase in self._purchases(obj)), Decimal('0'))

    def get_credit_amount(self, obj):
        return sum((purchase.credit_amount for purchase in self._purchases(obj)), Decimal('0'))

    def get_open_invoice_count(self, obj):
        return sum(1 for purchase in self._purchases(obj) if purchase.outstanding_amount > 0)
