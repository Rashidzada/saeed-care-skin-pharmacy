from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.customers.models import Customer
from apps.medicines.models import Medicine
from apps.purchases.models import (
    Purchase,
    PurchaseItem,
    PurchasePayment,
    PurchaseReturn,
    PurchaseReturnItem,
)
from apps.sales.models import Sale, SaleItem, SalePayment, SaleReturn, SaleReturnItem
from apps.suppliers.models import Supplier


class AdminPagesSmokeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_superuser(
            username='admin_test',
            email='admin@example.com',
            password='AdminPass123',
        )

        cls.customer = Customer.objects.create(
            name='Alice',
            phone='+1-555-1001',
            email='alice@example.com',
        )
        cls.supplier = Supplier.objects.create(
            name='Pharma Supplier',
            contact_person='Supplier Rep',
            phone='+1-555-2001',
            email='supplier@example.com',
            address='Supply Road',
            is_active=True,
        )
        cls.medicine = Medicine.objects.create(
            name='Paracetamol 500mg',
            generic_name='Paracetamol',
            category='tablet',
            manufacturer='Generic Pharma',
            batch_number='PCM-001',
            expiry_date=date(2027, 1, 1),
            unit_price=Decimal('10.00'),
            quantity=100,
            min_stock_threshold=10,
            supplier=cls.supplier,
            is_active=True,
        )

        cls.sale = Sale.objects.create(
            customer=cls.customer,
            processed_by=cls.user,
            tax_rate=Decimal('0'),
            discount=Decimal('0'),
            subtotal=Decimal('20.00'),
            tax_amount=Decimal('0'),
            total_amount=Decimal('20.00'),
            payment_status='paid',
        )
        cls.sale_item = SaleItem.objects.create(
            sale=cls.sale,
            medicine=cls.medicine,
            quantity=2,
            unit_price=Decimal('10.00'),
        )
        cls.sale_payment = SalePayment.objects.create(
            sale=cls.sale,
            recorded_by=cls.user,
            amount=Decimal('20.00'),
            payment_method='cash',
        )
        cls.sale_return = SaleReturn.objects.create(
            sale=cls.sale,
            processed_by=cls.user,
            notes='Returned one item',
            total_amount=Decimal('10.00'),
        )
        cls.sale_return_item = SaleReturnItem.objects.create(
            sale_return=cls.sale_return,
            sale_item=cls.sale_item,
            medicine=cls.medicine,
            quantity=1,
            unit_price=Decimal('10.00'),
        )

        cls.purchase = Purchase.objects.create(
            supplier=cls.supplier,
            recorded_by=cls.user,
            purchase_date=date(2026, 3, 1),
            invoice_number='SUP-001',
            total_cost=Decimal('40.00'),
            payment_status='paid',
        )
        cls.purchase_item = PurchaseItem.objects.create(
            purchase=cls.purchase,
            medicine=cls.medicine,
            quantity=4,
            unit_cost=Decimal('10.00'),
            batch_number='PCM-002',
            expiry_date=date(2027, 6, 1),
        )
        cls.purchase_payment = PurchasePayment.objects.create(
            purchase=cls.purchase,
            recorded_by=cls.user,
            amount=Decimal('40.00'),
            payment_method='cash',
        )
        cls.purchase_return = PurchaseReturn.objects.create(
            purchase=cls.purchase,
            recorded_by=cls.user,
            notes='Supplier return',
            total_amount=Decimal('10.00'),
        )
        cls.purchase_return_item = PurchaseReturnItem.objects.create(
            purchase_return=cls.purchase_return,
            purchase_item=cls.purchase_item,
            medicine=cls.medicine,
            quantity=1,
            unit_cost=Decimal('10.00'),
        )

    def setUp(self):
        self.client.force_login(self.user)

    def test_admin_changelists_render(self):
        urls = [
            reverse('admin:accounts_customuser_changelist'),
            reverse('admin:customers_customer_changelist'),
            reverse('admin:medicines_medicine_changelist'),
            reverse('admin:purchases_purchase_changelist'),
            reverse('admin:purchases_purchasepayment_changelist'),
            reverse('admin:purchases_purchasereturn_changelist'),
            reverse('admin:sales_sale_changelist'),
            reverse('admin:sales_salepayment_changelist'),
            reverse('admin:sales_salereturn_changelist'),
            reverse('admin:suppliers_supplier_changelist'),
        ]

        for url in urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)

    def test_admin_change_forms_render(self):
        urls = [
            reverse('admin:accounts_customuser_change', args=[self.user.pk]),
            reverse('admin:sales_sale_change', args=[self.sale.pk]),
            reverse('admin:sales_salepayment_change', args=[self.sale_payment.pk]),
            reverse('admin:sales_salereturn_change', args=[self.sale_return.pk]),
            reverse('admin:purchases_purchase_change', args=[self.purchase.pk]),
            reverse('admin:purchases_purchasepayment_change', args=[self.purchase_payment.pk]),
            reverse('admin:purchases_purchasereturn_change', args=[self.purchase_return.pk]),
        ]

        for url in urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)

    def test_admin_add_forms_render(self):
        urls = [
            reverse('admin:accounts_customuser_add'),
            reverse('admin:customers_customer_add'),
            reverse('admin:medicines_medicine_add'),
            reverse('admin:suppliers_supplier_add'),
        ]

        for url in urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
