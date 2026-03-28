from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.medicines.models import Medicine
from apps.suppliers.models import Supplier
from .models import (
    Purchase,
    PurchaseItem,
    PurchasePayment,
    PurchaseReturn,
    PurchaseReturnItem,
)


class PurchasePaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    reference_number = serializers.ReadOnlyField()

    class Meta:
        model = PurchasePayment
        fields = [
            'id',
            'reference_number',
            'recorded_by',
            'recorded_by_name',
            'payment_date',
            'amount',
            'payment_method',
            'notes',
        ]
        read_only_fields = [
            'id',
            'reference_number',
            'recorded_by',
            'recorded_by_name',
            'payment_date',
        ]

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return ''
        return obj.recorded_by.full_name or obj.recorded_by.username


class PurchaseReturnItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.name', read_only=True)
    purchase_item_id = serializers.IntegerField(source='purchase_item.id', read_only=True)

    class Meta:
        model = PurchaseReturnItem
        fields = [
            'id',
            'purchase_item_id',
            'medicine',
            'medicine_name',
            'quantity',
            'unit_cost',
            'line_total',
        ]
        read_only_fields = ['id', 'line_total']


class PurchaseReturnSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    reference_number = serializers.ReadOnlyField()
    items = PurchaseReturnItemSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseReturn
        fields = [
            'id',
            'reference_number',
            'recorded_by',
            'recorded_by_name',
            'return_date',
            'notes',
            'total_amount',
            'items',
        ]
        read_only_fields = [
            'id',
            'reference_number',
            'recorded_by',
            'recorded_by_name',
            'return_date',
            'total_amount',
        ]

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return ''
        return obj.recorded_by.full_name or obj.recorded_by.username


class PurchaseItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.name', read_only=True)
    returned_quantity = serializers.ReadOnlyField()
    returnable_quantity = serializers.ReadOnlyField()
    current_stock = serializers.IntegerField(source='medicine.quantity', read_only=True)
    line_total = serializers.ReadOnlyField()

    class Meta:
        model = PurchaseItem
        fields = [
            'id',
            'medicine',
            'medicine_name',
            'quantity',
            'returned_quantity',
            'returnable_quantity',
            'current_stock',
            'unit_cost',
            'line_total',
            'batch_number',
            'expiry_date',
        ]
        read_only_fields = ['id', 'line_total']


class PurchaseItemCreateSerializer(serializers.Serializer):
    medicine = serializers.PrimaryKeyRelatedField(
        queryset=Medicine.objects.filter(is_active=True)
    )
    quantity = serializers.IntegerField(min_value=1)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=2)
    batch_number = serializers.CharField(required=False, allow_blank=True, default='')
    expiry_date = serializers.DateField(required=False, allow_null=True)


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, read_only=True)
    returns = PurchaseReturnSerializer(many=True, read_only=True)
    payments = PurchasePaymentSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_phone = serializers.CharField(source='supplier.phone', read_only=True)
    recorded_by_name = serializers.SerializerMethodField()
    po_number = serializers.ReadOnlyField()
    returned_amount = serializers.ReadOnlyField()
    net_total_cost = serializers.ReadOnlyField()
    total_paid_amount = serializers.ReadOnlyField()
    outstanding_amount = serializers.ReadOnlyField()
    credit_amount = serializers.ReadOnlyField()
    return_count = serializers.SerializerMethodField()
    payment_count = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = [
            'id',
            'po_number',
            'supplier',
            'supplier_name',
            'supplier_phone',
            'recorded_by',
            'recorded_by_name',
            'purchase_date',
            'invoice_number',
            'total_cost',
            'returned_amount',
            'net_total_cost',
            'total_paid_amount',
            'outstanding_amount',
            'credit_amount',
            'return_count',
            'payment_count',
            'payment_status',
            'notes',
            'created_at',
            'items',
            'returns',
            'payments',
        ]
        read_only_fields = [
            'id',
            'total_cost',
            'recorded_by',
            'created_at',
            'po_number',
            'returned_amount',
            'net_total_cost',
            'total_paid_amount',
            'outstanding_amount',
            'credit_amount',
            'return_count',
            'payment_count',
        ]

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return ''
        return obj.recorded_by.full_name or obj.recorded_by.username

    def get_return_count(self, obj):
        return len(obj.returns.all())

    def get_payment_count(self, obj):
        return len(obj.payments.all())


