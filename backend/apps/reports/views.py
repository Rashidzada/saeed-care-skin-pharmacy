import csv
import io
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDay
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.medicines.models import Medicine
from apps.purchases.models import Purchase, PurchasePayment
from apps.sales.models import Sale, SaleItem, SalePayment, SaleReturn, SaleReturnItem


def _serialize_returns(returns):
    from apps.sales.serializers import SaleReturnSerializer

    return SaleReturnSerializer(returns, many=True).data


def _decimal(value):
    return value or Decimal('0')


def _sales_queryset():
    return Sale.objects.filter(is_voided=False).select_related(
        'customer',
        'processed_by',
    ).prefetch_related(
        'items__medicine',
        'payments__recorded_by',
        'returns__processed_by',
        'returns__items__medicine',
        'returns__items__sale_item',
    )


def _purchases_queryset():
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


def _build_receivables_summary(sales):
    summary = {
        'outstanding_total': Decimal('0'),
        'paid_total': Decimal('0'),
        'credit_total': Decimal('0'),
        'pending_invoices': 0,
        'partial_invoices': 0,
        'paid_invoices': 0,
        'registered_customer_outstanding': Decimal('0'),
        'walk_in_outstanding': Decimal('0'),
        'customers': [],
    }
    customer_rows = {}

    for sale in sales:
        summary['outstanding_total'] += sale.outstanding_amount
        summary['paid_total'] += sale.total_paid_amount
        summary['credit_total'] += sale.credit_amount

        if sale.payment_status == 'paid':
            summary['paid_invoices'] += 1
        elif sale.payment_status == 'partial':
            summary['partial_invoices'] += 1
        else:
            summary['pending_invoices'] += 1

        if sale.outstanding_amount <= 0:
            continue

        if sale.customer_id:
            summary['registered_customer_outstanding'] += sale.outstanding_amount
            entry = customer_rows.setdefault(
                sale.customer_id,
                {
                    'id': sale.customer_id,
                    'name': sale.customer.name,
                    'phone': sale.customer.phone,
                    'outstanding_amount': Decimal('0'),
                    'invoice_count': 0,
                    'paid_amount': Decimal('0'),
                },
            )
            entry['outstanding_amount'] += sale.outstanding_amount
            entry['invoice_count'] += 1
            entry['paid_amount'] += sale.total_paid_amount
        else:
            summary['walk_in_outstanding'] += sale.outstanding_amount

    summary['customers'] = sorted(
        customer_rows.values(),
        key=lambda row: row['outstanding_amount'],
        reverse=True,
    )[:8]
    return summary


