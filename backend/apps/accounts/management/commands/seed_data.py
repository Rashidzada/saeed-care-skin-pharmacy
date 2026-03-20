# G:/msms/backend/apps/accounts/management/commands/seed_data.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal


class Command(BaseCommand):
    help = 'Seed the database with sample data for development'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        # Import models here to avoid circular import at module level
        from apps.accounts.models import CustomUser
        from apps.suppliers.models import Supplier
        from apps.customers.models import Customer
        from apps.medicines.models import Medicine

        # 1. Create admin user
        admin, created = CustomUser.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@msms.com',
                'first_name': 'System',
                'last_name': 'Admin',
                'role': 'admin',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
            }
        )
        if created:
            admin.set_password('Admin@1234')
            admin.save()
            self.stdout.write(self.style.SUCCESS('  Created admin user (admin / Admin@1234)'))
        else:
            self.stdout.write('  Admin user already exists')

        # Create staff user
        staff, created = CustomUser.objects.get_or_create(
            username='staff',
            defaults={
                'email': 'staff@msms.com',
                'first_name': 'John',
                'last_name': 'Doe',
                'role': 'staff',
                'is_active': True,
            }
        )
        if created:
            staff.set_password('Staff@1234')
            staff.save()
            self.stdout.write(self.style.SUCCESS('  Created staff user (staff / Staff@1234)'))

        # 2. Create suppliers
        supplier1, _ = Supplier.objects.get_or_create(
            name='PharmaCo Distributors',
            defaults={
                'contact_person': 'Michael Brown',
                'phone': '+1-555-0201',
                'email': 'sales@pharmacodist.com',
                'address': '456 Pharma Avenue, Supply City',
                'is_active': True,
            }
        )

        supplier2, _ = Supplier.objects.get_or_create(
            name='MedSupply International',
            defaults={
                'contact_person': 'Sarah Johnson',
                'phone': '+1-555-0202',
                'email': 'contact@medsupply.com',
                'address': '789 Medical Road, Health Town',
                'is_active': True,
            }
        )
        self.stdout.write(self.style.SUCCESS('  Created 2 suppliers'))

        # 3. Create customers
        Customer.objects.get_or_create(
            phone='+1-555-1001',
            defaults={'name': 'Alice Johnson', 'email': 'alice@email.com', 'address': '12 Main St'}
        )
        Customer.objects.get_or_create(
            phone='+1-555-1002',
            defaults={'name': 'Bob Williams', 'email': 'bob@email.com', 'address': '45 Oak Ave'}
        )
        self.stdout.write(self.style.SUCCESS('  Created 2 customers'))

        # 4. Create medicines
        today = date.today()
        medicines = [
            {
                'name': 'Paracetamol 500mg',
                'generic_name': 'Paracetamol',
                'category': 'tablet',
                'manufacturer': 'Generic Pharma',
                'batch_number': 'PCM-2024-001',
                'expiry_date': today + timedelta(days=365),
                'unit_price': Decimal('2.50'),
                'quantity': 500,
                'min_stock_threshold': 50,
                'supplier': supplier1,
            },
            {
                'name': 'Amoxicillin 250mg Capsule',
                'generic_name': 'Amoxicillin',
                'category': 'capsule',
                'manufacturer': 'AntiBio Labs',
                'batch_number': 'AMX-2024-002',
                'expiry_date': today + timedelta(days=180),
                'unit_price': Decimal('8.99'),
                'quantity': 200,
                'min_stock_threshold': 30,
                'supplier': supplier1,
            },
            {
                'name': 'Cough Syrup 100ml',
                'generic_name': 'Dextromethorphan',
                'category': 'syrup',
                'manufacturer': 'CoughCure Inc',
                'batch_number': 'CSY-2024-003',
                'expiry_date': today + timedelta(days=20),  # Near expiry
                'unit_price': Decimal('5.75'),
                'quantity': 80,
                'min_stock_threshold': 20,
                'supplier': supplier2,
            },
            {
                'name': 'Ibuprofen 400mg',
                'generic_name': 'Ibuprofen',
                'category': 'tablet',
                'manufacturer': 'PainRelief Corp',
                'batch_number': 'IBU-2024-004',
                'expiry_date': today + timedelta(days=400),
                'unit_price': Decimal('3.20'),
                'quantity': 8,  # Low stock
                'min_stock_threshold': 25,
                'supplier': supplier1,
            },
            {
                'name': 'Vitamin C 1000mg',
                'generic_name': 'Ascorbic Acid',
                'category': 'tablet',
                'manufacturer': 'VitaHealth',
                'batch_number': 'VTC-2024-005',
                'expiry_date': today + timedelta(days=730),
                'unit_price': Decimal('12.00'),
                'quantity': 300,
                'min_stock_threshold': 40,
                'supplier': supplier2,
            },
            {
                'name': 'Insulin Injection 10ml',
                'generic_name': 'Human Insulin',
                'category': 'injection',
                'manufacturer': 'DiabeCare Pharma',
                'batch_number': 'INS-2024-006',
                'expiry_date': today + timedelta(days=90),
                'unit_price': Decimal('45.00'),
                'quantity': 50,
                'min_stock_threshold': 10,
                'supplier': supplier2,
            },
        ]

        for med_data in medicines:
            Medicine.objects.get_or_create(
                batch_number=med_data['batch_number'],
                defaults=med_data
            )

        self.stdout.write(self.style.SUCCESS('  Created 6 sample medicines'))
        self.stdout.write(self.style.SUCCESS('\nDatabase seeded successfully!'))
        self.stdout.write('\nDefault credentials:')
        self.stdout.write('  Admin: admin / Admin@1234')
        self.stdout.write('  Staff: staff / Staff@1234')
