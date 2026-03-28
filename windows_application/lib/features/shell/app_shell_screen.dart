import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/branding/app_brand.dart';
import '../../widgets/brand_mark.dart';
import '../auth/session_controller.dart';
import '../customers/customers_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../medicines/medicines_screen.dart';
import '../purchases/purchases_screen.dart';
import '../reports/reports_screen.dart';
import '../sales/new_sale_screen.dart';
import '../sales/sales_screen.dart';
import 'shell_section.dart';
import '../suppliers/suppliers_screen.dart';
import '../users/users_screen.dart';

class AppShellScreen extends StatefulWidget {
  const AppShellScreen({super.key});

  @override
  State<AppShellScreen> createState() => _AppShellScreenState();
}

class _AppShellScreenState extends State<AppShellScreen> {
  ShellSection _selected = ShellSection.dashboard;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    final items = [
      ShellSection.dashboard,
      ShellSection.medicines,
      ShellSection.newSale,
      ShellSection.salesHistory,
      ShellSection.purchases,
      ShellSection.suppliers,
      ShellSection.customers,
      ShellSection.reports,
      if (session.user?.isAdmin ?? false) ShellSection.users,
    ];

    return Scaffold(
      body: Row(
        children: [
          Container(
            width: 280,
            color: const Color(0xFF0F172A),
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BrandMark(light: true),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.1),
                    ),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 22,
                        backgroundColor: const Color(0xFF2563EB),
                        child: Text(
                          (session.user?.username.isNotEmpty ?? false)
                              ? session.user!.username[0].toUpperCase()
                              : 'S',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              session.user?.fullName.isNotEmpty == true
                                  ? session.user!.fullName
                                  : session.user?.username ?? 'User',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              session.user?.role.toUpperCase() ?? 'STAFF',
                              style: const TextStyle(
                                color: Color(0xFF99F6E4),
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Expanded(
                  child: ListView.separated(
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 6),
                    itemBuilder: (context, index) {
                      final section = items[index];
                      final selected = section == _selected;
                      return ListTile(
                        selected: selected,
                        selectedTileColor: const Color(0xFF2563EB),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        leading: Icon(
                          section.icon,
                          color:
                              selected ? Colors.white : const Color(0xFFCBD5E1),
                        ),
                        title: Text(
                          section.label,
                          style: TextStyle(
                            color:
                                selected ? Colors.white : const Color(0xFFE2E8F0),
                            fontWeight: selected
                                ? FontWeight.w700
                                : FontWeight.w500,
                          ),
                        ),
                        onTap: () => setState(() => _selected = section),
                      );
                    },
                  ),
                ),
                const Divider(color: Color(0xFF1E293B)),
                const SizedBox(height: 10),
                Text(
                  AppBrand.phonesText,
                  style: const TextStyle(color: Colors.white60, fontSize: 12),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => context.read<SessionController>().logout(),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Color(0xFF334155)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('Sign Out'),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 18, 24, 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _selected.label,
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              AppBrand.displayName,
                              style: const TextStyle(
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                      FilledButton.tonalIcon(
                        onPressed: () => setState(
                          () => _selected = ShellSection.newSale,
                        ),
                        icon: const Icon(Icons.add_shopping_cart_rounded),
                        label: const Text('Quick Sale'),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(child: _buildBody()),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    switch (_selected) {
      case ShellSection.dashboard:
        return DashboardScreen(onNavigate: _navigateTo);
      case ShellSection.medicines:
        return const MedicinesScreen();
      case ShellSection.newSale:
        return NewSaleScreen(onNavigate: _navigateTo);
      case ShellSection.salesHistory:
        return SalesScreen(
          onCreateSale: () => _navigateTo(ShellSection.newSale),
        );
      case ShellSection.purchases:
        return const PurchasesScreen();
      case ShellSection.suppliers:
        return const SuppliersScreen();
      case ShellSection.customers:
        return const CustomersScreen();
      case ShellSection.reports:
        return const ReportsScreen();
      case ShellSection.users:
        return const UsersScreen();
    }
  }

  void _navigateTo(ShellSection section) {
    setState(() => _selected = section);
  }
}
