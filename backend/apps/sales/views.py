from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.template.loader import render_to_string
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import django_filters
from xhtml2pdf import pisa

from apps.accounts.permissions import IsAdmin, IsAdminOrStaff
from .models import Sale, SaleItem
from .serializers import (
    SaleCreateSerializer,
    SalePaymentCreateSerializer,
    SalePaymentSerializer,
    SaleReturnCreateSerializer,
    SaleReturnSerializer,
    SaleSerializer,
)


class SaleFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name='sale_date', lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name='sale_date', lookup_expr='lte')
    payment_status = django_filters.CharFilter(lookup_expr='iexact')

    class Meta:
        model = Sale
        fields = ['payment_status', 'is_voided', 'customer']


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.select_related(
        'customer',
        'processed_by',
    ).prefetch_related(
        'items__medicine',
        'payments__recorded_by',
        'returns__processed_by',
        'returns__items__medicine',
        'returns__items__sale_item',
    ).filter(is_voided=False)
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
            'customer',
            'processed_by',
        ).prefetch_related(
            'items__medicine',
            'payments__recorded_by',
            'returns__processed_by',
            'returns__items__medicine',
            'returns__items__sale_item',
        )
        if self.request.user.role != 'admin':
            qs = qs.filter(is_voided=False)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = SaleCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()
        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminOrStaff], url_path='payments')
    def create_payment(self, request, pk=None):
        sale = self.get_object()
        serializer = SalePaymentCreateSerializer(
            data=request.data,
            context={'request': request, 'sale': sale},
        )
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        refreshed_sale = self.get_queryset().get(pk=sale.pk)
        return Response(
            {
                'message': 'Customer payment recorded successfully.',
                'payment': SalePaymentSerializer(payment).data,
                'sale': SaleSerializer(refreshed_sale).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminOrStaff], url_path='returns')
    def create_return(self, request, pk=None):
        sale = self.get_object()
        serializer = SaleReturnCreateSerializer(
            data=request.data,
            context={'request': request, 'sale': sale},
        )
        serializer.is_valid(raise_exception=True)
        sale_return = serializer.save()
        refreshed_sale = self.get_queryset().get(pk=sale.pk)
        return Response(
            {
                'message': 'Customer return recorded successfully.',
                'return': SaleReturnSerializer(sale_return).data,
                'sale': SaleSerializer(refreshed_sale).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdmin])
    def void(self, request, pk=None):
        sale = self.get_object()
        if sale.is_voided:
            return Response({'error': 'Sale is already voided.'}, status=status.HTTP_400_BAD_REQUEST)
        if sale.returns.exists():
            return Response(
                {'error': 'This sale already has returns recorded. Use returns instead of voiding.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for item in sale.items.select_related('medicine').all():
                item.medicine.quantity += item.quantity
                item.medicine.save(update_fields=['quantity'])
            sale.is_voided = True
            sale.save(update_fields=['is_voided'])

        return Response({'message': 'Sale voided successfully.'})

    @action(detail=True, methods=['get'])
    def invoice(self, request, pk=None):
        sale = self.get_object()
        try:
            html_string = render_to_string(
                'invoices/sale_invoice.html',
                {
                    'sale': sale,
                    'items': sale.items.select_related('medicine').all(),
                    'payments': sale.payments.select_related('recorded_by').all(),
                    'store_name': settings.STORE_NAME,
                    'store_address': settings.STORE_ADDRESS,
                    'store_phone': settings.STORE_PHONE,
                    'store_email': settings.STORE_EMAIL,
                },
            )

            pdf_buffer = __import__('io').BytesIO()
            pisa_status = pisa.CreatePDF(html_string, dest=pdf_buffer)
            if pisa_status.err:
                return Response({'error': 'PDF generation failed: rendering error'}, status=500)

            pdf_buffer.seek(0)
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="invoice-{sale.invoice_number}.pdf"'
            return response
        except Exception as exc:
            return Response({'error': f'PDF generation failed: {str(exc)}'}, status=500)

    @action(detail=True, methods=['get'], url_path='receipt')
    def receipt(self, request, pk=None):
        sale = self.get_object()
        html_string = render_to_string(
            'invoices/sale_receipt.html',
            {
                'sale': sale,
                'items': sale.items.select_related('medicine').all(),
                'payments': sale.payments.select_related('recorded_by').all(),
                'store_name': settings.STORE_NAME,
                'store_address': settings.STORE_ADDRESS,
                'store_phone': settings.STORE_PHONE,
                'store_email': settings.STORE_EMAIL,
            },
        )
        return HttpResponse(html_string)
