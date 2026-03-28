from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.customers.models import Customer
from apps.medicines.models import Medicine
from .models import Sale, SaleItem, SalePayment, SaleReturn, SaleReturnItem


class SalePaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    reference_number = serializers.ReadOnlyField()

    class Meta:
        model = SalePayment
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


class SaleReturnItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.name', read_only=True)
    sale_item_id = serializers.IntegerField(source='sale_item.id', read_only=True)

    class Meta:
        model = SaleReturnItem
        fields = [
            'id',
            'sale_item_id',
            'medicine',
            'medicine_name',
            'quantity',
            'unit_price',
            'line_total',
        ]
        read_only_fields = ['id', 'line_total']


class SaleReturnSerializer(serializers.ModelSerializer):
    processed_by_name = serializers.SerializerMethodField()
    customer_name = serializers.CharField(
        source='sale.customer.name',
        read_only=True,
        default='Walk-in',
    )
    sale_invoice_number = serializers.ReadOnlyField(source='sale.invoice_number')
    reference_number = serializers.ReadOnlyField()
    items = SaleReturnItemSerializer(many=True, read_only=True)

    class Meta:
        model = SaleReturn
        fields = [
            'id',
            'reference_number',
            'sale_invoice_number',
            'customer_name',
            'processed_by',
            'processed_by_name',
            'return_date',
            'notes',
            'total_amount',
            'items',
        ]
        read_only_fields = [
            'id',
            'reference_number',
            'processed_by',
            'processed_by_name',
            'return_date',
            'total_amount',
        ]

    def get_processed_by_name(self, obj):
        if not obj.processed_by:
            return ''
        return obj.processed_by.full_name or obj.processed_by.username


class SaleItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.name', read_only=True)
    returned_quantity = serializers.ReadOnlyField()
    returnable_quantity = serializers.ReadOnlyField()
    current_stock = serializers.IntegerField(source='medicine.quantity', read_only=True)

    class Meta:
        model = SaleItem
        fields = [
            'id',
            'medicine',
            'medicine_name',
            'quantity',
            'returned_quantity',
            'returnable_quantity',
            'current_stock',
            'unit_price',
            'line_total',
        ]
        read_only_fields = ['id', 'line_total']


class SaleItemCreateSerializer(serializers.Serializer):
    medicine = serializers.PrimaryKeyRelatedField(
        queryset=Medicine.objects.filter(is_active=True)
    )
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    returns = SaleReturnSerializer(many=True, read_only=True)
    payments = SalePaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(
        source='customer.name',
        read_only=True,
        default='Walk-in',
    )
    customer_phone = serializers.CharField(
        source='customer.phone',
        read_only=True,
        allow_blank=True,
    )
    processed_by_name = serializers.SerializerMethodField()
    invoice_number = serializers.ReadOnlyField()
    returned_amount = serializers.ReadOnlyField()
    net_total_amount = serializers.ReadOnlyField()
    total_paid_amount = serializers.ReadOnlyField()
    outstanding_amount = serializers.ReadOnlyField()
    credit_amount = serializers.ReadOnlyField()
    return_count = serializers.SerializerMethodField()
    payment_count = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            'id',
            'invoice_number',
            'customer',
            'customer_name',
            'customer_phone',
            'processed_by',
            'processed_by_name',
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
            'return_count',
            'payment_count',
            'payment_status',
            'notes',
            'is_voided',
            'items',
            'returns',
            'payments',
        ]
        read_only_fields = [
            'id',
            'sale_date',
            'subtotal',
            'tax_amount',
            'total_amount',
            'processed_by',
            'invoice_number',
            'returned_amount',
            'net_total_amount',
            'total_paid_amount',
            'outstanding_amount',
            'credit_amount',
            'return_count',
            'payment_count',
        ]

    def get_processed_by_name(self, obj):
        if not obj.processed_by:
            return ''
        return obj.processed_by.full_name or obj.processed_by.username

    def get_return_count(self, obj):
        return len(obj.returns.all())

    def get_payment_count(self, obj):
        return len(obj.payments.all())


