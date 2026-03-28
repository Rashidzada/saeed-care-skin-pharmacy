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

class PurchasesScreen extends StatefulWidget {
  const PurchasesScreen({super.key});

  @override
  State<PurchasesScreen> createState() => _PurchasesScreenState();
}

class _PurchasesScreenState extends State<PurchasesScreen> {
  final _pageSize = 20;
  List<Map<String, dynamic>> _items = const [];
  int _count = 0;
  int _page = 1;
  String _search = '';
  String _status = '';
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
      final response = await context.read<PharmacyApiService>().getPurchases(
            page: _page,
            search: _search,
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

  Future<void> _openCreateDialog() async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (_) => const _PurchaseDialog(),
    );

    if (changed == true) {
      await _load();
    }
  }

  bool _hasReturnableItems(Map<String, dynamic> purchase) {
    final items = (purchase['items'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    return items.any(
      (item) =>
          asInt(item['returnable_quantity']) > 0 &&
          asInt(item['current_stock']) > 0,
    );
  }

  Future<void> _processReturn(Map<String, dynamic> purchase) async {
    final purchaseItems = (purchase['items'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    final eligibleItems = purchaseItems
        .where(
          (item) =>
              asInt(item['returnable_quantity']) > 0 &&
              asInt(item['current_stock']) > 0,
        )
        .toList();

    if (eligibleItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No stock from this purchase is currently available to return.'),
        ),
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
              return total + (quantity * asDouble(item['unit_cost']));
            });

            return AlertDialog(
              title: Text('Supplier Return ${purchase['po_number']}'),
              content: SizedBox(
                width: 860,
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Choose the stock going back to the supplier. '
                        'The pharmacy quantity will decrease immediately.',
                      ),
                      const SizedBox(height: 16),
                      ...eligibleItems.map((item) {
                        final id = (item['id'] as num).toInt();
                        final maxQuantity = [
                          asInt(item['returnable_quantity']),
                          asInt(item['current_stock']),
                        ].reduce((a, b) => a < b ? a : b);

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
                                      'Purchased: ${item['quantity']} / Already returned: ${item['returned_quantity'] ?? 0} / In stock: ${item['current_stock'] ?? 0}',
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
                                width: 150,
                                child: Text(
                                  formatCurrency(
                                    (int.tryParse(quantities[id] ?? '') ?? 0) *
                                        asDouble(item['unit_cost']),
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
                              'Reason for supplier return, damaged pack, expiry issue, or transport note',
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
                            const Text('Supplier Return Value'),
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
                            'purchase_item': id,
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
      await context.read<PharmacyApiService>().createPurchaseReturn(
        (purchase['id'] as num).toInt(),
        payload,
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Supplier return recorded successfully.')),
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

  Future<void> _recordPayment(Map<String, dynamic> purchase) async {
    final amountController = TextEditingController(
      text: asDouble(purchase['outstanding_amount']).toStringAsFixed(2),
    );
    final notesController = TextEditingController();
    var paymentMethod = 'cash';

    final payload = await showDialog<Map<String, dynamic>?>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: Text('Payment ${purchase['po_number']}'),
            content: SizedBox(
              width: 460,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Supplier: ${purchase['supplier_name'] ?? '-'}'),
                  const SizedBox(height: 6),
                  Text(
                    'Outstanding: ${formatCurrency(purchase['outstanding_amount'])}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0369A1),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Amount'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: paymentMethod,
                    decoration: const InputDecoration(labelText: 'Payment Method'),
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
                      hintText: 'Cheque number, bank transfer ref, or supplier note',
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
                  if (amount > asDouble(purchase['outstanding_amount'])) {
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
      await context.read<PharmacyApiService>().createPurchasePayment(
        (purchase['id'] as num).toInt(),
        payload,
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Supplier payment recorded successfully.')),
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

  Future<void> _viewPurchase(Map<String, dynamic> purchase) async {
    final returns = (purchase['returns'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    final payments = (purchase['payments'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Purchase ${purchase['po_number']}'),
        content: SizedBox(
          width: 900,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 16,
                  runSpacing: 8,
                  children: [
                    Text('Supplier: ${purchase['supplier_name'] ?? '-'}'),
                    Text('Date: ${formatDate(purchase['purchase_date'])}'),
                    Text('Recorded by: ${purchase['recorded_by_name'] ?? '-'}'),
                    if (purchase['invoice_number']?.toString().isNotEmpty == true)
                      Text('Ref: ${purchase['invoice_number']}'),
                  ],
                ),
                const SizedBox(height: 16),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    columns: const [
                      DataColumn(label: Text('Medicine')),
                      DataColumn(label: Text('Batch')),
                      DataColumn(label: Text('Expiry')),
                      DataColumn(label: Text('Purchased')),
                      DataColumn(label: Text('Returned')),
                      DataColumn(label: Text('In Stock')),
                      DataColumn(label: Text('Unit Cost')),
                      DataColumn(label: Text('Total')),
                    ],
                    rows: (purchase['items'] as List<dynamic>? ?? const [])
                        .cast<Map<String, dynamic>>()
                        .map(
                          (item) => DataRow(
                            cells: [
                              DataCell(Text(item['medicine_name']?.toString() ?? '-')),
                              DataCell(Text(item['batch_number']?.toString().isNotEmpty == true
                                  ? item['batch_number'].toString()
                                  : '-')),
                              DataCell(Text(
                                item['expiry_date']?.toString().isNotEmpty == true
                                    ? item['expiry_date'].toString()
                                    : '-',
                              )),
                              DataCell(Text('${item['quantity'] ?? 0}')),
                              DataCell(Text('${item['returned_quantity'] ?? 0}')),
                              DataCell(Text('${item['current_stock'] ?? 0}')),
                              DataCell(Text(formatCurrency(item['unit_cost']))),
                              DataCell(Text(formatCurrency(
                                asDouble(item['unit_cost']) *
                                    asInt(item['quantity']),
                              ))),
                            ],
                          ),
                        )
                        .toList(),
                  ),
                ),
                const SizedBox(height: 16),
                _DetailRow(
                  label: 'Purchase Total',
                  value: formatCurrency(purchase['total_cost']),
                ),
                if (asDouble(purchase['returned_amount']) > 0)
                  _DetailRow(
                    label: 'Returned to Supplier',
                    value: formatCurrency(purchase['returned_amount']),
                  ),
                _DetailRow(
                  label: 'Net Purchase Cost',
                  value: formatCurrency(purchase['net_total_cost']),
                  large: true,
                ),
                _DetailRow(
                  label: 'Paid Amount',
                  value: formatCurrency(purchase['total_paid_amount']),
                ),
                _DetailRow(
                  label: 'Outstanding',
                  value: formatCurrency(purchase['outstanding_amount']),
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
                    (purchaseReturn) => Container(
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
                                purchaseReturn['reference_number']?.toString() ?? '-',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFFB45309),
                                ),
                              ),
                              const Spacer(),
                              Text(
                                formatCurrency(purchaseReturn['total_amount']),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFFB45309),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${formatDate(purchaseReturn['return_date'], pattern: 'dd MMM yyyy HH:mm')} / ${purchaseReturn['recorded_by_name'] ?? 'Staff'}',
                            style: const TextStyle(color: Color(0xFF64748B)),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            ((purchaseReturn['items'] as List<dynamic>? ?? const [])
                                    .cast<Map<String, dynamic>>())
                                .map(
                                  (item) =>
                                      '${item['medicine_name']} x${item['quantity']}',
                                )
                                .join(', '),
                          ),
                          if (purchaseReturn['notes']?.toString().isNotEmpty == true)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                purchaseReturn['notes'].toString(),
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
          if (_hasReturnableItems(purchase))
            FilledButton.tonal(
              onPressed: () async {
                Navigator.of(context).pop();
                await _processReturn(purchase);
              },
              child: const Text('Return to Supplier'),
            ),
          if (asDouble(purchase['outstanding_amount']) > 0)
            FilledButton.tonal(
              onPressed: () async {
                Navigator.of(context).pop();
                await _recordPayment(purchase);
              },
              child: const Text('Pay Supplier'),
            ),
          FilledButton.tonal(
            onPressed: () async {
              Navigator.of(context).pop();
              await context
                  .read<PharmacyApiService>()
                  .openPurchaseReceipt((purchase['id'] as num).toInt());
            },
            child: const Text('Compact Slip'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(context).pop();
              await context
                  .read<PharmacyApiService>()
                  .openPurchaseInvoice((purchase['id'] as num).toInt());
            },
            child: const Text('Print Order'),
          ),
        ],
      ),
    );
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
          Row(
            children: [
              Expanded(
                child: DebouncedSearchField(
                  hintText: 'Search by supplier or invoice number...',
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
                width: 160,
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
                onPressed: _openCreateDialog,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Record Purchase'),
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
                      DataColumn(label: Text('PO #')),
                      DataColumn(label: Text('Date')),
                      DataColumn(label: Text('Supplier')),
                      DataColumn(label: Text('Supplier Ref')),
                      DataColumn(label: Text('Net Cost')),
                      DataColumn(label: Text('Paid')),
                      DataColumn(label: Text('Outstanding')),
                      DataColumn(label: Text('Status')),
                      DataColumn(label: Text('Actions')),
                    ],
                    rows: _items
                        .map(
                          (purchase) => DataRow(
                            cells: [
                              DataCell(Text(purchase['po_number']?.toString() ?? '-')),
                              DataCell(Text(formatDate(purchase['purchase_date']))),
                              DataCell(Text(purchase['supplier_name']?.toString() ?? '-')),
                              DataCell(Text(
                                purchase['invoice_number']?.toString().isNotEmpty == true
                                    ? purchase['invoice_number'].toString()
                                    : '-',
                              )),
                              DataCell(Text(formatCurrency(purchase['net_total_cost']))),
                              DataCell(Text(formatCurrency(purchase['total_paid_amount']))),
                              DataCell(Text(formatCurrency(purchase['outstanding_amount']))),
                              DataCell(
                                _statusBadge(purchase['payment_status']?.toString()),
                              ),
                              DataCell(
                                Wrap(
                                  spacing: 8,
                                  children: [
                                    IconButton(
                                      onPressed: () => _viewPurchase(purchase),
                                      icon: const Icon(Icons.visibility_rounded),
                                    ),
                                    IconButton(
                                      onPressed: () => context
                                          .read<PharmacyApiService>()
                                          .openPurchaseInvoice(
                                            (purchase['id'] as num).toInt(),
                                          ),
                                      icon: const Icon(Icons.print_rounded),
                                    ),
                                    IconButton(
                                      onPressed: () => context
                                          .read<PharmacyApiService>()
                                          .openPurchaseReceipt(
                                            (purchase['id'] as num).toInt(),
                                          ),
                                      icon: const Icon(Icons.receipt_long_rounded),
                                    ),
                                    if (asDouble(purchase['outstanding_amount']) > 0)
                                      IconButton(
                                        onPressed: () => _recordPayment(purchase),
                                        icon: const Icon(Icons.payments_rounded),
                                      ),
                                    if (_hasReturnableItems(purchase))
                                      IconButton(
                                        onPressed: () => _processReturn(purchase),
                                        icon: const Icon(Icons.undo_rounded),
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

class _PurchaseDialog extends StatefulWidget {
  const _PurchaseDialog();

  @override
  State<_PurchaseDialog> createState() => _PurchaseDialogState();
}

class _PurchaseDialogState extends State<_PurchaseDialog> {
  final _formKey = GlobalKey<FormState>();
  final _invoiceController = TextEditingController();
  final _dateController = TextEditingController(
    text: DateTime.now().toIso8601String().split('T').first,
  );
  final _amountPaidController = TextEditingController(text: '0');
  final _notesController = TextEditingController();
  int? _supplierId;
  String _paymentStatus = 'paid';
  String _paymentMethod = 'cash';
  bool _loadingLookups = true;
  bool _saving = false;
  List<Map<String, dynamic>> _suppliers = const [];
  List<Map<String, dynamic>> _medicines = const [];
  final List<_PurchaseLine> _lines = [_PurchaseLine()];

  @override
  void initState() {
    super.initState();
    _loadLookups();
  }

  @override
  void dispose() {
    _invoiceController.dispose();
    _dateController.dispose();
    _amountPaidController.dispose();
    _notesController.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  Future<void> _loadLookups() async {
    final service = context.read<PharmacyApiService>();
    try {
      final suppliers = await service.getSuppliers(
        pageSize: 100,
        activeOnly: true,
      );
      final medicines = await service.getMedicines(
        pageSize: 200,
      );

      if (!mounted) {
        return;
      }
      setState(() {
        _suppliers = suppliers.results;
        _medicines = medicines.results;
      });
    } finally {
      if (mounted) {
        setState(() => _loadingLookups = false);
      }
    }
  }

  double get _draftTotal => _lines.fold<double>(
        0,
        (sum, line) =>
            sum +
            (double.tryParse(line.costController.text.trim()) ?? 0) *
                (double.tryParse(line.quantityController.text.trim()) ?? 0),
      );

  double get _draftPaid {
    final entered = double.tryParse(_amountPaidController.text.trim()) ?? 0;
    if (_paymentStatus == 'paid' && entered <= 0) {
      return _draftTotal;
    }
    return entered.clamp(0, _draftTotal);
  }

  double get _draftOutstanding =>
      (_draftTotal - _draftPaid).clamp(0, double.infinity);

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    if (_supplierId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Supplier is required.')),
      );
      return;
    }
    if (_paymentStatus == 'paid' && _draftPaid < _draftTotal) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Paid purchases must have the full amount recorded.'),
        ),
      );
      return;
    }
    if (_paymentStatus == 'pending' && _draftPaid > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pending purchases cannot record a payment. Use partial instead.'),
        ),
      );
      return;
    }
    if (_paymentStatus == 'partial' &&
        (_draftPaid <= 0 || _draftPaid >= _draftTotal)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Partial purchases need a payment between zero and the total.'),
        ),
      );
      return;
    }

    setState(() => _saving = true);

    try {
      await context.read<PharmacyApiService>().createPurchase({
        'supplier': _supplierId,
        'purchase_date': _dateController.text.trim(),
        'invoice_number': _invoiceController.text.trim(),
        'payment_status': _paymentStatus,
        'amount_paid': _draftPaid,
        'payment_method': _paymentMethod,
        'payment_notes': _draftPaid > 0
            ? 'Initial payment recorded with the purchase.'
            : '',
        'notes': _notesController.text.trim(),
        'items': _lines
            .map(
              (line) => {
                'medicine': line.medicineId,
                'quantity': int.parse(line.quantityController.text.trim()),
                'unit_cost': double.parse(line.costController.text.trim()),
                'batch_number': line.batchController.text.trim(),
                'expiry_date': line.expiryController.text.trim().isEmpty
                    ? null
                    : line.expiryController.text.trim(),
              },
            )
            .toList(),
      });

      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyErrorMessage(error))),
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Record Purchase'),
      content: SizedBox(
        width: 920,
        child: _loadingLookups
            ? const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              )
            : SingleChildScrollView(
                child: Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: DropdownButtonFormField<int>(
                              initialValue: _supplierId,
                              decoration:
                                  const InputDecoration(labelText: 'Supplier'),
                              items: _suppliers
                                  .map(
                                    (supplier) => DropdownMenuItem<int>(
                                      value: (supplier['id'] as num).toInt(),
                                      child: Text(
                                        supplier['name']?.toString() ?? '-',
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) =>
                                  setState(() => _supplierId = value),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _dateController,
                              decoration:
                                  const InputDecoration(labelText: 'Date'),
                              validator: (value) =>
                                  value == null || value.trim().isEmpty
                                      ? 'Date is required'
                                      : null,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _invoiceController,
                              decoration: const InputDecoration(
                                labelText: 'Supplier Invoice #',
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _notesController,
                              decoration:
                                  const InputDecoration(labelText: 'Notes'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              initialValue: _paymentStatus,
                              decoration: const InputDecoration(
                                labelText: 'Payment Status',
                              ),
                              items: const [
                                DropdownMenuItem(value: 'paid', child: Text('Paid')),
                                DropdownMenuItem(value: 'partial', child: Text('Partial')),
                                DropdownMenuItem(value: 'pending', child: Text('Pending')),
                              ],
                              onChanged: (value) => setState(
                                () => _paymentStatus = value ?? 'paid',
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _amountPaidController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Amount Paid Now (PKR)',
                              ),
                              onChanged: (_) => setState(() {}),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              initialValue: _paymentMethod,
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
                              onChanged: (value) => setState(
                                () => _paymentMethod = value ?? 'cash',
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            _MiniSummary(
                              label: 'Total',
                              value: formatCurrency(_draftTotal),
                              color: const Color(0xFF0F172A),
                            ),
                            const SizedBox(width: 12),
                            _MiniSummary(
                              label: 'Paid',
                              value: formatCurrency(_draftPaid),
                              color: const Color(0xFF0369A1),
                            ),
                            const SizedBox(width: 12),
                            _MiniSummary(
                              label: 'Outstanding',
                              value: formatCurrency(_draftOutstanding),
                              color: _draftOutstanding > 0
                                  ? const Color(0xFFB45309)
                                  : const Color(0xFF15803D),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Line Items',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      const SizedBox(height: 12),
                      ..._lines.asMap().entries.map((entry) {
                        final index = entry.key;
                        final line = entry.value;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    flex: 2,
                                    child: DropdownButtonFormField<int>(
                                      initialValue: line.medicineId,
                                      decoration: const InputDecoration(
                                        labelText: 'Medicine',
                                      ),
                                      items: _medicines
                                          .map(
                                            (medicine) => DropdownMenuItem<int>(
                                              value: (medicine['id'] as num)
                                                  .toInt(),
                                              child: Text(
                                                medicine['name']?.toString() ??
                                                    '-',
                                              ),
                                            ),
                                          )
                                          .toList(),
                                      onChanged: (value) =>
                                          setState(() => line.medicineId = value),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: TextFormField(
                                      controller: line.quantityController,
                                      decoration: const InputDecoration(
                                        labelText: 'Qty',
                                      ),
                                      keyboardType: TextInputType.number,
                                      onChanged: (_) => setState(() {}),
                                      validator: (value) {
                                        final parsed =
                                            int.tryParse(value ?? '');
                                        if (parsed == null || parsed <= 0) {
                                          return 'Qty';
                                        }
                                        return null;
                                      },
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: TextFormField(
                                      controller: line.costController,
                                      decoration: const InputDecoration(
                                        labelText: 'Unit Cost',
                                      ),
                                      keyboardType: TextInputType.number,
                                      onChanged: (_) => setState(() {}),
                                      validator: (value) {
                                        final parsed =
                                            double.tryParse(value ?? '');
                                        if (parsed == null || parsed <= 0) {
                                          return 'Cost';
                                        }
                                        return null;
                                      },
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: TextFormField(
                                      controller: line.batchController,
                                      decoration: const InputDecoration(
                                        labelText: 'Batch #',
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: TextFormField(
                                      controller: line.expiryController,
                                      decoration: const InputDecoration(
                                        labelText: 'Expiry',
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  if (_lines.length > 1)
                                    IconButton(
                                      onPressed: () => setState(() {
                                        final removed = _lines.removeAt(index);
                                        removed.dispose();
                                      }),
                                      icon: const Icon(Icons.delete_rounded),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        );
                      }),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: () => setState(() => _lines.add(_PurchaseLine())),
                          icon: const Icon(Icons.add_rounded),
                          label: const Text('Add Item'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: Text(_saving ? 'Recording...' : 'Record Purchase'),
        ),
      ],
    );
  }
}

class _PurchaseLine {
  int? medicineId;
  final quantityController = TextEditingController(text: '1');
  final costController = TextEditingController();
  final batchController = TextEditingController();
  final expiryController = TextEditingController();

  void dispose() {
    quantityController.dispose();
    costController.dispose();
    batchController.dispose();
    expiryController.dispose();
  }
}

class _MiniSummary extends StatelessWidget {
  const _MiniSummary({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF64748B),
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
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
