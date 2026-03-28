import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/services/pharmacy_api_service.dart';
import '../../core/utils/error_message.dart';
import '../../core/utils/formatters.dart';
import '../../widgets/app_panel.dart';
import '../../widgets/loading_body.dart';
import '../../widgets/stat_tile.dart';
import '../shell/shell_section.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.onNavigate,
  });

  final ValueChanged<ShellSection> onNavigate;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _data;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final data = await context.read<PharmacyApiService>().getDashboardStats();
      if (!mounted) {
        return;
      }
      setState(() {
        _data = data;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = friendlyErrorMessage(error);
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const LoadingBody();
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _load,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    final data = _data ?? const {};
    final today = Map<String, dynamic>.from(data['today'] ?? const {});
    final medicines = Map<String, dynamic>.from(data['medicines'] ?? const {});
    final recentSales = (data['recent_sales'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    final chartData = (data['chart_data'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    final receivables =
        Map<String, dynamic>.from(data['receivables'] ?? const {});
    final payables = Map<String, dynamic>.from(data['payables'] ?? const {});

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (asInt(medicines['low_stock']) > 0) ...[
              _AlertBanner(
                title:
                    '${medicines['low_stock']} medicine(s) are running low on stock.',
                subtitle: 'Click to view and manage inventory.',
                icon: Icons.warning_rounded,
                background: const Color(0xFFFFFBEB),
                foreground: const Color(0xFFA16207),
                onTap: () => widget.onNavigate(ShellSection.medicines),
              ),
              const SizedBox(height: 12),
            ],
            if (asInt(medicines['near_expiry']) > 0) ...[
              _AlertBanner(
                title:
                    '${medicines['near_expiry']} medicine(s) expire within 30 days.',
                subtitle: 'Review expiring stock before it becomes dead inventory.',
                icon: Icons.schedule_rounded,
                background: const Color(0xFFFFF7ED),
                foreground: const Color(0xFFC2410C),
                onTap: () => widget.onNavigate(ShellSection.medicines),
              ),
              const SizedBox(height: 18),
            ],
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                SizedBox(
                  width: 260,
                  child: StatTile(
                    title: "Today's Revenue",
                    value: formatCurrency(today['revenue']),
                    icon: Icons.attach_money_rounded,
                    accent: const Color(0xFF2563EB),
                    subtitle:
                        '${today['transactions'] ?? 0} transaction(s) today',
                  ),
                ),
                SizedBox(
                  width: 260,
                  child: StatTile(
                    title: 'Payments Received',
                    value: formatCurrency(today['payments_received']),
                    icon: Icons.payments_rounded,
                    accent: const Color(0xFF0F766E),
                    subtitle: 'Collected today',
                  ),
                ),
                SizedBox(
                  width: 260,
                  child: StatTile(
                    title: 'Customer Pending',
                    value: formatCurrency(receivables['outstanding_total']),
                    icon: Icons.account_balance_wallet_rounded,
                    accent: const Color(0xFFD97706),
                    subtitle:
                        '${receivables['pending_invoices'] ?? 0} pending / ${receivables['partial_invoices'] ?? 0} partial',
                    onTap: () => widget.onNavigate(ShellSection.salesHistory),
                  ),
                ),
                SizedBox(
                  width: 260,
                  child: StatTile(
                    title: 'Supplier Pending',
                    value: formatCurrency(payables['outstanding_total']),
                    icon: Icons.request_quote_rounded,
                    accent: const Color(0xFFEA580C),
                    subtitle:
                        '${payables['pending_invoices'] ?? 0} pending / ${payables['partial_invoices'] ?? 0} partial',
                    onTap: () => widget.onNavigate(ShellSection.purchases),
                  ),
                ),
                SizedBox(
                  width: 260,
                  child: StatTile(
                    title: 'Total Medicines',
                    value: '${medicines['total'] ?? 0}',
                    icon: Icons.medication_liquid_rounded,
                    accent: const Color(0xFF15803D),
                    subtitle: 'Active medicines in inventory',
                  ),
                ),
                SizedBox(
                  width: 260,
                  child: StatTile(
                    title: 'Low Stock Alerts',
                    value: '${medicines['low_stock'] ?? 0}',
                    icon: Icons.warning_amber_rounded,
                    accent: const Color(0xFFD97706),
                    subtitle: 'Below minimum stock threshold',
                    onTap: () => widget.onNavigate(ShellSection.medicines),
                  ),
                ),
                SizedBox(
                  width: 260,
                  child: StatTile(
                    title: 'Expiring Soon',
                    value: '${medicines['near_expiry'] ?? 0}',
                    icon: Icons.access_time_filled_rounded,
                    accent: const Color(0xFFEA580C),
                    subtitle: 'Within the next 30 days',
                    onTap: () => widget.onNavigate(ShellSection.medicines),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: AppPanel(
                    child: _LedgerSummary(
                      title: 'Customer Receivables',
                      primaryLabel: 'Outstanding',
                      primaryValue: formatCurrency(receivables['outstanding_total']),
                      rows: [
                        _LedgerRowData(
                          'Registered balance',
                          formatCurrency(receivables['registered_customer_outstanding']),
                        ),
                        _LedgerRowData(
                          'Walk-in balance',
                          formatCurrency(receivables['walk_in_outstanding']),
                        ),
                        _LedgerRowData(
                          'Collected so far',
                          formatCurrency(receivables['paid_total']),
                        ),
                        _LedgerRowData(
                          'Paid invoices',
                          '${receivables['paid_invoices'] ?? 0}',
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: AppPanel(
                    child: _LedgerSummary(
                      title: 'Supplier Payables',
                      primaryLabel: 'Outstanding',
                      primaryValue: formatCurrency(payables['outstanding_total']),
                      rows: [
                        _LedgerRowData(
                          'Paid to suppliers',
                          formatCurrency(payables['paid_total']),
                        ),
                        _LedgerRowData(
                          'Pending invoices',
                          '${payables['pending_invoices'] ?? 0}',
                        ),
                        _LedgerRowData(
                          'Partial invoices',
                          '${payables['partial_invoices'] ?? 0}',
                        ),
                        _LedgerRowData(
                          'Paid invoices',
                          '${payables['paid_invoices'] ?? 0}',
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 2,
                  child: AppPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.trending_up_rounded,
                                color: Color(0xFF0F766E)),
                            const SizedBox(width: 8),
                            Text(
                              'Last 7 Days Revenue',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          height: 280,
                          child: _RevenueChart(chartData: chartData),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: AppPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Recent Sales',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 16),
                        if (recentSales.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: Center(child: Text('No sales yet today.')),
                          )
                        else
                          ...recentSales.take(8).map((sale) {
                            final status =
                                sale['payment_status']?.toString() ?? 'pending';
                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color: const Color(0xFFE2E8F0),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          sale['invoice_number']
                                                  ?.toString() ??
                                              '-',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          sale['customer_name']
                                                  ?.toString()
                                                  .trim()
                                                  .isNotEmpty ==
                                              true
                                              ? sale['customer_name']
                                                  .toString()
                                              : 'Walk-in customer',
                                          style: const TextStyle(
                                            color: Color(0xFF64748B),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        formatCurrency(sale['total_amount']),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        status.toUpperCase(),
                                        style: TextStyle(
                                          color: _statusColor(status),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          }),
                        const SizedBox(height: 4),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton(
                            onPressed: () =>
                                widget.onNavigate(ShellSection.salesHistory),
                            child: const Text('View all sales'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: AppPanel(
                    child: _PendingLedgerList(
                      title: 'Customers With Pending Balance',
                      rows: (receivables['customers'] as List<dynamic>? ?? const [])
                          .cast<Map<String, dynamic>>(),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: AppPanel(
                    child: _PendingLedgerList(
                      title: 'Suppliers To Pay',
                      rows: (payables['suppliers'] as List<dynamic>? ?? const [])
                          .cast<Map<String, dynamic>>(),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'paid':
        return const Color(0xFF15803D);
      case 'partial':
        return const Color(0xFFD97706);
      default:
        return const Color(0xFFDC2626);
    }
  }
}

class _LedgerRowData {
  const _LedgerRowData(this.label, this.value);

  final String label;
  final String value;
}

class _LedgerSummary extends StatelessWidget {
  const _LedgerSummary({
    required this.title,
    required this.primaryLabel,
    required this.primaryValue,
    required this.rows,
  });

  final String title;
  final String primaryLabel;
  final String primaryValue;
  final List<_LedgerRowData> rows;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        Text(
          primaryLabel,
          style: const TextStyle(color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 4),
        Text(
          primaryValue,
          style: Theme.of(context)
              .textTheme
              .headlineSmall
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 12),
        ...rows.map(
          (row) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    row.label,
                    style: const TextStyle(color: Color(0xFF64748B)),
                  ),
                ),
                Text(
                  row.value,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PendingLedgerList extends StatelessWidget {
  const _PendingLedgerList({
    required this.title,
    required this.rows,
  });

  final String title;
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        if (rows.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Text('No pending balances here.'),
          )
        else
          ...rows.map(
            (row) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          row['name']?.toString() ?? '-',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      Text(
                        formatCurrency(row['outstanding_amount']),
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFB45309),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    row['phone']?.toString().isNotEmpty == true
                        ? row['phone'].toString()
                        : 'No phone on file',
                    style: const TextStyle(color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${row['invoice_count'] ?? 0} open invoice(s) | Paid ${formatCurrency(row['paid_amount'])}',
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _AlertBanner extends StatelessWidget {
  const _AlertBanner({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.background,
    required this.foreground,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color background;
  final Color foreground;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: foreground.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: foreground),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: foreground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(color: foreground.withValues(alpha: 0.8)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RevenueChart extends StatelessWidget {
  const _RevenueChart({
    required this.chartData,
  });

  final List<Map<String, dynamic>> chartData;

  @override
  Widget build(BuildContext context) {
    if (chartData.isEmpty) {
      return const Center(child: Text('No recent revenue data.'));
    }

    final maxRevenue = chartData
        .map((item) => asDouble(item['revenue']))
        .fold<double>(0, (previous, element) => element > previous ? element : previous);

    return BarChart(
      BarChartData(
        maxY: maxRevenue == 0 ? 10 : maxRevenue * 1.15,
        borderData: FlBorderData(show: false),
        gridData: FlGridData(
          horizontalInterval: maxRevenue == 0 ? 2 : maxRevenue / 4,
          drawVerticalLine: false,
          getDrawingHorizontalLine: (value) => const FlLine(
            color: Color(0xFFE2E8F0),
            strokeWidth: 1,
          ),
        ),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              reservedSize: 56,
              showTitles: true,
              getTitlesWidget: (value, meta) => Text(
                'PKR ${value.toInt()}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, meta) {
                final index = value.toInt();
                if (index < 0 || index >= chartData.length) {
                  return const SizedBox.shrink();
                }
                final rawDate = chartData[index]['date']?.toString() ?? '';
                final label = rawDate.length >= 10
                    ? rawDate.substring(5, 10)
                    : rawDate;
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(label),
                );
              },
            ),
          ),
        ),
        barGroups: [
          for (var index = 0; index < chartData.length; index++)
            BarChartGroupData(
              x: index,
              barRods: [
                BarChartRodData(
                  toY: asDouble(chartData[index]['revenue']),
                  width: 24,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(8),
                  ),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0F766E), Color(0xFF10B981)],
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
