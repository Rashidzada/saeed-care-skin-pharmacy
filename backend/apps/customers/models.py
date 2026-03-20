# G:/msms/backend/apps/customers/models.py
from django.db import models


class Customer(models.Model):
    name = models.CharField(max_length=255, db_index=True)
    phone = models.CharField(max_length=30, unique=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.phone})"
