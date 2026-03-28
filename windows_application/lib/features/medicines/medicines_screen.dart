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

class MedicinesScreen extends StatefulWidget {
  const MedicinesScreen({super.key});

  @override
  State<MedicinesScreen> createState() => _MedicinesScreenState();
}

class _MedicinesScreenState extends State<MedicinesScreen> {
  static const _filters = ['all', 'low_stock', 'near_expiry', 'expired'];
  static const _categories = [
    'tablet',
    'capsule',
    'syrup',
    'injection',
    'cream',
    'drops',
    'inhaler',
    'powder',
    'other',
  ];

  final _pageSize = 20;
  List<Map<String, dynamic>> _items = const [];
  int _count = 0;
  int _page = 1;
  String _search = '';
  String _filter = 'all';
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
      final response = await context.read<PharmacyApiService>().getMedicines(
            page: _page,
            pageSize: _pageSize,
            search: _search,
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
      setState(() {
        _error = friendlyErrorMessage(error);
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  List<Map<String, dynamic>> get _filteredItems {
    return _items.where((item) {
      if (_filter == 'low_stock') {
        return item['is_low_stock'] == true;
      }
      if (_filter == 'near_expiry') {
        return item['status']?.toString() == 'near_expiry';
      }
      if (_filter == 'expired') {
        return item['is_expired'] == true;
      }
      return true;
    }).toList();
  }

  Future<void> _openDialog([Map<String, dynamic>? item]) async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (_) => _MedicineDialog(
        initial: item,
        categories: _categories,
      ),
    );

    if (changed == true) {
      await _load();
    }
  }

  Future<void> _delete(Map<String, dynamic> item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove Medicine'),
        content: Text(
          'Remove ${item['name']}? This will deactivate the medicine.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Remove'),
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
          .deleteMedicine((item['id'] as num).toInt());
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Medicine removed.')),
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

  @override
  Widget build(BuildContext context) {
    final isStaff = context.watch<SessionController>().user?.isStaff ?? false;

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
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _filters.map((filter) {
                    final selected = _filter == filter;
                    return ChoiceChip(
                      selected: selected,
                      label: Text(
                        filter == 'all'
                            ? 'All'
                            : filter == 'low_stock'
                                ? 'Low Stock'
                                : filter == 'near_expiry'
                                    ? 'Near Expiry'
                                    : 'Expired',
                      ),
                      onSelected: (_) => setState(() => _filter = filter),
                    );
                  }).toList(),
                ),
              ),
              if (isStaff)
                FilledButton.icon(
                  onPressed: _openDialog,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Add Medicine'),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: DebouncedSearchField(
                  hintText: 'Search by name, batch, or manufacturer...',
                  onChanged: (value) {
                    setState(() {
                      _search = value;
                      _page = 1;
                    });
                    _load();
                  },
                ),
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
                    columns: [
                      const DataColumn(label: Text('Name')),
                      const DataColumn(label: Text('Category')),
                      const DataColumn(label: Text('Batch')),
                      const DataColumn(label: Text('Expiry')),
                      const DataColumn(label: Text('Price')),
                      const DataColumn(label: Text('Stock')),
                      const DataColumn(label: Text('Status')),
                      if (isStaff) const DataColumn(label: Text('Actions')),
                    ],
                    rows: _filteredItems
                        .map(
                          (item) => DataRow(
                            color: WidgetStatePropertyAll(_rowColor(item)),
                            cells: [
                              DataCell(
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      item['name']?.toString() ?? '-',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    if (item['generic_name']
                                            ?.toString()
                                            .isNotEmpty ==
                                        true)
                                      Text(
                                        item['generic_name'].toString(),
                                        style: const TextStyle(
                                          color: Color(0xFF64748B),
                                          fontSize: 12,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              DataCell(
                                Text(
                                  item['category']?.toString().toUpperCase() ??
                                      '-',
                                ),
                              ),
                              DataCell(
                                Text(item['batch_number']?.toString() ?? '-'),
                              ),
                              DataCell(Text(formatDate(item['expiry_date']))),
                              DataCell(
                                Text(
                                  formatCurrency(item['unit_price']),
                                ),
                              ),
                              DataCell(
                                Text(
                                  '${item['quantity'] ?? 0}',
                                  style: TextStyle(
                                    color: (item['is_low_stock'] as bool? ??
                                                false)
                                        ? const Color(0xFFB91C1C)
                                        : const Color(0xFF0F172A),
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              DataCell(_statusBadge(item['status']?.toString())),
                              if (isStaff)
                                DataCell(
                                  Wrap(
                                    spacing: 8,
                                    children: [
                                      IconButton(
                                        onPressed: () => _openDialog(item),
                                        icon: const Icon(Icons.edit_rounded),
                                      ),
                                      IconButton(
                                        onPressed: () => _delete(item),
                                        icon: const Icon(Icons.delete_rounded),
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

  Color? _rowColor(Map<String, dynamic> item) {
    final status = item['status']?.toString();
    if (status == 'expired' || status == 'out_of_stock') {
      return const Color(0xFFFFF1F2);
    }
    if (status == 'near_expiry') {
      return const Color(0xFFFFF7ED);
    }
    if (item['is_low_stock'] == true) {
      return const Color(0xFFFFFBEB);
    }
    return null;
  }

  Widget _statusBadge(String? status) {
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

class _MedicineDialog extends StatefulWidget {
  const _MedicineDialog({
    required this.categories,
    this.initial,
  });

  final List<String> categories;
  final Map<String, dynamic>? initial;

  @override
  State<_MedicineDialog> createState() => _MedicineDialogState();
}

class _MedicineDialogState extends State<_MedicineDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _genericController;
  late final TextEditingController _manufacturerController;
  late final TextEditingController _batchController;
  late final TextEditingController _expiryController;
  late final TextEditingController _priceController;
  late final TextEditingController _quantityController;
  late final TextEditingController _thresholdController;
  late final TextEditingController _descriptionController;
  String? _category;
  int? _supplierId;
  bool _saving = false;
  bool _loadingSuppliers = true;
  List<Map<String, dynamic>> _suppliers = const [];

  bool get _editing => widget.initial != null;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial ?? const {};
    _nameController =
        TextEditingController(text: initial['name']?.toString() ?? '');
    _genericController =
        TextEditingController(text: initial['generic_name']?.toString() ?? '');
    _manufacturerController = TextEditingController(
      text: initial['manufacturer']?.toString() ?? '',
    );
    _batchController =
        TextEditingController(text: initial['batch_number']?.toString() ?? '');
    _expiryController =
        TextEditingController(text: initial['expiry_date']?.toString() ?? '');
    _priceController =
        TextEditingController(text: initial['unit_price']?.toString() ?? '');
    _quantityController =
        TextEditingController(text: initial['quantity']?.toString() ?? '');
    _thresholdController = TextEditingController(
      text: initial['min_stock_threshold']?.toString() ?? '0',
    );
    _descriptionController = TextEditingController(
      text: initial['description']?.toString() ?? '',
    );
    _category = initial['category']?.toString();
    _supplierId = (initial['supplier'] as num?)?.toInt();
    _loadSuppliers();
  }

  Future<void> _loadSuppliers() async {
    try {
      final response = await context.read<PharmacyApiService>().getSuppliers(
            pageSize: 100,
            activeOnly: true,
          );
      if (!mounted) {
        return;
      }
      setState(() {
        _suppliers = response.results;
      });
    } finally {
      if (mounted) {
        setState(() => _loadingSuppliers = false);
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _genericController.dispose();
    _manufacturerController.dispose();
    _batchController.dispose();
    _expiryController.dispose();
    _priceController.dispose();
    _quantityController.dispose();
    _thresholdController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _saving = true);

    final payload = {
      'name': _nameController.text.trim(),
      'generic_name': _genericController.text.trim(),
      'category': _category,
      'manufacturer': _manufacturerController.text.trim(),
      'batch_number': _batchController.text.trim(),
      'expiry_date': _expiryController.text.trim(),
      'unit_price': double.parse(_priceController.text.trim()),
      'quantity': int.parse(_quantityController.text.trim()),
      'min_stock_threshold': int.parse(_thresholdController.text.trim()),
      'supplier': _supplierId,
      'description': _descriptionController.text.trim(),
    };

    try {
      final service = context.read<PharmacyApiService>();
      if (_editing) {
        await service.updateMedicine(
          (widget.initial!['id'] as num).toInt(),
          payload,
        );
      } else {
        await service.createMedicine(payload);
      }

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
      title: Text(_editing ? 'Edit Medicine' : 'Add Medicine'),
      content: SizedBox(
        width: 760,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Medicine Name'),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Name is required'
                      : null,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _genericController,
                        decoration:
                            const InputDecoration(labelText: 'Generic Name'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _category,
                        decoration:
                            const InputDecoration(labelText: 'Category'),
                        items: widget.categories
                            .map(
                              (category) => DropdownMenuItem(
                                value: category,
                                child: Text(category.toUpperCase()),
                              ),
                            )
                            .toList(),
                        onChanged: (value) => setState(() => _category = value),
                        validator: (value) =>
                            value == null ? 'Category is required' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _manufacturerController,
                        decoration:
                            const InputDecoration(labelText: 'Manufacturer'),
                        validator: (value) =>
                            value == null || value.trim().isEmpty
                                ? 'Manufacturer is required'
                                : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _batchController,
                        decoration:
                            const InputDecoration(labelText: 'Batch Number'),
                        validator: (value) =>
                            value == null || value.trim().isEmpty
                                ? 'Batch number is required'
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
                        controller: _expiryController,
                        decoration:
                            const InputDecoration(labelText: 'Expiry Date'),
                        validator: (value) =>
                            value == null || value.trim().isEmpty
                                ? 'Expiry date is required'
                                : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _priceController,
                        decoration:
                            const InputDecoration(labelText: 'Unit Price'),
                        keyboardType: TextInputType.number,
                        validator: (value) {
                          final parsed = double.tryParse(value ?? '');
                          if (parsed == null || parsed <= 0) {
                            return 'Enter a valid price';
                          }
                          return null;
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _quantityController,
                        decoration:
                            const InputDecoration(labelText: 'Quantity'),
                        keyboardType: TextInputType.number,
                        validator: (value) {
                          final parsed = int.tryParse(value ?? '');
                          if (parsed == null || parsed < 0) {
                            return 'Enter a valid quantity';
                          }
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _thresholdController,
                        decoration: const InputDecoration(
                          labelText: 'Minimum Stock Threshold',
                        ),
                        keyboardType: TextInputType.number,
                        validator: (value) {
                          final parsed = int.tryParse(value ?? '');
                          if (parsed == null || parsed < 0) {
                            return 'Enter a valid threshold';
                          }
                          return null;
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<int?>(
                  initialValue: _supplierId,
                  decoration: const InputDecoration(labelText: 'Supplier'),
                  items: [
                    const DropdownMenuItem<int?>(
                      value: null,
                      child: Text('No supplier'),
                    ),
                    ..._suppliers.map(
                      (supplier) => DropdownMenuItem<int?>(
                        value: (supplier['id'] as num).toInt(),
                        child: Text(supplier['name']?.toString() ?? '-'),
                      ),
                    ),
                  ],
                  onChanged: _loadingSuppliers
                      ? null
                      : (value) => setState(() => _supplierId = value),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _descriptionController,
                  minLines: 2,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Description'),
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
          child: Text(_saving ? 'Saving...' : _editing ? 'Update' : 'Create'),
        ),
      ],
    );
  }
}
