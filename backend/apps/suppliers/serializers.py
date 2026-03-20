# G:/msms/backend/apps/suppliers/serializers.py
from rest_framework import serializers
from .models import Supplier


class SupplierSerializer(serializers.ModelSerializer):
    medicine_count = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = ['id', 'name', 'contact_person', 'phone', 'email',
                  'address', 'is_active', 'medicine_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_medicine_count(self, obj):
        return obj.medicines.filter(is_active=True).count()
