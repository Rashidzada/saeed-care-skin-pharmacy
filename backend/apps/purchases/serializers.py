# G:/msms/backend/apps/purchases/serializers.py
from rest_framework import serializers
from django.db import transaction
from .models import Purchase, PurchaseItem
from apps.medicines.models import Medicine


class PurchaseItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.name', read_only=True)

    class Meta:
        model = PurchaseItem
        fields = ['id', 'medicine', 'medicine_name', 'quantity', 'unit_cost', 'batch_number', 'expiry_date']
        read_only_fields = ['id']


class PurchaseItemCreateSerializer(serializers.Serializer):
    medicine = serializers.PrimaryKeyRelatedField(queryset=Medicine.objects.filter(is_active=True))
    quantity = serializers.IntegerField(min_value=1)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=2)
    batch_number = serializers.CharField(required=False, allow_blank=True, default='')
    expiry_date = serializers.DateField(required=False, allow_null=True)


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)
    po_number = serializers.ReadOnlyField()

    class Meta:
        model = Purchase
        fields = [
            'id', 'po_number', 'supplier', 'supplier_name',
            'recorded_by', 'recorded_by_name', 'purchase_date',
            'invoice_number', 'total_cost', 'notes', 'created_at', 'items'
        ]
        read_only_fields = ['id', 'total_cost', 'recorded_by', 'created_at', 'po_number']


class PurchaseCreateSerializer(serializers.Serializer):
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=__import__('apps.suppliers.models', fromlist=['Supplier']).Supplier.objects.filter(is_active=True)
    )
    purchase_date = serializers.DateField()
    invoice_number = serializers.CharField(required=False, allow_blank=True, default='')
    items = PurchaseItemCreateSerializer(many=True, min_length=1)
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context['request']

        purchase = Purchase.objects.create(
            supplier=validated_data['supplier'],
            purchase_date=validated_data['purchase_date'],
            invoice_number=validated_data.get('invoice_number', ''),
            notes=validated_data.get('notes', ''),
            recorded_by=request.user,
        )

        for item_data in items_data:
            PurchaseItem.objects.create(
                purchase=purchase,
                medicine=item_data['medicine'],
                quantity=item_data['quantity'],
                unit_cost=item_data['unit_cost'],
                batch_number=item_data.get('batch_number', ''),
                expiry_date=item_data.get('expiry_date'),
            )

        purchase.recalculate_total()
        return purchase
