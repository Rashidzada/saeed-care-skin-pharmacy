import io

from django.conf import settings
from django.http import HttpResponse
from django.template.loader import render_to_string
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import django_filters
from xhtml2pdf import pisa

from apps.accounts.permissions import IsAdminOrStaff
from .models import Purchase
from .serializers import (
    PurchaseCreateSerializer,
    PurchasePaymentCreateSerializer,
    PurchasePaymentSerializer,
    PurchaseReturnCreateSerializer,
    PurchaseReturnSerializer,
    PurchaseSerializer,
)


class PurchaseFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name='purchase_date', lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name='purchase_date', lookup_expr='lte')
    payment_status = django_filters.CharFilter(lookup_expr='iexact')

    class Meta:
        model = Purchase
        fields = ['supplier', 'payment_status']


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.select_related(
        'supplier',
        'recorded_by',
    ).prefetch_related(
        'items__medicine',
        'payments__recorded_by',
        'returns__recorded_by',
        'returns__items__medicine',
        'returns__items__purchase_item',
    )
    permission_classes = [IsAuthenticated, IsAdminOrStaff]
    filterset_class = PurchaseFilter
    search_fields = ['supplier__name', 'invoice_number']
    ordering_fields = ['purchase_date', 'total_cost', 'created_at']
    ordering = ['-purchase_date']

    def get_queryset(self):
        return Purchase.objects.select_related(
            'supplier',
            'recorded_by',
        ).prefetch_related(
            'items__medicine',
            'payments__recorded_by',
            'returns__recorded_by',
            'returns__items__medicine',
            'returns__items__purchase_item',
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return PurchaseCreateSerializer
        return PurchaseSerializer

    def create(self, request, *args, **kwargs):
        serializer = PurchaseCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        purchase = serializer.save()
        return Response(PurchaseSerializer(purchase).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminOrStaff], url_path='payments')
    def create_payment(self, request, pk=None):
        purchase = self.get_object()
        serializer = PurchasePaymentCreateSerializer(
            data=request.data,
            context={'request': request, 'purchase': purchase},
        )
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        refreshed_purchase = self.get_queryset().get(pk=purchase.pk)
        return Response(
            {
                'message': 'Supplier payment recorded successfully.',
                'payment': PurchasePaymentSerializer(payment).data,
                'purchase': PurchaseSerializer(refreshed_purchase).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminOrStaff], url_path='returns')
    def create_return(self, request, pk=None):
        purchase = self.get_object()
        serializer = PurchaseReturnCreateSerializer(
            data=request.data,
            context={'request': request, 'purchase': purchase},
        )
        serializer.is_valid(raise_exception=True)
        purchase_return = serializer.save()
        refreshed_purchase = self.get_queryset().get(pk=purchase.pk)
        return Response(
            {
                'message': 'Supplier return recorded successfully.',
                'return': PurchaseReturnSerializer(purchase_return).data,
                'purchase': PurchaseSerializer(refreshed_purchase).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'])
    def invoice(self, request, pk=None):
        purchase = self.get_object()
        try:
            html_string = render_to_string(
                'invoices/purchase_invoice.html',
                {
                    'purchase': purchase,
                    'items': purchase.items.select_related('medicine').all(),
                    'payments': purchase.payments.select_related('recorded_by').all(),
                    'store_name': settings.STORE_NAME,
                    'store_address': settings.STORE_ADDRESS,
                    'store_phone': settings.STORE_PHONE,
                    'store_email': settings.STORE_EMAIL,
                },
            )

            pdf_buffer = io.BytesIO()
            pisa_status = pisa.CreatePDF(html_string, dest=pdf_buffer)
            if pisa_status.err:
                return Response({'error': 'PDF generation failed: rendering error'}, status=500)

            pdf_buffer.seek(0)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="PO-{purchase.po_number}.pdf"'
            return response
        except Exception as exc:
            return Response({'error': f'PDF generation failed: {str(exc)}'}, status=500)

    @action(detail=True, methods=['get'], url_path='receipt')
    def receipt(self, request, pk=None):
        purchase = self.get_object()
        html_string = render_to_string(
            'invoices/purchase_receipt.html',
            {
                'purchase': purchase,
                'items': purchase.items.select_related('medicine').all(),
                'payments': purchase.payments.select_related('recorded_by').all(),
                'store_name': settings.STORE_NAME,
                'store_address': settings.STORE_ADDRESS,
                'store_phone': settings.STORE_PHONE,
                'store_email': settings.STORE_EMAIL,
            },
        )
        return HttpResponse(html_string)
