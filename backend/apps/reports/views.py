# G:/msms/backend/apps/reports/views.py
import csv
import io
from datetime import date, timedelta
from django.http import HttpResponse
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncDay, TruncMonth
from django.utils import timezone
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.sales.models import Sale, SaleItem
from apps.medicines.models import Medicine
from apps.purchases.models import Purchase


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def daily_sales(request):
    """Daily sales report for a specific date."""
    date_str = request.query_params.get('date', date.today().isoformat())
    try:
        report_date = date.fromisoformat(date_str)
    except ValueError:
        return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

    sales = Sale.objects.filter(
        sale_date__date=report_date,
        is_voided=False
    ).select_related('customer', 'processed_by').prefetch_related('items__medicine')

    total_revenue = sales.aggregate(total=Sum('total_amount'))['total'] or 0
    total_transactions = sales.count()
    total_items_sold = SaleItem.objects.filter(
        sale__sale_date__date=report_date,
        sale__is_voided=False
    ).aggregate(total=Sum('quantity'))['total'] or 0

    from apps.sales.serializers import SaleSerializer
    return Response({
        'date': date_str,
        'total_revenue': total_revenue,
        'total_transactions': total_transactions,
        'total_items_sold': total_items_sold,
        'sales': SaleSerializer(sales, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def monthly_sales(request):
    """Monthly sales report."""
    year = int(request.query_params.get('year', date.today().year))
    month = int(request.query_params.get('month', date.today().month))

    sales = Sale.objects.filter(
        sale_date__year=year,
        sale_date__month=month,
        is_voided=False
    )

    total_revenue = sales.aggregate(total=Sum('total_amount'))['total'] or 0
    total_transactions = sales.count()

    # Daily breakdown within the month
    daily_breakdown = (
        sales
        .annotate(day=TruncDay('sale_date'))
        .values('day')
        .annotate(revenue=Sum('total_amount'), count=Count('id'))
        .order_by('day')
    )

    return Response({
        'year': year,
        'month': month,
        'total_revenue': total_revenue,
        'total_transactions': total_transactions,
        'daily_breakdown': [
            {
                'date': item['day'].date().isoformat(),
                'revenue': item['revenue'],
                'transactions': item['count'],
            }
            for item in daily_breakdown
        ],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_report(request):
    """Current stock status report."""
    medicines = Medicine.objects.select_related('supplier').filter(is_active=True)
    today = timezone.now().date()
    cutoff = today + timedelta(days=30)

    data = []
    for m in medicines:
        data.append({
            'id': m.id,
            'name': m.name,
            'category': m.category,
            'batch_number': m.batch_number,
            'expiry_date': m.expiry_date.isoformat(),
            'quantity': m.quantity,
            'min_stock_threshold': m.min_stock_threshold,
            'unit_price': str(m.unit_price),
            'supplier': m.supplier.name if m.supplier else '',
            'status': m.status,
        })

    summary = {
        'total_medicines': len(data),
        'low_stock': sum(1 for m in medicines if m.quantity <= m.min_stock_threshold),
        'out_of_stock': sum(1 for m in medicines if m.quantity == 0),
        'near_expiry': medicines.filter(expiry_date__lte=cutoff, expiry_date__gte=today).count(),
        'expired': medicines.filter(expiry_date__lt=today).count(),
    }

    return Response({'summary': summary, 'medicines': data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def expiry_report(request):
    """Medicines expiring within N days."""
    days = int(request.query_params.get('days', 30))
    today = timezone.now().date()
    cutoff = today + timedelta(days=days)

    near_expiry = Medicine.objects.select_related('supplier').filter(
        is_active=True,
        expiry_date__lte=cutoff,
        expiry_date__gte=today
    ).order_by('expiry_date')

    expired = Medicine.objects.select_related('supplier').filter(
        is_active=True,
        expiry_date__lt=today
    ).order_by('expiry_date')

    def serialize(m):
        return {
            'id': m.id,
            'name': m.name,
            'batch_number': m.batch_number,
            'expiry_date': m.expiry_date.isoformat(),
            'quantity': m.quantity,
            'supplier': m.supplier.name if m.supplier else '',
            'days_until_expiry': (m.expiry_date - today).days,
        }

    return Response({
        'days_window': days,
        'near_expiry_count': near_expiry.count(),
        'expired_count': expired.count(),
        'near_expiry': [serialize(m) for m in near_expiry],
        'expired': [serialize(m) for m in expired],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Dashboard summary statistics."""
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    # Today's sales
    today_sales = Sale.objects.filter(sale_date__date=today, is_voided=False)
    today_revenue = today_sales.aggregate(total=Sum('total_amount'))['total'] or 0
    today_count = today_sales.count()

    # Last 7 days revenue chart
    seven_days_ago = today - timedelta(days=6)
    chart_data = (
        Sale.objects.filter(
            sale_date__date__gte=seven_days_ago,
            sale_date__date__lte=today,
            is_voided=False
        )
        .annotate(day=TruncDay('sale_date'))
        .values('day')
        .annotate(revenue=Sum('total_amount'), count=Count('id'))
        .order_by('day')
    )

    # Fill missing days with 0
    chart_dict = {item['day'].date(): {'revenue': float(item['revenue']), 'count': item['count']} for item in chart_data}
    chart_list = []
    for i in range(7):
        d = seven_days_ago + timedelta(days=i)
        chart_list.append({
            'date': d.isoformat(),
            'revenue': chart_dict.get(d, {}).get('revenue', 0),
            'count': chart_dict.get(d, {}).get('count', 0),
        })

    # Medicine alerts
    cutoff = today + timedelta(days=30)
    medicines = Medicine.objects.filter(is_active=True)
    low_stock_count = sum(1 for m in medicines if m.quantity <= m.min_stock_threshold)
    near_expiry_count = medicines.filter(expiry_date__lte=cutoff, expiry_date__gte=today).count()
    expired_count = medicines.filter(expiry_date__lt=today).count()
    total_medicines = medicines.count()

    # Recent sales
    recent_sales = Sale.objects.select_related('customer', 'processed_by').filter(is_voided=False)[:10]
    from apps.sales.serializers import SaleSerializer

    return Response({
        'today': {
            'revenue': today_revenue,
            'transactions': today_count,
        },
        'medicines': {
            'total': total_medicines,
            'low_stock': low_stock_count,
            'near_expiry': near_expiry_count,
            'expired': expired_count,
        },
        'chart_data': chart_list,
        'recent_sales': SaleSerializer(recent_sales, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_daily_sales_csv(request):
    """Export daily sales as CSV."""
    date_str = request.query_params.get('date', date.today().isoformat())
    try:
        report_date = date.fromisoformat(date_str)
    except ValueError:
        return Response({'error': 'Invalid date format.'}, status=400)

    sales = Sale.objects.filter(
        sale_date__date=report_date,
        is_voided=False
    ).select_related('customer', 'processed_by')

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Invoice #', 'Date', 'Customer', 'Staff', 'Subtotal', 'Tax', 'Discount', 'Total', 'Status'])

    for sale in sales:
        writer.writerow([
            sale.invoice_number,
            sale.sale_date.strftime('%Y-%m-%d %H:%M'),
            sale.customer.name if sale.customer else 'Walk-in',
            sale.processed_by.username if sale.processed_by else '',
            sale.subtotal,
            sale.tax_amount,
            sale.discount,
            sale.total_amount,
            sale.payment_status,
        ])

    response = HttpResponse(output.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="sales-{date_str}.csv"'
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_stock_csv(request):
    """Export current stock report as CSV."""
    medicines = Medicine.objects.select_related('supplier').filter(is_active=True).order_by('name')

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Name', 'Category', 'Manufacturer', 'Batch', 'Expiry Date',
                     'Quantity', 'Min Threshold', 'Unit Price', 'Supplier', 'Status'])

    for m in medicines:
        writer.writerow([
            m.name, m.category, m.manufacturer, m.batch_number,
            m.expiry_date.isoformat(), m.quantity, m.min_stock_threshold,
            m.unit_price, m.supplier.name if m.supplier else '', m.status
        ])

    response = HttpResponse(output.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="stock-report.csv"'
    return response
