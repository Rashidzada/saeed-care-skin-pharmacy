import 'package:flutter/material.dart';

enum ShellSection {
  dashboard,
  medicines,
  newSale,
  salesHistory,
  purchases,
  suppliers,
  customers,
  reports,
  users,
}

extension ShellSectionMeta on ShellSection {
  String get label {
    switch (this) {
      case ShellSection.dashboard:
        return 'Dashboard';
      case ShellSection.medicines:
        return 'Medicines';
      case ShellSection.newSale:
        return 'New Sale';
      case ShellSection.salesHistory:
        return 'Sales History';
      case ShellSection.purchases:
        return 'Purchases';
      case ShellSection.suppliers:
        return 'Suppliers';
      case ShellSection.customers:
        return 'Customers';
      case ShellSection.reports:
        return 'Reports';
      case ShellSection.users:
        return 'User Management';
    }
  }

  IconData get icon {
    switch (this) {
      case ShellSection.dashboard:
        return Icons.space_dashboard_rounded;
      case ShellSection.medicines:
        return Icons.medication_rounded;
      case ShellSection.newSale:
        return Icons.shopping_cart_checkout_rounded;
      case ShellSection.salesHistory:
        return Icons.monitor_heart_rounded;
      case ShellSection.purchases:
        return Icons.inventory_2_rounded;
      case ShellSection.suppliers:
        return Icons.local_shipping_rounded;
      case ShellSection.customers:
        return Icons.groups_rounded;
      case ShellSection.reports:
        return Icons.bar_chart_rounded;
      case ShellSection.users:
        return Icons.manage_accounts_rounded;
    }
  }
}
