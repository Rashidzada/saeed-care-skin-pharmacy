import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/services/pharmacy_api_service.dart';
import '../../core/utils/error_message.dart';
import '../../core/utils/formatters.dart';
import '../../widgets/app_panel.dart';
import '../../widgets/debounced_search_field.dart';
import '../../widgets/loading_body.dart';
import '../../widgets/pagination_bar.dart';
import '../../widgets/status_badge.dart';
import '../auth/session_controller.dart';

class SalesScreen extends StatefulWidget {
  const SalesScreen({
    super.key,
    required this.onCreateSale,
  });

  final VoidCallback onCreateSale;

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> {
  final _pageSize = 20;
  List<Map<String, dynamic>> _items = const [];
  int _count = 0;
  int _page = 1;
  String _search = '';
  String _status = '';
  String _dateFrom = '';
  String _dateTo = '';
  bool _loading = true;
  String? _error;

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
      final response = await context.read<PharmacyApiService>().getSales(
        page: _page,
        search: _search,
        dateFrom: _dateFrom,
        dateTo: _dateTo,
        paymentStatus: _status,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _items = response.results;
        _count = response.count;
      });
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

  bool _hasReturnableItems(Map<String, dynamic> sale) {
    final items =
        (sale['items'] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();
    return items.any((item) => asInt(item['returnable_quantity']) > 0);
  }

  Future<void> _voidSale(Map<String, dynamic> sale) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Void Sale'),
        content: Text(
          'Void ${sale['invoice_number']}? Stock will be restored. '
          'If this is only a partial return, use Process Return instead.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Void Sale'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    try {
      await context
          .read<PharmacyApiService>()
          .voidSale((sale['id'] as num).toInt());
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sale voided and stock restored.')),
      );
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyErrorMessage(error))),
      );
    }
  }

  Future<void> _processReturn(Map<String, dynamic> sale) async {
    final saleItems =
        (sale['items'] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();
    final eligibleItems = saleItems
        .where((item) => asInt(item['returnable_quantity']) > 0)
        .toList();

    if (eligibleItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All items from this invoice are already returned.')),
      );
      return;
    }

    final notesController = TextEditingController();
    final quantities = {
      for (final item in eligibleItems)
        (item['id'] as num).toInt(): '',
    };

    final payload = await showDialog<Map<String, dynamic>?>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final previewTotal = eligibleItems.fold<double>(0, (total, item) {
              final id = (item['id'] as num).toInt();
              final quantity = int.tryParse(quantities[id] ?? '') ?? 0;
              return total + (quantity * asDouble(item['unit_price']));
            });

            return AlertDialog(
              title: Text('Customer Return ${sale['invoice_number']}'),
              content: SizedBox(
                width: 860,
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Choose the medicines the customer returned. '
                        'Stock will be added back immediately.',
                      ),
                      const SizedBox(height: 16),
                      ...eligibleItems.map((item) {
                        final id = (item['id'] as num).toInt();
                        final maxQuantity = asInt(item['returnable_quantity']);
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 2,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item['medicine_name']?.toString() ?? '-',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Sold: ${item['quantity']} / Returned: ${item['returned_quantity'] ?? 0} / Remaining: $maxQuantity',
                                      style: const TextStyle(
                                        color: Color(0xFF64748B),
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              SizedBox(
                                width: 120,
                                child: TextField(
                                  controller: TextEditingController(
                                    text: quantities[id],
                                  ),
                                  decoration: const InputDecoration(
                                    labelText: 'Return Qty',
                                  ),
                                  keyboardType: TextInputType.number,
                                  onChanged: (value) {
                                    if (value.isEmpty) {
                                      setDialogState(() => quantities[id] = '');
                                      return;
                                    }
                                    final parsed = int.tryParse(value) ?? 0;
                                    final clamped = parsed.clamp(0, maxQuantity);
                                    setDialogState(
                                      () => quantities[id] = clamped.toString(),
                                    );
                                  },
                                ),
                              ),
                              const SizedBox(width: 12),
                              SizedBox(
                                width: 140,
                                child: Text(
                                  formatCurrency(
                                    (int.tryParse(quantities[id] ?? '') ?? 0) *
                                        asDouble(item['unit_price']),
                                  ),
                                  textAlign: TextAlign.right,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFFB45309),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                      TextField(
                        controller: notesController,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Notes',
                          hintText:
                              'Reason for return, condition of medicines, or invoice note',
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFBEB),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                        ),
                        child: Row(
                          children: [
                            const Text('Return Value'),
                            const Spacer(),
                            Text(
                              formatCurrency(previewTotal),
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                color: Color(0xFFB45309),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () {
                    final items = eligibleItems
                        .map((item) {
                          final id = (item['id'] as num).toInt();
                          final quantity = int.tryParse(quantities[id] ?? '') ?? 0;
                          return {
                            'sale_item': id,
                            'quantity': quantity,
                          };
                        })
                        .where((item) => (item['quantity'] as int) > 0)
                        .toList();

                    if (items.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Enter at least one return quantity.'),
                        ),
                      );
                      return;
                    }

                    Navigator.of(dialogContext).pop({
                      'notes': notesController.text.trim(),
                      'items': items,
                    });
                  },
                  child: const Text('Save Return'),
                ),
              ],
            );
          },
        );
      },
    );

    notesController.dispose();

    if (payload == null || !mounted) {
      return;
    }

    try {
      await context.read<PharmacyApiService>().createSaleReturn(
        (sale['id'] as num).toInt(),
        payload,
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Customer return recorded successfully.')),
      );
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyErrorMessage(error))),
      );
    }
  }

  Future<void> _recordPayment(Map<String, dynamic> sale) async {
    final amountController = TextEditingController(
      text: asDouble(sale['outstanding_amount']).toStringAsFixed(2),
    );
    final notesController = TextEditingController();
    var paymentMethod = 'cash';

    final payload = await showDialog<Map<String, dynamic>?>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: Text('Payment ${sale['invoice_number']}'),
            content: SizedBox(
              width: 460,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Customer: ${sale['customer_name']?.toString().isNotEmpty == true ? sale['customer_name'] : 'Walk-in'}',
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Outstanding: ${formatCurrency(sale['outstanding_amount'])}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0369A1),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Amount',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: paymentMethod,
                    decoration: const InputDecoration(
                      labelText: 'Payment Method',
                    ),
                    items: const [
                      DropdownMenuItem(value: 'cash', child: Text('Cash')),
                      DropdownMenuItem(value: 'card', child: Text('Card')),
                      DropdownMenuItem(value: 'bank_transfer', child: Text('Bank Transfer')),
                      DropdownMenuItem(value: 'easypaisa', child: Text('Easypaisa')),
                      DropdownMenuItem(value: 'jazzcash', child: Text('JazzCash')),
                      DropdownMenuItem(value: 'other', child: Text('Other')),
                    ],
                    onChanged: (value) => setDialogState(
                      () => paymentMethod = value ?? 'cash',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notesController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Notes',
                      hintText: 'Collector, receipt number, or bank reference',
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () {
                  final amount = double.tryParse(amountController.text.trim()) ?? 0;
                  if (amount <= 0) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Enter a valid payment amount.')),
                    );
                    return;
                  }
                  if (amount > asDouble(sale['outstanding_amount'])) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Payment cannot exceed the outstanding balance.'),
                      ),
                    );
                    return;
                  }
                  Navigator.of(dialogContext).pop({
                    'amount': amount,
                    'payment_method': paymentMethod,
                    'notes': notesController.text.trim(),
                  });
                },
                child: const Text('Save Payment'),
              ),
            ],
          ),
        );
      },
    );

    amountController.dispose();
    notesController.dispose();

    if (payload == null || !mounted) {
      return;
    }

    try {
      await context.read<PharmacyApiService>().createSalePayment(
        (sale['id'] as num).toInt(),
        payload,
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Customer payment recorded successfully.')),
      );
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyErrorMessage(error))),
      );
    }
  }

  Future<void> _viewSale(Map<String, dynamic> sale) async {
    final returns =
        (sale['returns'] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();
    final payments =
        (sale['payments'] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Sale ${sale['invoice_number']}'),
        content: SizedBox(
          width: 860,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 16,
                  runSpacing: 8,
                  children: [
                    Text(
                      'Date: ${formatDate(sale['sale_date'], pattern: 'dd MMM yyyy HH:mm')}',
                    ),
                    Text(
                      'Customer: ${sale['customer_name']?.toString().isNotEmpty == true ? sale['customer_name'] : 'Walk-in'}',
                    ),
                    Text('Processed by: ${sale['processed_by_name'] ?? '-'}'),
                  ],
                ),
                const SizedBox(height: 16),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    columns: const [
                      DataColumn(label: Text('Medicine')),
                      DataColumn(label: Text('Sold')),
                      DataColumn(label: Text('Returned')),
                      DataColumn(label: Text('Remaining')),
                      DataColumn(label: Text('Price')),
                      DataColumn(label: Text('Total')),
                    ],
                    rows: (sale['items'] as List<dynamic>? ?? const [])
                        .cast<Map<String, dynamic>>()
                        .map(
                          (item) => DataRow(
                            cells: [
                              DataCell(Text(item['medicine_name']?.toString() ?? '-')),
                              DataCell(Text('${item['quantity'] ?? 0}')),
                              DataCell(Text('${item['returned_quantity'] ?? 0}')),
                              DataCell(Text('${item['returnable_quantity'] ?? 0}')),
                              DataCell(Text(formatCurrency(item['unit_price']))),
                              DataCell(Text(formatCurrency(item['line_total']))),
                            ],
                          ),
                        )
                        .toList(),
                  ),
                ),
                const SizedBox(height: 16),
                _DetailRow(
                  label: 'Invoice Total',
                  value: formatCurrency(sale['total_amount']),
                ),
                if (asDouble(sale['returned_amount']) > 0)
                  _DetailRow(
                    label: 'Returned Amount',
                    value: formatCurrency(sale['returned_amount']),
                  ),
                _DetailRow(
                  label: 'Net Sale',
                  value: formatCurrency(sale['net_total_amount']),
                  large: true,
                ),
                _DetailRow(
                  label: 'Paid Amount',
                  value: formatCurrency(sale['total_paid_amount']),
                ),
                _DetailRow(
                  label: 'Outstanding',
                  value: formatCurrency(sale['outstanding_amount']),
                ),
                if (payments.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Text(
                    'Payment History',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 10),
                  ...payments.map(
                    (payment) => Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFBFDBFE)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                payment['reference_number']?.toString() ?? '-',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0369A1),
                                ),
                              ),
                              const Spacer(),
                              Text(
                                formatCurrency(payment['amount']),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0369A1),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${formatDate(payment['payment_date'], pattern: 'dd MMM yyyy HH:mm')} / ${(payment['payment_method'] ?? 'cash').toString().replaceAll('_', ' ')}',
                            style: const TextStyle(color: Color(0xFF64748B)),
                          ),
                          if (payment['notes']?.toString().isNotEmpty == true)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                payment['notes'].toString(),
                                style: const TextStyle(
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
                if (returns.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Text(
                    'Return History',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 10),
                  ...returns.map(
                    (saleReturn) => Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                saleReturn['reference_number']?.toString() ?? '-',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFFB45309),
                                ),
                              ),
                              const Spacer(),
                              Text(
                                formatCurrency(saleReturn['total_amount']),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFFB45309),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${formatDate(saleReturn['return_date'], pattern: 'dd MMM yyyy HH:mm')} / ${saleReturn['processed_by_name'] ?? 'Staff'}',
                            style: const TextStyle(color: Color(0xFF64748B)),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            ((saleReturn['items'] as List<dynamic>? ?? const [])
                                    .cast<Map<String, dynamic>>())
                                .map(
                                  (item) =>
                                      '${item['medicine_name']} x${item['quantity']}',
                                )
                                .join(', '),
                          ),
                          if (saleReturn['notes']?.toString().isNotEmpty == true)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                saleReturn['notes'].toString(),
                                style: const TextStyle(
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
          if (_hasReturnableItems(sale))
            FilledButton.tonal(
              onPressed: () async {
                Navigator.of(context).pop();
                await _processReturn(sale);
              },
              child: const Text('Process Return'),
            ),
          if (asDouble(sale['outstanding_amount']) > 0)
            FilledButton.tonal(
              onPressed: () async {
                Navigator.of(context).pop();
                await _recordPayment(sale);
              },
              child: const Text('Pay Now'),
            ),
          FilledButton.tonal(
            onPressed: () async {
              Navigator.of(context).pop();
              await context
                  .read<PharmacyApiService>()
                  .openSaleReceipt((sale['id'] as num).toInt());
            },
            child: const Text('Thermal Receipt'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(context).pop();
              await context
                  .read<PharmacyApiService>()
                  .openSaleInvoice((sale['id'] as num).toInt());
            },
            child: const Text('Print Invoice'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = context.watch<SessionController>().user?.isAdmin ?? false;

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
          Row(
            children: [
              Expanded(
                child: DebouncedSearchField(
                  hintText: 'Search by invoice or customer...',
                  onChanged: (value) {
                    setState(() {
                      _search = value;
                      _page = 1;
                    });
                    _load();
                  },
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 150,
                child: TextField(
                  decoration: const InputDecoration(labelText: 'Date From'),
                  onChanged: (value) => _dateFrom = value.trim(),
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 150,
                child: TextField(
                  decoration: const InputDecoration(labelText: 'Date To'),
                  onChanged: (value) => _dateTo = value.trim(),
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 140,
                child: DropdownButtonFormField<String>(
                  initialValue: _status.isEmpty ? null : _status,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: const [
                    DropdownMenuItem(value: 'paid', child: Text('Paid')),
                    DropdownMenuItem(value: 'partial', child: Text('Partial')),
                    DropdownMenuItem(value: 'pending', child: Text('Pending')),
                  ],
                  onChanged: (value) {
                    setState(() {
                      _status = value ?? '';
                      _page = 1;
                    });
                    _load();
                  },
                ),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: widget.onCreateSale,
                icon: const Icon(Icons.add_rounded),
                label: const Text('New Sale'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AppPanel(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    columns: const [
                      DataColumn(label: Text('Invoice')),
                      DataColumn(label: Text('Date')),
                      DataColumn(label: Text('Customer')),
                      DataColumn(label: Text('Items')),
                      DataColumn(label: Text('Invoice Total')),
                      DataColumn(label: Text('Returned')),
                      DataColumn(label: Text('Paid')),
                      DataColumn(label: Text('Outstanding')),
                      DataColumn(label: Text('Status')),
                      DataColumn(label: Text('Actions')),
                    ],
                    rows: _items
                        .map(
                          (sale) => DataRow(
                            cells: [
                              DataCell(Text(sale['invoice_number']?.toString() ?? '-')),
                              DataCell(
                                Text(
                                  formatDate(
                                    sale['sale_date'],
                                    pattern: 'dd MMM yyyy HH:mm',
                                  ),
                                ),
                              ),
                              DataCell(
                                Text(
                                  sale['customer_name']?.toString().isNotEmpty ==
                                          true
                                      ? sale['customer_name'].toString()
                                      : 'Walk-in',
                                ),
                              ),
                              DataCell(
                                Text(
                                  '${(sale['items'] as List<dynamic>? ?? const []).length}',
                                ),
                              ),
                              DataCell(Text(formatCurrency(sale['total_amount']))),
                              DataCell(Text(formatCurrency(sale['returned_amount']))),
                              DataCell(Text(formatCurrency(sale['total_paid_amount']))),
                              DataCell(Text(formatCurrency(sale['outstanding_amount']))),
                              DataCell(
                                _statusBadge(sale['payment_status']?.toString()),
                              ),
                              DataCell(
                                Wrap(
                                  spacing: 8,
                                  children: [
                                    IconButton(
                                      onPressed: () => _viewSale(sale),
                                      icon: const Icon(Icons.visibility_rounded),
                                    ),
                                    IconButton(
                                      onPressed: () => context
                                          .read<PharmacyApiService>()
                                          .openSaleInvoice(
                                            (sale['id'] as num).toInt(),
                                          ),
                                      icon: const Icon(Icons.print_rounded),
                                    ),
                                    IconButton(
                                      onPressed: () => context
                                          .read<PharmacyApiService>()
                                          .openSaleReceipt(
                                            (sale['id'] as num).toInt(),
                                          ),
                                      icon: const Icon(Icons.receipt_long_rounded),
                                    ),
                                    if (asDouble(sale['outstanding_amount']) > 0)
                                      IconButton(
                                        onPressed: () => _recordPayment(sale),
                                        icon: const Icon(Icons.payments_rounded),
                                      ),
                                    if (_hasReturnableItems(sale))
                                      IconButton(
                                        onPressed: () => _processReturn(sale),
                                        icon: const Icon(Icons.undo_rounded),
                                      ),
                                    if (isAdmin &&
                                        !(sale['is_voided'] as bool? ?? false))
                                      IconButton(
                                        onPressed: () => _voidSale(sale),
                                        icon: const Icon(Icons.cancel_rounded),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        )
                        .toList(),
                  ),
                ),
                const SizedBox(height: 12),
                PaginationBar(
                  page: _page,
                  count: _count,
                  pageSize: _pageSize,
                  onChanged: (page) {
                    setState(() => _page = page);
                    _load();
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusBadge(String? status) {
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
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.large = false,
  });

  final String label;
  final String value;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final style = large
        ? Theme.of(context)
            .textTheme
            .titleMedium
            ?.copyWith(fontWeight: FontWeight.w800)
        : Theme.of(context).textTheme.bodyLarge;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(label, style: style),
          const Spacer(),
          Text(value, style: style),
        ],
      ),
    );
  }
}
