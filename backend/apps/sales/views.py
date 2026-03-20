# G:/msms/backend/apps/sales/views.py
import csv
import io
from datetime import datetime
from django.http import HttpResponse
from django.conf import settings
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import django_filters

from .models import Sale, SaleItem
from .serializers import SaleSerializer, SaleCreateSerializer
from apps.accounts.permissions import IsAdmin


class SaleFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name='sale_date', lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name='sale_date', lookup_expr='lte')
    payment_status = django_filters.CharFilter(lookup_expr='iexact')

    class Meta:
        model = Sale
        fields = ['payment_status', 'is_voided', 'customer']


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.select_related(
        'customer', 'processed_by'
    ).prefetch_related('items__medicine').filter(is_voided=False)
    permission_classes = [IsAuthenticated]
    filterset_class = SaleFilter
    search_fields = ['customer__name', 'id']
    ordering_fields = ['sale_date', 'total_amount']
    ordering = ['-sale_date']

    def get_serializer_class(self):
        if self.action == 'create':
            return SaleCreateSerializer
        return SaleSerializer

    def get_queryset(self):
        qs = Sale.objects.select_related(
            'customer', 'processed_by'
        ).prefetch_related('items__medicine')
        if self.request.user.role != 'admin':
            qs = qs.filter(is_voided=False)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = SaleCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()
        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdmin])
    def void(self, request, pk=None):
        """Void a sale and restore stock."""
        sale = self.get_object()
        if sale.is_voided:
            return Response({'error': 'Sale is already voided.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Restore stock
            for item in sale.items.select_related('medicine').all():
                item.medicine.quantity += item.quantity
                item.medicine.save(update_fields=['quantity'])
            sale.is_voided = True
            sale.save(update_fields=['is_voided'])

        return Response({'message': 'Sale voided successfully.'})

    @action(detail=True, methods=['get'])
    def invoice(self, request, pk=None):
        """Generate and return a PDF invoice for this sale."""
        sale = self.get_object()
        try:
            from xhtml2pdf import pisa
            from django.template.loader import render_to_string
            import io

            html_string = render_to_string('invoices/sale_invoice.html', {
                'sale': sale,
                'items': sale.items.select_related('medicine').all(),
                'store_name': settings.STORE_NAME,
                'store_address': settings.STORE_ADDRESS,
                'store_phone': settings.STORE_PHONE,
                'store_email': settings.STORE_EMAIL,
            })

            pdf_buffer = io.BytesIO()
            pisa_status = pisa.CreatePDF(html_string, dest=pdf_buffer)
            if pisa_status.err:
                return Response({'error': 'PDF generation failed: rendering error'}, status=500)

            pdf_buffer.seek(0)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="invoice-{sale.invoice_number}.pdf"'
            return response
        except Exception as e:
            return Response({'error': f'PDF generation failed: {str(e)}'}, status=500)
