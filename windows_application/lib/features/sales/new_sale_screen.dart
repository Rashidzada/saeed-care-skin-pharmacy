import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/services/pharmacy_api_service.dart';
import '../../core/utils/error_message.dart';
import '../../core/utils/formatters.dart';
import '../../widgets/app_panel.dart';
import '../shell/shell_section.dart';

class NewSaleScreen extends StatefulWidget {
  const NewSaleScreen({
    super.key,
    required this.onNavigate,
  });

  final ValueChanged<ShellSection> onNavigate;

  @override
  State<NewSaleScreen> createState() => _NewSaleScreenState();
}

class _NewSaleScreenState extends State<NewSaleScreen> {
  final _medicineSearchController = TextEditingController();
  final _customerSearchController = TextEditingController();
  final _taxController = TextEditingController(text: '0');
  final _discountController = TextEditingController(text: '0');
  final _amountPaidController = TextEditingController(text: '0');
  final _notesController = TextEditingController();

  List<Map<String, dynamic>> _medicineResults = const [];
  List<Map<String, dynamic>> _customerResults = const [];
  final List<Map<String, dynamic>> _cart = [];
  Map<String, dynamic>? _selectedCustomer;
  String _paymentStatus = 'paid';
  String _paymentMethod = 'cash';
  bool _submitting = false;
  bool _searchingMedicines = false;
  bool _searchingCustomers = false;

  @override
  void dispose() {
    _medicineSearchController.dispose();
    _customerSearchController.dispose();
    _taxController.dispose();
    _discountController.dispose();
    _amountPaidController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _searchMedicines(String value) async {
    if (value.trim().isEmpty) {
      setState(() => _medicineResults = const []);
      return;
    }

    setState(() => _searchingMedicines = true);
    try {
      final response = await context.read<PharmacyApiService>().getMedicines(
            pageSize: 20,
            search: value.trim(),
          );
      if (!mounted) {
        return;
      }
      setState(() => _medicineResults = response.results);
    } finally {
      if (mounted) {
        setState(() => _searchingMedicines = false);
      }
    }
  }

  Future<void> _searchCustomers(String value) async {
    if (value.trim().isEmpty) {
      setState(() => _customerResults = const []);
      return;
    }

    setState(() => _searchingCustomers = true);
    try {
      final response = await context.read<PharmacyApiService>().getCustomers(
            pageSize: 20,
            search: value.trim(),
          );
      if (!mounted) {
        return;
      }
      setState(() => _customerResults = response.results);
    } finally {
      if (mounted) {
        setState(() => _searchingCustomers = false);
      }
    }
  }

  void _addToCart(Map<String, dynamic> medicine) {
    final stock = asInt(medicine['quantity']);
    if (stock <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${medicine['name']} is out of stock.')),
      );
      return;
    }

    final medicineId = (medicine['id'] as num).toInt();
    final index =
        _cart.indexWhere((item) => item['medicine_id'] as int == medicineId);

    if (index >= 0) {
      final current = _cart[index];
      final nextQuantity = (current['quantity'] as int) + 1;
      if (nextQuantity > (current['max_quantity'] as int)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Only ${current['max_quantity']} units available.'),
          ),
        );
        return;
      }