class SaleCreateSerializer(serializers.Serializer):
    customer = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(),
        required=False,
        allow_null=True,
    )
    items = SaleItemCreateSerializer(many=True, min_length=1)
    tax_rate = serializers.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = serializers.ChoiceField(
        choices=Sale.PAYMENT_STATUS_CHOICES,
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
        choices=SalePayment.PAYMENT_METHOD_CHOICES,
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

        sale = Sale.objects.create(
            processed_by=request.user,
            tax_rate=validated_data.get('tax_rate', 0),
            discount=validated_data.get('discount', 0),
            payment_status=requested_status,
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

        if amount_paid is None:
            amount_paid = sale.total_amount if requested_status == 'paid' else Decimal('0')

        if amount_paid > sale.total_amount:
            raise serializers.ValidationError(
                {'amount_paid': 'Initial payment cannot exceed the invoice total.'}
            )

        if amount_paid < sale.total_amount and not sale.customer_id:
            raise serializers.ValidationError(
                {
                    'customer': (
                        'Select a registered customer for pending or partial sale payments.'
                    )
                }
            )

        if amount_paid > 0:
            SalePayment.objects.create(
                sale=sale,
                recorded_by=request.user,
                amount=amount_paid,
                payment_method=payment_method,
                notes=payment_notes or 'Initial payment recorded with the sale.',
            )

        sale.sync_payment_status(save=True)
        return sale


class SalePaymentCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('0.01'),
    )
    payment_method = serializers.ChoiceField(
        choices=SalePayment.PAYMENT_METHOD_CHOICES,
        default='cash',
    )
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        sale = self.context['sale']

        if sale.is_voided:
            raise serializers.ValidationError({'sale': 'Cannot add a payment to a voided sale.'})
        if sale.outstanding_amount <= 0:
            raise serializers.ValidationError(
                {'sale': 'This invoice does not have any outstanding balance.'}
            )
        if attrs['amount'] > sale.outstanding_amount:
            raise serializers.ValidationError(
                {
                    'amount': (
                        f'Only PKR {sale.outstanding_amount:.2f} is outstanding on this invoice.'
                    )
                }
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        sale = self.context['sale']
        request = self.context['request']

        payment = SalePayment.objects.create(
            sale=sale,
            recorded_by=request.user,
            amount=validated_data['amount'],
            payment_method=validated_data.get('payment_method', 'cash'),
            notes=validated_data.get('notes', ''),
        )

        refreshed_sale = Sale.objects.prefetch_related('returns', 'payments').get(pk=sale.pk)
        refreshed_sale.sync_payment_status(save=True)
        return payment


class SaleReturnItemCreateSerializer(serializers.Serializer):
    sale_item = serializers.PrimaryKeyRelatedField(queryset=SaleItem.objects.all())
    quantity = serializers.IntegerField(min_value=1)


class SaleReturnCreateSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = SaleReturnItemCreateSerializer(many=True, min_length=1)

    def validate(self, attrs):
        sale = self.context['sale']
        seen = set()

        for item_data in attrs['items']:
            sale_item = item_data['sale_item']
            quantity = item_data['quantity']

            if sale_item.id in seen:
                raise serializers.ValidationError(
                    {'items': f'{sale_item.medicine.name} was included more than once.'}
                )
            seen.add(sale_item.id)

            if sale_item.sale_id != sale.id:
                raise serializers.ValidationError(
                    {'items': f'{sale_item.medicine.name} does not belong to this invoice.'}
                )
            if quantity > sale_item.returnable_quantity:
                raise serializers.ValidationError(
                    {
                        'items': (
                            f'Only {sale_item.returnable_quantity} '
                            f'unit(s) of {sale_item.medicine.name} can still be returned.'
                        )
                    }
                )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        sale = self.context['sale']
        request = self.context['request']

        if sale.is_voided:
            raise serializers.ValidationError(
                {'sale': 'Cannot record a return for a voided sale.'}
            )

        items_data = validated_data['items']
        sale_return = SaleReturn.objects.create(
            sale=sale,
            processed_by=request.user,
            notes=validated_data.get('notes', ''),
        )

        for item_data in items_data:
            locked_item = (
                SaleItem.objects.select_for_update()
                .select_related('medicine')
                .prefetch_related('return_items')
                .get(pk=item_data['sale_item'].pk)
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

            SaleReturnItem.objects.create(
                sale_return=sale_return,
                sale_item=locked_item,
                medicine=locked_item.medicine,
                quantity=quantity,
                unit_price=locked_item.unit_price,
            )
            locked_item.medicine.quantity += quantity
            locked_item.medicine.save(update_fields=['quantity'])

        sale_return.recalculate_total()
        refreshed_sale = Sale.objects.prefetch_related('returns', 'payments').get(pk=sale.pk)
        refreshed_sale.sync_payment_status(save=True)
        return sale_return