def _build_payables_summary(purchases):
    summary = {
        'outstanding_total': Decimal('0'),
        'paid_total': Decimal('0'),
        'credit_total': Decimal('0'),
        'pending_invoices': 0,
        'partial_invoices': 0,
        'paid_invoices': 0,
        'suppliers': [],
    }
    supplier_rows = {}

    for purchase in purchases:
        summary['outstanding_total'] += purchase.outstanding_amount
        summary['paid_total'] += purchase.total_paid_amount
        summary['credit_total'] += purchase.credit_amount

        if purchase.payment_status == 'paid':
            summary['paid_invoices'] += 1
        elif purchase.payment_status == 'partial':
            summary['partial_invoices'] += 1
        else:
            summary['pending_invoices'] += 1

        if purchase.outstanding_amount <= 0:
            continue

        entry = supplier_rows.setdefault(
            purchase.supplier_id,
            {
                'id': purchase.supplier_id,
                'name': purchase.supplier.name,
                'phone': purchase.supplier.phone,
                'outstanding_amount': Decimal('0'),
                'invoice_count': 0,
                'paid_amount': Decimal('0'),
            },
        )
        entry['outstanding_amount'] += purchase.outstanding_amount
        entry['invoice_count'] += 1
        entry['paid_amount'] += purchase.total_paid_amount

    summary['suppliers'] = sorted(
        supplier_rows.values(),
        key=lambda row: row['outstanding_amount'],
        reverse=True,
    )[:8]
    return summary


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def daily_sales(request):
    date_str = request.query_params.get('date', date.today().isoformat())
    try:
        report_date = date.fromisoformat(date_str)
    except ValueError:
        return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

    sales = _sales_queryset().filter(sale_date__date=report_date)
    returns = SaleReturn.objects.filter(
        return_date__date=report_date,
        sale__is_voided=False,
    ).select_related('sale__customer', 'processed_by').prefetch_related(
        'items__medicine',
        'items__sale_item',
    )

    gross_revenue = _decimal(sales.aggregate(total=Sum('total_amount'))['total'])
    returns_amount = _decimal(returns.aggregate(total=Sum('total_amount'))['total'])
    gross_items_sold = (
        SaleItem.objects.filter(
            sale__sale_date__date=report_date,
            sale__is_voided=False,
        ).aggregate(total=Sum('quantity'))['total']
        or 0
    )
    items_returned = (
        SaleReturnItem.objects.filter(
            sale_return__return_date__date=report_date,
            sale_return__sale__is_voided=False,
        ).aggregate(total=Sum('quantity'))['total']
        or 0
    )
    payments_received = _decimal(
        SalePayment.objects.filter(payment_date__date=report_date).aggregate(total=Sum('amount'))[
            'total'
        ]
    )
    payments_made = _decimal(
        PurchasePayment.objects.filter(payment_date__date=report_date).aggregate(total=Sum('amount'))[
            'total'
        ]
    )

    from apps.sales.serializers import SaleSerializer

    return Response(
        {
            'date': date_str,
            'gross_revenue': gross_revenue,
            'returns_amount': returns_amount,
            'net_revenue': gross_revenue - returns_amount,
            'total_revenue': gross_revenue - returns_amount,
            'total_transactions': sales.count(),
            'return_transactions': returns.count(),
            'gross_items_sold': gross_items_sold,
            'items_returned': items_returned,
            'net_items_sold': gross_items_sold - items_returned,
            'total_items_sold': gross_items_sold - items_returned,
            'payments_received': payments_received,
            'payments_made': payments_made,
            'sales': SaleSerializer(sales, many=True).data,
            'returns': _serialize_returns(returns),
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def monthly_sales(request):
    year = int(request.query_params.get('year', date.today().year))
    month = int(request.query_params.get('month', date.today().month))

    sales = Sale.objects.filter(
        sale_date__year=year,
        sale_date__month=month,
        is_voided=False,
    )
    returns = SaleReturn.objects.filter(
        return_date__year=year,
        return_date__month=month,
        sale__is_voided=False,
    )

    gross_revenue = _decimal(sales.aggregate(total=Sum('total_amount'))['total'])
    returns_amount = _decimal(returns.aggregate(total=Sum('total_amount'))['total'])
    payments_received = _decimal(
        SalePayment.objects.filter(payment_date__year=year, payment_date__month=month).aggregate(
            total=Sum('amount')
        )['total']
    )
    payments_made = _decimal(
        PurchasePayment.objects.filter(
            payment_date__year=year,
            payment_date__month=month,
        ).aggregate(total=Sum('amount'))['total']
    )

    sales_by_day = {
        item['day'].date(): item
        for item in sales.annotate(day=TruncDay('sale_date'))
        .values('day')
        .annotate(gross_revenue=Sum('total_amount'), transactions=Count('id'))
        .order_by('day')
    }
    returns_by_day = {
        item['day'].date(): item
        for item in returns.annotate(day=TruncDay('return_date'))
        .values('day')
        .annotate(returns_amount=Sum('total_amount'), return_transactions=Count('id'))
        .order_by('day')
    }
    receipts_by_day = {
        item['day'].date(): item
        for item in SalePayment.objects.filter(payment_date__year=year, payment_date__month=month)
        .annotate(day=TruncDay('payment_date'))
        .values('day')
        .annotate(payments_received=Sum('amount'))
        .order_by('day')
    }

    daily_breakdown = []
    for day in sorted(set(sales_by_day.keys()) | set(returns_by_day.keys()) | set(receipts_by_day.keys())):
        sales_item = sales_by_day.get(day, {})
        returns_item = returns_by_day.get(day, {})
        receipts_item = receipts_by_day.get(day, {})
        day_gross = _decimal(sales_item.get('gross_revenue'))
        day_returns = _decimal(returns_item.get('returns_amount'))
        daily_breakdown.append(
            {
                'date': day.isoformat(),
                'gross_revenue': day_gross,
                'returns_amount': day_returns,
                'revenue': day_gross - day_returns,
                'payments_received': _decimal(receipts_item.get('payments_received')),
                'transactions': sales_item.get('transactions', 0),
                'return_transactions': returns_item.get('return_transactions', 0),
            }
        )

    return Response(
        {
            'year': year,
            'month': month,
            'gross_revenue': gross_revenue,
            'returns_amount': returns_amount,
            'net_revenue': gross_revenue - returns_amount,
            'total_revenue': gross_revenue - returns_amount,
            'total_transactions': sales.count(),
            'return_transactions': returns.count(),
            'payments_received': payments_received,
            'payments_made': payments_made,
            'daily_breakdown': daily_breakdown,
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_report(request):
    medicines = Medicine.objects.select_related('supplier').filter(is_active=True)
    today = timezone.now().date()
    cutoff = today + timedelta(days=30)

    data = []
    for medicine in medicines:
        data.append(
            {
                'id': medicine.id,
                'name': medicine.name,
                'category': medicine.category,
                'batch_number': medicine.batch_number,
                'expiry_date': medicine.expiry_date.isoformat(),
                'quantity': medicine.quantity,
                'min_stock_threshold': medicine.min_stock_threshold,
                'unit_price': str(medicine.unit_price),
                'supplier': medicine.supplier.name if medicine.supplier else '',
                'status': medicine.status,
            }
        )

    summary = {
        'total_medicines': len(data),
        'low_stock': sum(
            1 for medicine in medicines if medicine.quantity <= medicine.min_stock_threshold
        ),
        'out_of_stock': sum(1 for medicine in medicines if medicine.quantity == 0),
        'near_expiry': medicines.filter(expiry_date__lte=cutoff, expiry_date__gte=today).count(),
        'expired': medicines.filter(expiry_date__lt=today).count(),
    }

    return Response({'summary': summary, 'medicines': data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def expiry_report(request):
    days = int(request.query_params.get('days', 30))
    today = timezone.now().date()
    cutoff = today + timedelta(days=days)

    near_expiry = Medicine.objects.select_related('supplier').filter(
        is_active=True,
        expiry_date__lte=cutoff,
        expiry_date__gte=today,
    ).order_by('expiry_date')
    expired = Medicine.objects.select_related('supplier').filter(
        is_active=True,
        expiry_date__lt=today,
    ).order_by('expiry_date')

    def serialize(medicine):
        return {
            'id': medicine.id,
            'name': medicine.name,
            'batch_number': medicine.batch_number,
            'expiry_date': medicine.expiry_date.isoformat(),
            'quantity': medicine.quantity,
            'supplier': medicine.supplier.name if medicine.supplier else '',
            'days_until_expiry': (medicine.expiry_date - today).days,
        }

    return Response(
        {
            'days_window': days,
            'near_expiry_count': near_expiry.count(),
            'expired_count': expired.count(),
            'near_expiry': [serialize(medicine) for medicine in near_expiry],
            'expired': [serialize(medicine) for medicine in expired],
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    today = timezone.now().date()

    today_sales = _sales_queryset().filter(sale_date__date=today)
    today_returns = SaleReturn.objects.filter(
        return_date__date=today,
        sale__is_voided=False,
    )
    gross_revenue = _decimal(today_sales.aggregate(total=Sum('total_amount'))['total'])
    returns_amount = _decimal(today_returns.aggregate(total=Sum('total_amount'))['total'])
    today_count = today_sales.count()

    seven_days_ago = today - timedelta(days=6)
    sales_chart = {
        item['day'].date(): item
        for item in Sale.objects.filter(
            sale_date__date__gte=seven_days_ago,
            sale_date__date__lte=today,
            is_voided=False,
        )
        .annotate(day=TruncDay('sale_date'))
        .values('day')
        .annotate(gross_revenue=Sum('total_amount'), count=Count('id'))
        .order_by('day')
    }
    returns_chart = {
        item['day'].date(): item
        for item in SaleReturn.objects.filter(
            return_date__date__gte=seven_days_ago,
            return_date__date__lte=today,
            sale__is_voided=False,
        )
        .annotate(day=TruncDay('return_date'))
        .values('day')
        .annotate(returns_amount=Sum('total_amount'), count=Count('id'))
        .order_by('day')
    }
    receipts_chart = {
        item['day'].date(): item
        for item in SalePayment.objects.filter(
            payment_date__date__gte=seven_days_ago,
            payment_date__date__lte=today,
        )
        .annotate(day=TruncDay('payment_date'))
        .values('day')
        .annotate(payments_received=Sum('amount'))
        .order_by('day')
    }

    chart_list = []
    for offset in range(7):
        day = seven_days_ago + timedelta(days=offset)
        sale_item = sales_chart.get(day, {})
        return_item = returns_chart.get(day, {})
        receipt_item = receipts_chart.get(day, {})
        day_gross = _decimal(sale_item.get('gross_revenue'))
        day_returns = _decimal(return_item.get('returns_amount'))
        chart_list.append(
            {
                'date': day.isoformat(),
                'revenue': float(day_gross - day_returns),
                'gross_revenue': float(day_gross),
                'returns_amount': float(day_returns),
                'payments_received': float(_decimal(receipt_item.get('payments_received'))),
                'count': sale_item.get('count', 0),
                'return_count': return_item.get('count', 0),
            }
        )

    cutoff = today + timedelta(days=30)
    medicines = Medicine.objects.filter(is_active=True)
    low_stock_count = sum(
        1 for medicine in medicines if medicine.quantity <= medicine.min_stock_threshold
    )
    near_expiry_count = medicines.filter(expiry_date__lte=cutoff, expiry_date__gte=today).count()
    expired_count = medicines.filter(expiry_date__lt=today).count()
    total_medicines = medicines.count()

    recent_sales = _sales_queryset()[:10]
    all_sales = list(_sales_queryset())
    all_purchases = list(_purchases_queryset())
    receivables = _build_receivables_summary(all_sales)
    payables = _build_payables_summary(all_purchases)
    payments_received_today = _decimal(
        SalePayment.objects.filter(payment_date__date=today).aggregate(total=Sum('amount'))['total']
    )
    payments_made_today = _decimal(
        PurchasePayment.objects.filter(payment_date__date=today).aggregate(total=Sum('amount'))[
            'total'
        ]
    )

    from apps.sales.serializers import SaleSerializer

    return Response(
        {
            'today': {
                'revenue': gross_revenue - returns_amount,
                'gross_revenue': gross_revenue,
                'returns_amount': returns_amount,
                'transactions': today_count,
                'return_transactions': today_returns.count(),
                'payments_received': payments_received_today,
                'payments_made': payments_made_today,
            },
            'medicines': {
                'total': total_medicines,
                'low_stock': low_stock_count,
                'near_expiry': near_expiry_count,
                'expired': expired_count,
            },
            'receivables': receivables,
            'payables': payables,
            'chart_data': chart_list,
            'recent_sales': SaleSerializer(recent_sales, many=True).data,
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_daily_sales_csv(request):
    date_str = request.query_params.get('date', date.today().isoformat())
    try:
        report_date = date.fromisoformat(date_str)
    except ValueError:
        return Response({'error': 'Invalid date format.'}, status=400)

    sales = _sales_queryset().filter(sale_date__date=report_date)
    returns = SaleReturn.objects.filter(
        return_date__date=report_date,
        sale__is_voided=False,
    ).select_related('sale__customer', 'processed_by')

    gross_revenue = _decimal(sales.aggregate(total=Sum('total_amount'))['total'])
    returns_amount = _decimal(returns.aggregate(total=Sum('total_amount'))['total'])
    gross_items_sold = (
        SaleItem.objects.filter(
            sale__sale_date__date=report_date,
            sale__is_voided=False,
        ).aggregate(total=Sum('quantity'))['total']
        or 0
    )
    items_returned = (
        SaleReturnItem.objects.filter(
            sale_return__return_date__date=report_date,
            sale_return__sale__is_voided=False,
        ).aggregate(total=Sum('quantity'))['total']
        or 0
    )
    payments_received = _decimal(
        SalePayment.objects.filter(payment_date__date=report_date).aggregate(total=Sum('amount'))[
            'total'
        ]
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            'Invoice #',
            'Date',
            'Customer',
            'Staff',
            'Subtotal',
            'Tax',
            'Discount',
            'Invoice Total',
            'Returned Amount',
            'Net Total',
            'Paid Amount',
            'Outstanding',
            'Status',
        ]
    )

    for sale in sales:
        writer.writerow(
            [
                sale.invoice_number,
                sale.sale_date.strftime('%Y-%m-%d %H:%M'),
                sale.customer.name if sale.customer else 'Walk-in',
                sale.processed_by.username if sale.processed_by else '',
                sale.subtotal,
                sale.tax_amount,
                sale.discount,
                sale.total_amount,
                sale.returned_amount,
                sale.net_total_amount,
                sale.total_paid_amount,
                sale.outstanding_amount,
                sale.payment_status,
            ]
        )

    if returns.exists():
        writer.writerow([])
        writer.writerow(
            ['Return Ref', 'Original Invoice', 'Date', 'Customer', 'Staff', 'Returned Total']
        )
        for sale_return in returns:
            writer.writerow(
                [
                    sale_return.reference_number,
                    sale_return.sale.invoice_number,
                    sale_return.return_date.strftime('%Y-%m-%d %H:%M'),
                    sale_return.sale.customer.name if sale_return.sale.customer else 'Walk-in',
                    sale_return.processed_by.username if sale_return.processed_by else '',
                    sale_return.total_amount,
                ]
            )

    writer.writerow([])
    writer.writerow(['Summary'])
    writer.writerow(['Gross Revenue', gross_revenue])
    writer.writerow(['Returns Amount', returns_amount])
    writer.writerow(['Net Revenue', gross_revenue - returns_amount])
    writer.writerow(['Payments Received', payments_received])
    writer.writerow(['Items Sold', gross_items_sold])
    writer.writerow(['Items Returned', items_returned])
    writer.writerow(['Net Items Sold', gross_items_sold - items_returned])

    response = HttpResponse(output.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="sales-{date_str}.csv"'
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_stock_csv(request):
    medicines = Medicine.objects.select_related('supplier').filter(is_active=True).order_by('name')

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            'Name',
            'Category',
            'Manufacturer',
            'Batch',
            'Expiry Date',
            'Quantity',
            'Min Threshold',
            'Unit Price',
            'Supplier',
            'Status',
        ]
    )

    for medicine in medicines:
        writer.writerow(
            [
                medicine.name,
                medicine.category,
                medicine.manufacturer,
                medicine.batch_number,
                medicine.expiry_date.isoformat(),
                medicine.quantity,
                medicine.min_stock_threshold,
                medicine.unit_price,
                medicine.supplier.name if medicine.supplier else '',
                medicine.status,
            ]
        )

    response = HttpResponse(output.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="stock-report.csv"'
    return response
