# G:/msms/backend/apps/customers/serializers.py
from rest_framework import serializers
from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    purchase_count = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'email', 'address',
                  'purchase_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_purchase_count(self, obj):
        return obj.sales.filter(is_voided=False).count()
