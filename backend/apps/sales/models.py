# G:/msms/backend/apps/sales/models.py
from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings


class Sale(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('paid', 'Paid'),
        ('partial', 'Partial'),
        ('pending', 'Pending'),
    ]

    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sales'
    )
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sales_processed'
    )
    sale_date = models.DateTimeField(auto_now_add=True, db_index=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = models.CharField(
        max_length=20, choices=PAYMENT_STATUS_CHOICES, default='paid'
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


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey(
        'medicines.Medicine',
        on_delete=models.PROTECT,
        related_name='sale_items'
    )
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'Sale Item'
        verbose_name_plural = 'Sale Items'

    def __str__(self):
        return f"{self.medicine.name} x{self.quantity}"

    def clean(self):
        if self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be at least 1.'})

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        if is_new:
            # Check stock availability
            if self.medicine.quantity < self.quantity:
                raise ValidationError(
                    f"Insufficient stock for {self.medicine.name}. "
                    f"Available: {self.medicine.quantity}, Requested: {self.quantity}"
                )
            # Deduct stock
            self.medicine.quantity -= self.quantity
            self.medicine.save(update_fields=['quantity'])

        self.line_total = self.unit_price * self.quantity
        super().save(*args, **kwargs)
