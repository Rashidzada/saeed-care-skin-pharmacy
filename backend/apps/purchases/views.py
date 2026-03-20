# G:/msms/backend/apps/purchases/views.py
from django.http import HttpResponse
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import django_filters

from .models import Purchase
from .serializers import PurchaseSerializer, PurchaseCreateSerializer
from apps.accounts.permissions import IsAdminOrStaff


class PurchaseFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name='purchase_date', lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name='purchase_date', lookup_expr='lte')

    class Meta:
        model = Purchase
        fields = ['supplier']


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.select_related(
        'supplier', 'recorded_by'
    ).prefetch_related('items__medicine')
    permission_classes = [IsAuthenticated, IsAdminOrStaff]
    filterset_class = PurchaseFilter
    search_fields = ['supplier__name', 'invoice_number']
    ordering_fields = ['purchase_date', 'total_cost', 'created_at']
    ordering = ['-purchase_date']

    def get_serializer_class(self):
        if self.action == 'create':
            return PurchaseCreateSerializer
        return PurchaseSerializer

    def create(self, request, *args, **kwargs):
        serializer = PurchaseCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        purchase = serializer.save()
        return Response(PurchaseSerializer(purchase).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def invoice(self, request, pk=None):
        """Generate PDF purchase order invoice."""
        purchase = self.get_object()
        try:
            from xhtml2pdf import pisa
            from django.template.loader import render_to_string
            import io

            html_string = render_to_string('invoices/purchase_invoice.html', {
                'purchase': purchase,
                'items': purchase.items.select_related('medicine').all(),
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
            response['Content-Disposition'] = f'inline; filename="PO-{purchase.po_number}.pdf"'
            return response
        except Exception as e:
            return Response({'error': f'PDF generation failed: {str(e)}'}, status=500)
