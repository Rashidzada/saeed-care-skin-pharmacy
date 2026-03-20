# G:/msms/backend/apps/sales/serializers.py
from rest_framework import serializers
from django.db import transaction
from .models import Sale, SaleItem
from apps.medicines.models import Medicine


class SaleItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.name', read_only=True)

    class Meta:
        model = SaleItem
        fields = ['id', 'medicine', 'medicine_name', 'quantity', 'unit_price', 'line_total']
        read_only_fields = ['id', 'line_total']


class SaleItemCreateSerializer(serializers.Serializer):
    medicine = serializers.PrimaryKeyRelatedField(queryset=Medicine.objects.filter(is_active=True))
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True, default='Walk-in')
    processed_by_name = serializers.CharField(source='processed_by.full_name', read_only=True)
    invoice_number = serializers.ReadOnlyField()

    class Meta:
        model = Sale
        fields = [
            'id', 'invoice_number', 'customer', 'customer_name',
            'processed_by', 'processed_by_name', 'sale_date',
            'subtotal', 'tax_rate', 'tax_amount', 'discount', 'total_amount',
            'payment_status', 'notes', 'is_voided', 'items'
        ]
        read_only_fields = ['id', 'sale_date', 'subtotal', 'tax_amount',
                            'total_amount', 'processed_by', 'invoice_number']


class SaleCreateSerializer(serializers.Serializer):
    customer = serializers.PrimaryKeyRelatedField(
        queryset=__import__('apps.customers.models', fromlist=['Customer']).Customer.objects.all(),
        required=False,
        allow_null=True
    )
    items = SaleItemCreateSerializer(many=True, min_length=1)
    tax_rate = serializers.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = serializers.ChoiceField(
        choices=Sale.PAYMENT_STATUS_CHOICES, default='paid'
    )
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context['request']

        sale = Sale.objects.create(
            processed_by=request.user,
            tax_rate=validated_data.get('tax_rate', 0),
            discount=validated_data.get('discount', 0),
            payment_status=validated_data.get('payment_status', 'paid'),
            notes=validated_data.get('notes', ''),
            customer=validated_data.get('customer'),
        )

        for item_data in items_data:
            medicine = item_data['medicine']
            unit_price = item_data.get('unit_price', medicine.unit_price)
            SaleItem.objects.create(
                sale=sale,
                medicine=medicine,
                quantity=item_data['quantity'],
                unit_price=unit_price,
            )

        sale.recalculate_totals()
        return sale
