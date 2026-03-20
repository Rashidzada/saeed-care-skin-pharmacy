# G:/msms/backend/apps/medicines/models.py
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone


class Medicine(models.Model):
    CATEGORY_CHOICES = [
        ('tablet', 'Tablet'),
        ('capsule', 'Capsule'),
        ('syrup', 'Syrup'),
        ('injection', 'Injection'),
        ('cream', 'Cream'),
        ('drops', 'Drops'),
        ('inhaler', 'Inhaler'),
        ('powder', 'Powder'),
        ('other', 'Other'),
    ]

    name = models.CharField(max_length=255, db_index=True)
    generic_name = models.CharField(max_length=255, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='tablet')
    manufacturer = models.CharField(max_length=255)
    batch_number = models.CharField(max_length=100, db_index=True)
    expiry_date = models.DateField(db_index=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.IntegerField(default=0)
    min_stock_threshold = models.IntegerField(default=10)
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='medicines'
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Medicine'
        verbose_name_plural = 'Medicines'
        ordering = ['name']
        indexes = [
            models.Index(fields=['name', 'batch_number']),
            models.Index(fields=['expiry_date']),
        ]

    def __str__(self):
        return f"{self.name} (Batch: {self.batch_number})"

    def clean(self):
        if self.quantity < 0:
            raise ValidationError({'quantity': 'Quantity cannot be negative.'})

    @property
    def is_low_stock(self):
        return self.quantity <= self.min_stock_threshold

    @property
    def is_expired(self):
        return self.expiry_date < timezone.now().date()

    @property
    def is_near_expiry(self, days=30):
        from datetime import timedelta
        return (
            not self.is_expired and
            self.expiry_date <= (timezone.now().date() + timedelta(days=days))
        )

    @property
    def status(self):
        if self.is_expired:
            return 'expired'
        if self.quantity == 0:
            return 'out_of_stock'
        if self.is_low_stock:
            return 'low_stock'
        if self.is_near_expiry:
            return 'near_expiry'
        return 'healthy'
