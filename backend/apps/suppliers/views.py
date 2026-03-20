# G:/msms/backend/apps/suppliers/views.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Supplier
from .serializers import SupplierSerializer
from apps.accounts.permissions import IsAdminOrStaff


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'contact_person', 'phone', 'email']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdminOrStaff()]
        return [IsAuthenticated()]

    def get_queryset(self):
        active_only = self.request.query_params.get('active', None)
        if active_only == 'true':
            return Supplier.objects.filter(is_active=True)
        return Supplier.objects.all()
