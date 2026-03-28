from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Purchase(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('paid', 'Paid'),
        ('partial', 'Partial'),
        ('pending', 'Pending'),
    ]

    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='purchases',
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='purchases_recorded',
    )
    purchase_date = models.DateField(db_index=True)
    invoice_number = models.CharField(max_length=100, blank=True, db_index=True)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='paid',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Purchase'
        verbose_name_plural = 'Purchases'
        ordering = ['-purchase_date', '-created_at']

    def __str__(self):
        return f"PO-{self.purchase_date.year}-{self.id:05d}"

    @property
    def po_number(self):
        return f"PO-{self.purchase_date.year}-{self.id:05d}"

    def recalculate_total(self):
        total = sum(item.unit_cost * item.quantity for item in self.items.all())
        self.total_cost = total
        self.save(update_fields=['total_cost'])

    @property
    def returned_amount(self):
        return sum(
            (
                (purchase_return.total_amount or Decimal('0'))
                for purchase_return in self.returns.all()
            ),
            Decimal('0'),
        )

    @property
    def net_total_cost(self):
        return max(self.total_cost - self.returned_amount, Decimal('0'))

    @property
    def total_paid_amount(self):
        return sum(
            ((payment.amount or Decimal('0')) for payment in self.payments.all()),
            Decimal('0'),
        )

    @property
    def outstanding_amount(self):
        return max(self.net_total_cost - self.total_paid_amount, Decimal('0'))

    @property
    def credit_amount(self):
        return max(self.total_paid_amount - self.net_total_cost, Decimal('0'))

    @property
    def resolved_payment_status(self):
        if self.net_total_cost <= 0 or self.outstanding_amount <= 0:
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


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.CASCADE,
        related_name='items',
    )
    medicine = models.ForeignKey(
        'medicines.Medicine',
        on_delete=models.PROTECT,
        related_name='purchase_items',
    )
    quantity = models.IntegerField()
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    batch_number = models.CharField(max_length=100, blank=True)
    expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = 'Purchase Item'
        verbose_name_plural = 'Purchase Items'

    def __str__(self):
        return f"{self.medicine.name} x{self.quantity}"

    @property
    def line_total(self):
        return self.unit_cost * self.quantity

    @property
    def returned_quantity(self):
        return sum(item.quantity for item in self.return_items.all())

    @property
    def returnable_quantity(self):
        return max(self.quantity - self.returned_quantity, 0)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            self.medicine.quantity += self.quantity
            if self.batch_number:
                self.medicine.batch_number = self.batch_number
            if self.expiry_date:
                self.medicine.expiry_date = self.expiry_date
            self.medicine.save(update_fields=['quantity', 'batch_number', 'expiry_date'])


class PurchaseReturn(models.Model):
    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.CASCADE,
        related_name='returns',
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='purchase_returns_recorded',
    )
    return_date = models.DateTimeField(auto_now_add=True, db_index=True)
    notes = models.TextField(blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'Purchase Return'
        verbose_name_plural = 'Purchase Returns'
        ordering = ['-return_date', '-id']

    def __str__(self):
        return self.reference_number

    @property
    def reference_number(self):
        return f"PR-{self.return_date.year}-{self.id:05d}"

    def recalculate_total(self):
        total = sum(item.line_total for item in self.items.all())
        self.total_amount = total
        self.save(update_fields=['total_amount'])


class PurchaseReturnItem(models.Model):
    purchase_return = models.ForeignKey(
        PurchaseReturn,
        on_delete=models.CASCADE,
        related_name='items',
    )
    purchase_item = models.ForeignKey(
        PurchaseItem,
        on_delete=models.PROTECT,
        related_name='return_items',
    )
    medicine = models.ForeignKey(
        'medicines.Medicine',
        on_delete=models.PROTECT,
        related_name='purchase_return_items',
    )
    quantity = models.IntegerField()
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'Purchase Return Item'
        verbose_name_plural = 'Purchase Return Items'

    def __str__(self):
        return f"{self.medicine.name} supplier return x{self.quantity}"

    def clean(self):
        if self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be at least 1.'})

    def save(self, *args, **kwargs):
        self.line_total = self.unit_cost * self.quantity
        super().save(*args, **kwargs)


class PurchasePayment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('bank_transfer', 'Bank Transfer'),
        ('easypaisa', 'Easypaisa'),
        ('jazzcash', 'JazzCash'),
        ('other', 'Other'),
    ]

    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.CASCADE,
        related_name='payments',
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='purchase_payments_recorded',
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
        verbose_name = 'Purchase Payment'
        verbose_name_plural = 'Purchase Payments'
        ordering = ['-payment_date', '-id']

    def __str__(self):
        return self.reference_number

    @property
    def reference_number(self):
        return f"PP-{self.payment_date.year}-{self.id:05d}"

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({'amount': 'Payment amount must be greater than zero.'})
