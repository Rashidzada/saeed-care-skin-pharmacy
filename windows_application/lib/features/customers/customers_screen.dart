import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/services/pharmacy_api_service.dart';
import '../../core/utils/error_message.dart';
import '../../core/utils/formatters.dart';
import '../../widgets/app_panel.dart';
import '../../widgets/debounced_search_field.dart';
import '../../widgets/loading_body.dart';
import '../../widgets/pagination_bar.dart';
import '../auth/session_controller.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  final _pageSize = 20;
  List<Map<String, dynamic>> _items = const [];
  int _count = 0;
  int _page = 1;
  String _search = '';
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
      final response = await context.read<PharmacyApiService>().getCustomers(
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

  Future<void> _openDialog([Map<String, dynamic>? item]) async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (_) => _CustomerDialog(initial: item),
    );

    if (changed == true) {
      await _load();
    }
  }

  Future<void> _delete(Map<String, dynamic> item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Customer'),
        content: Text('Delete ${item['name']}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Delete'),
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
          .deleteCustomer((item['id'] as num).toInt());
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Customer deleted.')),
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
                child: DebouncedSearchField(
                  hintText: 'Search customers by name, phone, or email...',
                  onChanged: (value) {
                    setState(() {
                      _search = value;
                      _page = 1;
                    });
                    _load();
                  },
                ),
              ),
              if (isStaff) ...[
                const SizedBox(width: 12),
                FilledButton.icon(
                  onPressed: _openDialog,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Add Customer'),
                ),
              ],
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
                      const DataColumn(label: Text('Phone')),
                      const DataColumn(label: Text('Email')),
                      const DataColumn(label: Text('Purchases')),
                      const DataColumn(label: Text('Joined')),
                      if (isStaff) const DataColumn(label: Text('Actions')),
                    ],
                    rows: _items
                        .map(
                          (item) => DataRow(
                            cells: [
                              DataCell(Text(item['name']?.toString() ?? '-')),
                              DataCell(Text(item['phone']?.toString() ?? '-')),
                              DataCell(Text(item['email']?.toString().isNotEmpty == true
                                  ? item['email'].toString()
                                  : '-')),
                              DataCell(
                                Text('${item['purchase_count'] ?? 0}'),
                              ),
                              DataCell(
                                Text(formatDate(item['created_at'])),
                              ),
                              if (isStaff)
                                DataCell(
                                  Wrap(
                                    spacing: 8,
                                    children: [
                                      IconButton(
                                        tooltip: 'Edit',
                                        onPressed: () => _openDialog(item),
                                        icon: const Icon(Icons.edit_rounded),
                                      ),
                                      IconButton(
                                        tooltip: 'Delete',
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
}

class _CustomerDialog extends StatefulWidget {
  const _CustomerDialog({this.initial});

  final Map<String, dynamic>? initial;

  @override
  State<_CustomerDialog> createState() => _CustomerDialogState();
}

class _CustomerDialogState extends State<_CustomerDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;
  late final TextEditingController _addressController;
  bool _saving = false;

  bool get _editing => widget.initial != null;

  @override
  void initState() {
    super.initState();
    _nameController =
        TextEditingController(text: widget.initial?['name']?.toString() ?? '');
    _phoneController =
        TextEditingController(text: widget.initial?['phone']?.toString() ?? '');
    _emailController =
        TextEditingController(text: widget.initial?['email']?.toString() ?? '');
    _addressController = TextEditingController(
      text: widget.initial?['address']?.toString() ?? '',
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _saving = true);

    final payload = {
      'name': _nameController.text.trim(),
      'phone': _phoneController.text.trim(),
      'email': _emailController.text.trim(),
      'address': _addressController.text.trim(),
    };

    try {
      final service = context.read<PharmacyApiService>();
      if (_editing) {
        await service.updateCustomer(
          (widget.initial!['id'] as num).toInt(),
          payload,
        );
      } else {
        await service.createCustomer(payload);
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
      title: Text(_editing ? 'Edit Customer' : 'Add Customer'),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Full Name'),
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'Name is required'
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phoneController,
                decoration: const InputDecoration(labelText: 'Phone'),
                validator: (value) => value == null || value.trim().length < 7
                    ? 'Valid phone is required'
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _addressController,
                minLines: 2,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Address'),
              ),
            ],
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
