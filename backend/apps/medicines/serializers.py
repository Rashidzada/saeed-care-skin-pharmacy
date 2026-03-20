# G:/msms/backend/apps/medicines/serializers.py
from rest_framework import serializers
from .models import Medicine


class MedicineSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()
    status = serializers.ReadOnlyField()
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = Medicine
        fields = [
            'id', 'name', 'generic_name', 'category', 'manufacturer',
            'batch_number', 'expiry_date', 'unit_price', 'quantity',
            'min_stock_threshold', 'supplier', 'supplier_name',
            'description', 'is_active', 'is_low_stock', 'is_expired',
            'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError('Quantity cannot be negative.')
        return value

    def validate_unit_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Unit price must be greater than zero.')
        return value
