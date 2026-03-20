# G:/msms/backend/apps/medicines/views.py
from datetime import timedelta
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import django_filters

from .models import Medicine
from .serializers import MedicineSerializer
from apps.accounts.permissions import IsAdmin, IsAdminOrStaff


class MedicineFilter(django_filters.FilterSet):
    category = django_filters.CharFilter(lookup_expr='iexact')
    min_price = django_filters.NumberFilter(field_name='unit_price', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='unit_price', lookup_expr='lte')
    expiry_before = django_filters.DateFilter(field_name='expiry_date', lookup_expr='lte')
    expiry_after = django_filters.DateFilter(field_name='expiry_date', lookup_expr='gte')

    class Meta:
        model = Medicine
        fields = ['category', 'is_active', 'supplier']


class MedicineViewSet(viewsets.ModelViewSet):
    queryset = Medicine.objects.select_related('supplier').filter(is_active=True)
    serializer_class = MedicineSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = MedicineFilter
    search_fields = ['name', 'generic_name', 'batch_number', 'manufacturer']
    ordering_fields = ['name', 'expiry_date', 'quantity', 'unit_price', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        # Include inactive for admin
        if self.request.user.role == 'admin':
            return Medicine.objects.select_related('supplier').all()
        return Medicine.objects.select_related('supplier').filter(is_active=True)

    def get_permissions(self):
        if self.action in ('destroy', 'create', 'update', 'partial_update'):
            return [IsAuthenticated(), IsAdminOrStaff()]
        return [IsAuthenticated()]

    def perform_destroy(self, instance):
        # Soft delete
        instance.is_active = False
        instance.save()

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Return medicines at or below their minimum stock threshold."""
        medicines = [m for m in self.get_queryset() if m.quantity <= m.min_stock_threshold]
        serializer = self.get_serializer(medicines, many=True)
        return Response({
            'count': len(medicines),
            'results': serializer.data
        })

    @action(detail=False, methods=['get'])
    def near_expiry(self, request):
        """Return medicines expiring within the specified number of days (default 30)."""
        days = int(request.query_params.get('days', 30))
        cutoff_date = timezone.now().date() + timedelta(days=days)
        today = timezone.now().date()
        medicines = self.get_queryset().filter(
            expiry_date__lte=cutoff_date,
            expiry_date__gte=today
        )
        serializer = self.get_serializer(medicines, many=True)
        return Response({
            'count': medicines.count(),
            'days': days,
            'results': serializer.data
        })

    @action(detail=False, methods=['get'])
    def expired(self, request):
        """Return all expired medicines."""
        today = timezone.now().date()
        medicines = self.get_queryset().filter(expiry_date__lt=today)
        serializer = self.get_serializer(medicines, many=True)
        return Response({
            'count': medicines.count(),
            'results': serializer.data
        })

    @action(detail=False, methods=['get'])
    def alerts_summary(self, request):
        """Dashboard: count of low stock and near expiry."""
        days = 30
        cutoff = timezone.now().date() + timedelta(days=days)
        today = timezone.now().date()
        qs = self.get_queryset()
        low_stock_count = sum(1 for m in qs if m.quantity <= m.min_stock_threshold)
        near_expiry_count = qs.filter(expiry_date__lte=cutoff, expiry_date__gte=today).count()
        expired_count = qs.filter(expiry_date__lt=today).count()
        total_count = qs.count()
        return Response({
            'low_stock': low_stock_count,
            'near_expiry': near_expiry_count,
            'expired': expired_count,
            'total': total_count,
        })
