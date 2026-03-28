from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Sale(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('paid', 'Paid'),
        ('partial', 'Partial'),
        ('pending', 'Pending'),
    ]

    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales',
    )
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sales_processed',
    )
    sale_date = models.DateTimeField(auto_now_add=True, db_index=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='paid',
    )
    notes = models.TextField(blank=True)
    is_voided = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Sale'
        verbose_name_plural = 'Sales'
        ordering = ['-sale_date']

    def __str__(self):
        return f"INV-{self.sale_date.year}-{self.id:05d}"

    @property
    def invoice_number(self):
        return f"INV-{self.sale_date.year}-{self.id:05d}"

    def recalculate_totals(self):
        subtotal = sum(item.line_total for item in self.items.all())
        tax_amount = (subtotal * self.tax_rate) / 100
        total = subtotal + tax_amount - self.discount
        self.subtotal = subtotal
        self.tax_amount = tax_amount
        self.total_amount = max(total, 0)
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])

    @property
    def returned_amount(self):
        return sum(
            ((sale_return.total_amount or Decimal('0')) for sale_return in self.returns.all()),
            Decimal('0'),
        )

    @property
    def net_total_amount(self):
        return max(self.total_amount - self.returned_amount, Decimal('0'))

    @property
    def total_paid_amount(self):
        return sum(
            ((payment.amount or Decimal('0')) for payment in self.payments.all()),
            Decimal('0'),
        )

    @property
    def outstanding_amount(self):
        return max(self.net_total_amount - self.total_paid_amount, Decimal('0'))

    @property
    def credit_amount(self):
        return max(self.total_paid_amount - self.net_total_amount, Decimal('0'))

    @property
    def resolved_payment_status(self):
        if self.net_total_amount <= 0 or self.outstanding_amount <= 0:
            return 'paid'
        if self.total_paid_amount <= 0:
            return 'pending'
        return 'partial'

    def sync_payment_status(self, save=True):
        status = self.resolved_payment_status
        if self.payment_status != status:
            self.payment_status = status
            if save:
                self.save(update_fields=['payment_status'])
        return self.payment_status


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey(
        'medicines.Medicine',
        on_delete=models.PROTECT,
        related_name='sale_items',
    )
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'Sale Item'
        verbose_name_plural = 'Sale Items'

    def __str__(self):
        return f"{self.medicine.name} x{self.quantity}"

    @property
    def returned_quantity(self):
        return sum(item.quantity for item in self.return_items.all())

    @property
    def returnable_quantity(self):
        return max(self.quantity - self.returned_quantity, 0)

    def clean(self):
        if self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be at least 1.'})

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        if is_new:
            if self.medicine.quantity < self.quantity:
                raise ValidationError(
                    f"Insufficient stock for {self.medicine.name}. "
                    f"Available: {self.medicine.quantity}, Requested: {self.quantity}"
                )
            self.medicine.quantity -= self.quantity
            self.medicine.save(update_fields=['quantity'])

        self.line_total = self.unit_price * self.quantity
        super().save(*args, **kwargs)


class SaleReturn(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='returns')
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sale_returns_processed',
    )
    return_date = models.DateTimeField(auto_now_add=True, db_index=True)
    notes = models.TextField(blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'Sale Return'
        verbose_name_plural = 'Sale Returns'
        ordering = ['-return_date', '-id']

    def __str__(self):
        return self.reference_number

    @property
    def reference_number(self):
        return f"SR-{self.return_date.year}-{self.id:05d}"

    def recalculate_total(self):
        total = sum(item.line_total for item in self.items.all())
        self.total_amount = total
        self.save(update_fields=['total_amount'])


class SaleReturnItem(models.Model):
    sale_return = models.ForeignKey(
        SaleReturn,
        on_delete=models.CASCADE,
        related_name='items',
    )
    sale_item = models.ForeignKey(
        SaleItem,
        on_delete=models.PROTECT,
        related_name='return_items',
    )
    medicine = models.ForeignKey(
        'medicines.Medicine',
        on_delete=models.PROTECT,
        related_name='sale_return_items',
    )
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'Sale Return Item'
        verbose_name_plural = 'Sale Return Items'

    def __str__(self):
        return f"{self.medicine.name} return x{self.quantity}"

    def clean(self):
        if self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be at least 1.'})

    def save(self, *args, **kwargs):
        self.line_total = self.unit_price * self.quantity
        super().save(*args, **kwargs)


class SalePayment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('bank_transfer', 'Bank Transfer'),
        ('easypaisa', 'Easypaisa'),
        ('jazzcash', 'JazzCash'),
        ('other', 'Other'),
    ]

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='payments')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sale_payments_recorded',
    )
    payment_date = models.DateTimeField(auto_now_add=True, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_METHOD_CHOICES,
        default='cash',
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Sale Payment'
        verbose_name_plural = 'Sale Payments'
        ordering = ['-payment_date', '-id']

    def __str__(self):
        return self.reference_number

    @property
    def reference_number(self):
        return f"SP-{self.payment_date.year}-{self.id:05d}"

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({'amount': 'Payment amount must be greater than zero.'})