class PurchaseCreateSerializer(serializers.Serializer):
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.filter(is_active=True)
    )
    purchase_date = serializers.DateField()
    invoice_number = serializers.CharField(required=False, allow_blank=True, default='')
    items = PurchaseItemCreateSerializer(many=True, min_length=1)
    payment_status = serializers.ChoiceField(
        choices=Purchase.PAYMENT_STATUS_CHOICES,
        default='paid',
    )
    amount_paid = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=Decimal('0'),
    )
    payment_method = serializers.ChoiceField(
        choices=PurchasePayment.PAYMENT_METHOD_CHOICES,
        default='cash',
        required=False,
    )
    payment_notes = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context['request']
        requested_status = validated_data.get('payment_status', 'paid')
        amount_paid = validated_data.get('amount_paid')
        payment_method = validated_data.get('payment_method', 'cash')
        payment_notes = validated_data.get('payment_notes', '')

        purchase = Purchase.objects.create(
            supplier=validated_data['supplier'],
            purchase_date=validated_data['purchase_date'],
            invoice_number=validated_data.get('invoice_number', ''),
            payment_status=requested_status,
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

        if amount_paid is None:
            amount_paid = purchase.total_cost if requested_status == 'paid' else Decimal('0')

        if amount_paid > purchase.total_cost:
            raise serializers.ValidationError(
                {'amount_paid': 'Initial payment cannot exceed the purchase total.'}
            )

        if amount_paid > 0:
            PurchasePayment.objects.create(
                purchase=purchase,
                recorded_by=request.user,
                amount=amount_paid,
                payment_method=payment_method,
                notes=payment_notes or 'Initial payment recorded with the purchase.',
            )

        purchase.sync_payment_status(save=True)
        return purchase


class PurchasePaymentCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )
    payment_method = serializers.ChoiceField(
        choices=PurchasePayment.PAYMENT_METHOD_CHOICES,
        default='cash',
    )
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        purchase = self.context['purchase']

        if purchase.outstanding_amount <= 0:
            raise serializers.ValidationError(
                {'purchase': 'This purchase does not have any outstanding balance.'}
            )
        if attrs['amount'] > purchase.outstanding_amount:
            raise serializers.ValidationError(
                {
                    'amount': (
                        f'Only PKR {purchase.outstanding_amount:.2f} is outstanding on this purchase.'
                    )
                }
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        purchase = self.context['purchase']
        request = self.context['request']

        payment = PurchasePayment.objects.create(
            purchase=purchase,
            recorded_by=request.user,
            amount=validated_data['amount'],
            payment_method=validated_data.get('payment_method', 'cash'),
            notes=validated_data.get('notes', ''),
        )

        refreshed_purchase = Purchase.objects.prefetch_related('returns', 'payments').get(
            pk=purchase.pk
        )
        refreshed_purchase.sync_payment_status(save=True)
        return payment


class PurchaseReturnItemCreateSerializer(serializers.Serializer):
    purchase_item = serializers.PrimaryKeyRelatedField(queryset=PurchaseItem.objects.all())
    quantity = serializers.IntegerField(min_value=1)


class PurchaseReturnCreateSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = PurchaseReturnItemCreateSerializer(many=True, min_length=1)

    def validate(self, attrs):
        purchase = self.context['purchase']
        seen = set()

        for item_data in attrs['items']:
            purchase_item = item_data['purchase_item']
            quantity = item_data['quantity']

            if purchase_item.id in seen:
                raise serializers.ValidationError(
                    {'items': f'{purchase_item.medicine.name} was included more than once.'}
                )
            seen.add(purchase_item.id)

            if purchase_item.purchase_id != purchase.id:
                raise serializers.ValidationError(
                    {'items': f'{purchase_item.medicine.name} does not belong to this purchase.'}
                )
            if quantity > purchase_item.returnable_quantity:
                raise serializers.ValidationError(
                    {
                        'items': (
                            f'Only {purchase_item.returnable_quantity} '
                            f'unit(s) of {purchase_item.medicine.name} can still be returned.'
                        )
                    }
                )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        purchase = self.context['purchase']
        request = self.context['request']

        items_data = validated_data['items']
        purchase_return = PurchaseReturn.objects.create(
            purchase=purchase,
            recorded_by=request.user,
            notes=validated_data.get('notes', ''),
        )

        for item_data in items_data:
            locked_item = (
                PurchaseItem.objects.select_for_update()
                .select_related('medicine')
                .prefetch_related('return_items')
                .get(pk=item_data['purchase_item'].pk)
            )
            quantity = item_data['quantity']

            if quantity > locked_item.returnable_quantity:
                raise serializers.ValidationError(
                    {
                        'items': (
                            f'Only {locked_item.returnable_quantity} '
                            f'unit(s) of {locked_item.medicine.name} can still be returned.'
                        )
                    }
                )
            if locked_item.medicine.quantity < quantity:
                raise serializers.ValidationError(
                    {
                        'items': (
                            f'Current stock for {locked_item.medicine.name} is '
                            f'{locked_item.medicine.quantity}. Reduce the return quantity.'
                        )
                    }
                )

            PurchaseReturnItem.objects.create(
                purchase_return=purchase_return,
                purchase_item=locked_item,
                medicine=locked_item.medicine,
                quantity=quantity,
                unit_cost=locked_item.unit_cost,
            )
            locked_item.medicine.quantity -= quantity
            locked_item.medicine.save(update_fields=['quantity'])

        purchase_return.recalculate_total()
        refreshed_purchase = Purchase.objects.prefetch_related('returns', 'payments').get(
            pk=purchase.pk
        )
        refreshed_purchase.sync_payment_status(save=True)
        return purchase_return
