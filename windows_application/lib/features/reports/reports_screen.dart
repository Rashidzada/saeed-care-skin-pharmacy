import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/services/pharmacy_api_service.dart';
import '../../core/utils/error_message.dart';
import '../../core/utils/formatters.dart';
import '../../widgets/app_panel.dart';
import '../../widgets/loading_body.dart';
import '../../widgets/status_badge.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _tab = 'daily';
  String _dailyDate = DateTime.now().toIso8601String().split('T').first;
  int _monthlyYear = DateTime.now().year;
  int _monthlyMonth = DateTime.now().month;
  int _expiryDays = 30;
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _data;

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
      final service = context.read<PharmacyApiService>();
      late final Map<String, dynamic> data;
      switch (_tab) {
        case 'daily':
          data = await service.getDailySales(_dailyDate);
          break;
        case 'monthly':
          data = await service.getMonthlySales(_monthlyYear, _monthlyMonth);
          break;
        case 'stock':
          data = await service.getStockReport();
          break;
        default:
          data = await service.getExpiryReport(_expiryDays);
      }

      if (!mounted) {
        return;
      }
      setState(() => _data = data);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = friendlyErrorMessage(error));
    } finally {
      if (mounted) {
        setState(() => _loading = false);
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
            FilledButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _tabChip('daily', 'Daily Sales'),
              _tabChip('monthly', 'Monthly Sales'),
              _tabChip('stock', 'Stock Report'),
              _tabChip('expiry', 'Expiry Report'),
            ],
          ),
          const SizedBox(height: 16),
          if (_tab == 'daily') _buildDaily(),
          if (_tab == 'monthly') _buildMonthly(),
          if (_tab == 'stock') _buildStock(),
          if (_tab == 'expiry') _buildExpiry(),
        ],
      ),
    );
  }

  Widget _tabChip(String tab, String label) {
    return ChoiceChip(
      selected: _tab == tab,
      label: Text(label),
      onSelected: (_) {
        setState(() => _tab = tab);
        _load();
      },
    );
  }

  Widget _buildDaily() {
    final data = _data ?? const {};
    final sales =
        (data['sales'] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();

    return Column(
      children: [
        Row(
          children: [
            SizedBox(
              width: 180,
              child: TextField(
                controller: TextEditingController(text: _dailyDate),
                decoration: const InputDecoration(labelText: 'Date'),
                onSubmitted: (value) {
                  _dailyDate = value.trim();
                  _load();
                },
              ),
            ),
            const Spacer(),
            FilledButton.tonalIcon(
              onPressed: () => context
                  .read<PharmacyApiService>()
                  .openDailySalesCsv(_dailyDate),
              icon: const Icon(Icons.download_rounded),
              label: const Text('Export CSV'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 16,
          runSpacing: 16,
          children: [
            _summaryCard('Total Revenue', formatCurrency(data['total_revenue'])),
            _summaryCard('Transactions', '${data['total_transactions'] ?? 0}'),
            _summaryCard('Items Sold', '${data['total_items_sold'] ?? 0}'),
          ],
        ),
        const SizedBox(height: 16),
        AppPanel(
          child: sales.isEmpty
              ? const Center(child: Text('No daily sales found.'))
              : SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    columns: const [
                      DataColumn(label: Text('Invoice')),
                      DataColumn(label: Text('Customer')),
                      DataColumn(label: Text('Total')),
                      DataColumn(label: Text('Status')),
                    ],
                    rows: sales
                        .map(
                          (sale) => DataRow(
                            cells: [
                              DataCell(Text(sale['invoice_number']?.toString() ?? '-')),
                              DataCell(Text(
                                sale['customer_name']?.toString().isNotEmpty == true
                                    ? sale['customer_name'].toString()
                                    : 'Walk-in',
                              )),
                              DataCell(Text(formatCurrency(sale['total_amount']))),
                              DataCell(
                                _paymentBadge(sale['payment_status']?.toString()),
                              ),
                            ],
                          ),
                        )
                        .toList(),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildMonthly() {
    final data = _data ?? const {};
    final breakdown = (data['daily_breakdown'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();

    return Column(
      children: [
        Row(
          children: [
            SizedBox(
              width: 140,
              child: TextField(
                controller: TextEditingController(text: '$_monthlyYear'),
                decoration: const InputDecoration(labelText: 'Year'),
                onSubmitted: (value) {
                  _monthlyYear = int.tryParse(value) ?? _monthlyYear;
                  _load();
                },
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 140,
              child: TextField(
                controller: TextEditingController(text: '$_monthlyMonth'),
                decoration: const InputDecoration(labelText: 'Month'),
                onSubmitted: (value) {
                  _monthlyMonth = int.tryParse(value) ?? _monthlyMonth;
                  _load();
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 16,
          runSpacing: 16,
          children: [
            _summaryCard('Total Revenue', formatCurrency(data['total_revenue'])),
            _summaryCard('Transactions', '${data['total_transactions'] ?? 0}'),
          ],
        ),
        const SizedBox(height: 16),
        AppPanel(
          child: SizedBox(
            height: 280,
            child: breakdown.isEmpty
                ? const Center(child: Text('No monthly sales data.'))
                : LineChart(
                    LineChartData(
                      borderData: FlBorderData(show: false),
                      gridData: const FlGridData(drawVerticalLine: false),
                      titlesData: FlTitlesData(
                        topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            getTitlesWidget: (value, meta) {
                              final index = value.toInt();
                              if (index < 0 || index >= breakdown.length) {
                                return const SizedBox.shrink();
                              }
                              final date = breakdown[index]['date']
                                      ?.toString()
                                      .split('-')
                                      .last ??
                                  '-';
                              return Text(date);
                            },
                          ),
                        ),
                      ),
                      lineBarsData: [
                        LineChartBarData(
                          spots: [
                            for (var index = 0; index < breakdown.length; index++)
                              FlSpot(
                                index.toDouble(),
                                asDouble(breakdown[index]['revenue']),
                              ),
                          ],
                          isCurved: true,
                          color: const Color(0xFF0F766E),
                          barWidth: 3,
                        ),
                      ],
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildStock() {
    final data = _data ?? const {};
    final summary = Map<String, dynamic>.from(data['summary'] ?? const {});
    final medicines = (data['medicines'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();

    return Column(
      children: [
        Row(
          children: [
            const Spacer(),
            FilledButton.tonalIcon(
              onPressed: () =>
                  context.read<PharmacyApiService>().openStockCsv(),
              icon: const Icon(Icons.download_rounded),
              label: const Text('Export CSV'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 16,
          runSpacing: 16,
          children: [
            _summaryCard('Total Medicines', '${summary['total_medicines'] ?? 0}'),
            _summaryCard('Low Stock', '${summary['low_stock'] ?? 0}'),
            _summaryCard('Out of Stock', '${summary['out_of_stock'] ?? 0}'),
            _summaryCard('Near Expiry', '${summary['near_expiry'] ?? 0}'),
          ],
        ),
        const SizedBox(height: 16),
        AppPanel(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              columns: const [
                DataColumn(label: Text('Name')),
                DataColumn(label: Text('Category')),
                DataColumn(label: Text('Batch')),
                DataColumn(label: Text('Expiry')),
                DataColumn(label: Text('Qty')),
                DataColumn(label: Text('Min')),
                DataColumn(label: Text('Price')),
                DataColumn(label: Text('Status')),
              ],
              rows: medicines
                  .map(
                    (medicine) => DataRow(
                      cells: [
                        DataCell(Text(medicine['name']?.toString() ?? '-')),
                        DataCell(Text(medicine['category']?.toString() ?? '-')),
                        DataCell(Text(medicine['batch_number']?.toString() ?? '-')),
                        DataCell(Text(medicine['expiry_date']?.toString() ?? '-')),
                        DataCell(Text('${medicine['quantity'] ?? 0}')),
                        DataCell(Text('${medicine['min_stock_threshold'] ?? 0}')),
                        DataCell(Text(formatCurrency(medicine['unit_price']))),
                        DataCell(_stockBadge(medicine['status']?.toString())),
                      ],
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildExpiry() {
    final data = _data ?? const {};
    final nearExpiry = (data['near_expiry'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    final expired = (data['expired'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();

    return Column(
      children: [
        Row(
          children: [
            SizedBox(
              width: 180,
              child: TextField(
                controller: TextEditingController(text: '$_expiryDays'),
                decoration: const InputDecoration(labelText: 'Days Window'),
                onSubmitted: (value) {
                  _expiryDays = int.tryParse(value) ?? _expiryDays;
                  _load();
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 16,
          runSpacing: 16,
          children: [
            _summaryCard(
              'Near Expiry',
              '${data['near_expiry_count'] ?? 0}',
              accent: const Color(0xFFEA580C),
            ),
            _summaryCard(
              'Expired',
              '${data['expired_count'] ?? 0}',
              accent: const Color(0xFFDC2626),
            ),
          ],
        ),
        const SizedBox(height: 16),
        AppPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Expiring Soon',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columns: const [
                    DataColumn(label: Text('Name')),
                    DataColumn(label: Text('Batch')),
                    DataColumn(label: Text('Expiry')),
                    DataColumn(label: Text('Qty')),
                    DataColumn(label: Text('Days Left')),
                    DataColumn(label: Text('Supplier')),
                  ],
                  rows: nearExpiry
                      .map(
                        (medicine) => DataRow(
                          cells: [
                            DataCell(Text(medicine['name']?.toString() ?? '-')),
                            DataCell(Text(medicine['batch_number']?.toString() ?? '-')),
                            DataCell(Text(medicine['expiry_date']?.toString() ?? '-')),
                            DataCell(Text('${medicine['quantity'] ?? 0}')),
                            DataCell(Text('${medicine['days_until_expiry'] ?? '-'}')),
                            DataCell(Text(medicine['supplier']?.toString().isNotEmpty == true
                                ? medicine['supplier'].toString()
                                : '-')),
                          ],
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Expired Medicines',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columns: const [
                    DataColumn(label: Text('Name')),
                    DataColumn(label: Text('Batch')),
                    DataColumn(label: Text('Expired On')),
                    DataColumn(label: Text('Qty')),
                  ],
                  rows: expired
                      .map(
                        (medicine) => DataRow(
                          cells: [
                            DataCell(Text(medicine['name']?.toString() ?? '-')),
                            DataCell(Text(medicine['batch_number']?.toString() ?? '-')),
                            DataCell(Text(medicine['expiry_date']?.toString() ?? '-')),
                            DataCell(Text('${medicine['quantity'] ?? 0}')),
                          ],
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _summaryCard(String label, String value, {Color? accent}) {
    return SizedBox(
      width: 250,
      child: AppPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: Color(0xFF64748B))),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: accent,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _paymentBadge(String? status) {
    switch (status) {
      case 'paid':
        return const StatusBadge(
          label: 'PAID',
          background: Color(0xFFDCFCE7),
          foreground: Color(0xFF15803D),
        );
      case 'partial':
        return const StatusBadge(
          label: 'PARTIAL',
          background: Color(0xFFFEF3C7),
          foreground: Color(0xFFB45309),
        );
      default:
        return const StatusBadge(
          label: 'PENDING',
          background: Color(0xFFFEE2E2),
          foreground: Color(0xFFB91C1C),
        );
    }
  }

  Widget _stockBadge(String? status) {
    switch (status) {
      case 'healthy':
        return const StatusBadge(
          label: 'HEALTHY',
          background: Color(0xFFDCFCE7),
          foreground: Color(0xFF15803D),
        );
      case 'low_stock':
        return const StatusBadge(
          label: 'LOW STOCK',
          background: Color(0xFFFEF3C7),
          foreground: Color(0xFFB45309),
        );
      case 'near_expiry':
        return const StatusBadge(
          label: 'NEAR EXPIRY',
          background: Color(0xFFFFEDD5),
          foreground: Color(0xFFC2410C),
        );
      default:
        return const StatusBadge(
          label: 'EXPIRED',
          background: Color(0xFFFEE2E2),
          foreground: Color(0xFFB91C1C),
        );
    }
  }
}
