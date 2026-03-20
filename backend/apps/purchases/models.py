# G:/msms/backend/apps/purchases/models.py
from django.db import models
from django.conf import settings


class Purchase(models.Model):
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name='purchases'
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='purchases_recorded'
    )
    purchase_date = models.DateField(db_index=True)
    invoice_number = models.CharField(max_length=100, blank=True, db_index=True)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
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


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey(
        'medicines.Medicine',
        on_delete=models.PROTECT,
        related_name='purchase_items'
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

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            # Increment medicine stock
            self.medicine.quantity += self.quantity
            # Update batch and expiry if provided
            if self.batch_number:
                self.medicine.batch_number = self.batch_number
            if self.expiry_date:
                self.medicine.expiry_date = self.expiry_date
            self.medicine.save(update_fields=['quantity', 'batch_number', 'expiry_date'])