      setState(() {
        _cart[index] = {
          ...current,
          'quantity': nextQuantity,
        };
      });
    } else {
      setState(() {
        _cart.add({
          'medicine_id': medicineId,
          'name': medicine['name']?.toString() ?? '',
          'unit_price': asDouble(medicine['unit_price']),
          'quantity': 1,
          'max_quantity': stock,
        });
      });
    }

    _medicineSearchController.clear();
    setState(() => _medicineResults = const []);
  }

  void _changeQty(int medicineId, int delta) {
    final index = _cart.indexWhere((item) => item['medicine_id'] == medicineId);
    if (index < 0) {
      return;
    }

    final item = _cart[index];
    final nextQuantity = (item['quantity'] as int) + delta;
    if (nextQuantity <= 0) {
      setState(() => _cart.removeAt(index));
      return;
    }
    if (nextQuantity > (item['max_quantity'] as int)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Only ${item['max_quantity']} units available.'),
        ),
      );
      return;
    }

    setState(() {
      _cart[index] = {
        ...item,
        'quantity': nextQuantity,
      };
    });
  }

  double get _subtotal => _cart.fold<double>(
        0,
        (sum, item) =>
            sum + asDouble(item['unit_price']) * asInt(item['quantity']),
      );

  double get _taxRate => double.tryParse(_taxController.text.trim()) ?? 0;
  double get _discount => double.tryParse(_discountController.text.trim()) ?? 0;
  double get _enteredAmountPaid =>
      double.tryParse(_amountPaidController.text.trim()) ?? 0;
  double get _taxAmount => _subtotal * (_taxRate / 100);
  double get _grandTotal =>
      (_subtotal + _taxAmount - _discount).clamp(0, double.infinity);
  double get _paidNow {
    if (_paymentStatus == 'paid' && _enteredAmountPaid <= 0) {
      return _grandTotal;
    }
    return _enteredAmountPaid.clamp(0, _grandTotal);
  }

  double get _balanceDue => (_grandTotal - _paidNow).clamp(0, double.infinity);

  Future<void> _completeSale() async {
    final service = context.read<PharmacyApiService>();
    if (_cart.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cart is empty.')),
      );
      return;
    }
    if (_paymentStatus == 'paid' && _paidNow < _grandTotal) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Paid sales must have the full amount collected.'),
        ),
      );
      return;
    }
    if (_paymentStatus == 'pending' && _paidNow > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pending sales cannot record a payment. Use partial instead.'),
        ),
      );
      return;
    }
    if (_paymentStatus == 'partial' &&
        (_paidNow <= 0 || _paidNow >= _grandTotal)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Partial sales need a payment amount between zero and the full total.'),
        ),
      );
      return;
    }
    if (_balanceDue > 0 && _selectedCustomer == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Select a registered customer for pending or partial sales.'),
        ),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Sale'),
        content: Text(
          'Complete this sale for ${formatCurrency(_grandTotal)}?\n'
          'Paid now: ${formatCurrency(_paidNow)}\n'
          'Balance due: ${formatCurrency(_balanceDue)}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Back'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() => _submitting = true);
    try {
      final sale = await service.createSale({
        'customer': (_selectedCustomer?['id'] as num?)?.toInt(),
        'items': _cart
            .map(
              (item) => {
                'medicine': item['medicine_id'],
                'quantity': item['quantity'],
                'unit_price': item['unit_price'],
              },
            )
            .toList(),
        'tax_rate': _taxRate,
        'discount': _discount,
        'payment_status': _paymentStatus,
        'amount_paid': _paidNow,
        'payment_method': _paymentMethod,
        'payment_notes': _paidNow > 0
            ? 'Initial payment recorded at the time of sale.'
            : '',
        'notes': _notesController.text.trim(),
      });

      if (!mounted) {
        return;
      }

      final action = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Sale Completed'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Invoice: ${sale['invoice_number']}'),
              const SizedBox(height: 6),
              Text('Net total: ${formatCurrency(sale['net_total_amount'] ?? sale['total_amount'])}'),
              const SizedBox(height: 6),
              Text('Paid: ${formatCurrency(sale['total_paid_amount'])}'),
              Text('Outstanding: ${formatCurrency(sale['outstanding_amount'])}'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop('print'),
              child: const Text('Print Invoice'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop('receipt'),
              child: const Text('Thermal Receipt'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop('sales'),
              child: const Text('View Sales'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop('new'),
              child: const Text('New Sale'),
            ),
          ],
        ),
      );

      if (action == 'print') {
        await service.openSaleInvoice((sale['id'] as num).toInt());
      } else if (action == 'receipt') {
        await service.openSaleReceipt((sale['id'] as num).toInt());
      }

      if (!mounted) {
        return;
      }

      if (action == 'sales') {
        widget.onNavigate(ShellSection.salesHistory);
      } else {
        _reset();
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyErrorMessage(error))),
      );
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  void _reset() {
    setState(() {
      _cart.clear();
      _medicineResults = const [];
      _customerResults = const [];
      _selectedCustomer = null;
      _paymentStatus = 'paid';
      _paymentMethod = 'cash';
      _medicineSearchController.clear();
      _customerSearchController.clear();
      _taxController.text = '0';
      _discountController.text = '0';
      _amountPaidController.text = '0';
      _notesController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 3,
            child: Column(
              children: [
                AppPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Search Medicines',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _medicineSearchController,
                        onChanged: _searchMedicines,
                        decoration: InputDecoration(
                          hintText: 'Type medicine name or batch number...',
                          suffixIcon: _searchingMedicines
                              ? const Padding(
                                  padding: EdgeInsets.all(12),
                                  child: SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  ),
                                )
                              : null,
                        ),
                      ),
                      if (_medicineResults.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 260),
                          child: ListView.builder(
                            shrinkWrap: true,
                            itemCount: _medicineResults.length,
                            itemBuilder: (context, index) {
                              final medicine = _medicineResults[index];
                              return Card(
                                color: const Color(0xFFF8FAFC),
                                child: ListTile(
                                  onTap: () => _addToCart(medicine),
                                  title: Text(medicine['name']?.toString() ?? '-'),
                                  subtitle: Text(
                                    'Batch: ${medicine['batch_number']} | Expiry: ${medicine['expiry_date']} | Stock: ${medicine['quantity']}',
                                  ),
                                  trailing: Text(
                                    formatCurrency(medicine['unit_price']),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF0F766E),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                AppPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Customer (Optional)',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 14),
                      if (_selectedCustomer != null)
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0xFFBBF7D0)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _selectedCustomer!['name'].toString(),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    Text(_selectedCustomer!['phone'].toString()),
                                  ],
                                ),
                              ),
                              IconButton(
                                onPressed: () =>
                                    setState(() => _selectedCustomer = null),
                                icon: const Icon(Icons.close_rounded),
                              ),
                            ],
                          ),
                        )
                      else ...[
                        TextField(
                          controller: _customerSearchController,
                          onChanged: _searchCustomers,
                          decoration: InputDecoration(
                            hintText: 'Search customer by name or phone...',
                            suffixIcon: _searchingCustomers
                                ? const Padding(
                                    padding: EdgeInsets.all(12),
                                    child: SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    ),
                                  )
                                : null,
                          ),
                        ),
                        if (_customerResults.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxHeight: 180),
                            child: ListView.builder(
                              shrinkWrap: true,
                              itemCount: _customerResults.length,
                              itemBuilder: (context, index) {
                                final customer = _customerResults[index];
                                return Card(
                                  color: const Color(0xFFF8FAFC),
                                  child: ListTile(
                                    onTap: () {
                                      setState(() {
                                        _selectedCustomer = customer;
                                        _customerResults = const [];
                                        _customerSearchController.clear();
                                      });
                                    },
                                    title: Text(customer['name']?.toString() ?? '-'),
                                    subtitle: Text(
                                      '${customer['phone']?.toString() ?? '-'}'
                                      '${asDouble(customer['pending_balance']) > 0 ? '  |  Due ${formatCurrency(customer['pending_balance'])}' : ''}',
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                        ],
                      const SizedBox(height: 10),
                      const Text(
                        'Walk-in is allowed for paid sales. Pending or partial sales must use a registered customer.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
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
                        'Sale Settings',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _taxController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Tax Rate (%)',
                              ),
                              onChanged: (_) => setState(() {}),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextField(
                              controller: _discountController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Discount (PKR)',
                              ),
                              onChanged: (_) => setState(() {}),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              initialValue: _paymentStatus,
                              decoration:
                                  const InputDecoration(labelText: 'Payment'),
                              items: const [
                                DropdownMenuItem(
                                  value: 'paid',
                                  child: Text('Paid'),
                                ),
                                DropdownMenuItem(
                                  value: 'partial',
                                  child: Text('Partial'),
                                ),
                                DropdownMenuItem(
                                  value: 'pending',
                                  child: Text('Pending'),
                                ),
                              ],
                              onChanged: (value) => setState(
                                () => _paymentStatus = value ?? 'paid',
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
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
                            _SummaryChip(
                              label: 'Net Total',
                              value: formatCurrency(_grandTotal),
                              color: const Color(0xFF0F172A),
                            ),
                            const SizedBox(width: 12),
                            _SummaryChip(
                              label: 'Paid Now',
                              value: formatCurrency(_paidNow),
                              color: const Color(0xFF0369A1),
                            ),
                            const SizedBox(width: 12),
                            _SummaryChip(
                              label: 'Balance',
                              value: formatCurrency(_balanceDue),
                              color: _balanceDue > 0
                                  ? const Color(0xFFB45309)
                                  : const Color(0xFF15803D),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _notesController,
                        minLines: 2,
                        maxLines: 3,
                        decoration:
                            const InputDecoration(labelText: 'Notes (optional)'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            flex: 2,
            child: AppPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'Cart',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const Spacer(),
                      Chip(label: Text('${_cart.length} items')),
                    ],
                  ),
                  const SizedBox(height: 14),
                  if (_cart.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(26),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.shopping_cart_outlined,
                              size: 40, color: Color(0xFF94A3B8)),
                          SizedBox(height: 8),
                          Text('Cart is empty'),
                          SizedBox(height: 4),
                          Text('Search and add medicines to continue.'),
                        ],
                      ),
                    )
                  else
                    ..._cart.map((item) {
                      final total =
                          asDouble(item['unit_price']) * asInt(item['quantity']);
                      return Container(
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
                                    item['name'].toString(),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                IconButton(
                                  onPressed: () => _changeQty(
                                    item['medicine_id'] as int,
                                    -(item['quantity'] as int),
                                  ),
                                  icon: const Icon(Icons.delete_rounded),
                                ),
                              ],
                            ),
                            Row(
                              children: [
                                Text(
                                  formatCurrency(item['unit_price']),
                                ),
                                const Spacer(),
                                IconButton(
                                  onPressed: () => _changeQty(
                                    item['medicine_id'] as int,
                                    -1,
                                  ),
                                  icon:
                                      const Icon(Icons.remove_circle_outline),
                                ),
                                Text('${item['quantity']}'),
                                IconButton(
                                  onPressed: () => _changeQty(
                                    item['medicine_id'] as int,
                                    1,
                                  ),
                                  icon: const Icon(Icons.add_circle_outline),
                                ),
                              ],
                            ),
                            Align(
                              alignment: Alignment.centerRight,
                              child: Text(
                                formatCurrency(total),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  const Divider(height: 28),
                  _TotalRow(label: 'Subtotal', value: formatCurrency(_subtotal)),
                  _TotalRow(
                    label: 'Tax (${_taxRate.toStringAsFixed(1)}%)',
                    value: formatCurrency(_taxAmount),
                  ),
                  if (_discount > 0)
                    _TotalRow(
                      label: 'Discount',
                      value: '-${formatCurrency(_discount)}',
                    ),
                  const SizedBox(height: 10),
                  _TotalRow(
                    label: 'Grand Total',
                    value: formatCurrency(_grandTotal),
                    large: true,
                  ),
                  _TotalRow(
                    label: 'Paid Now',
                    value: formatCurrency(_paidNow),
                  ),
                  _TotalRow(
                    label: 'Balance Due',
                    value: formatCurrency(_balanceDue),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submitting ? null : _completeSale,
                      child: Text(
                        _submitting ? 'Processing...' : 'Complete Sale',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
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

class _TotalRow extends StatelessWidget {
  const _TotalRow({
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
            .titleLarge
            ?.copyWith(fontWeight: FontWeight.w800)
        : Theme.of(context).textTheme.bodyLarge;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(label, style: style),
          const Spacer(),
          Text(
            value,
            style: style?.copyWith(
              color: large ? const Color(0xFF2563EB) : null,
            ),
          ),
        ],
      ),
    );
  }
}
