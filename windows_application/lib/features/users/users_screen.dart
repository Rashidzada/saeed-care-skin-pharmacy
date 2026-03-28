import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/services/pharmacy_api_service.dart';
import '../../core/utils/error_message.dart';
import '../../core/utils/formatters.dart';
import '../../widgets/app_panel.dart';
import '../../widgets/loading_body.dart';
import '../../widgets/status_badge.dart';
import '../auth/session_controller.dart';

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  List<Map<String, dynamic>> _items = const [];
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
      final users = await context.read<PharmacyApiService>().getUsers();
      if (!mounted) {
        return;
      }
      setState(() => _items = users);
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

  Future<void> _openDialog([Map<String, dynamic>? user]) async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (_) => _UserDialog(initial: user),
    );

    if (changed == true) {
      await _load();
    }
  }

  Future<void> _toggleStatus(Map<String, dynamic> user) async {
    final currentUserId = context.read<SessionController>().user?.id;
    if (currentUserId == (user['id'] as num).toInt()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot change your own status.')),
      );
      return;
    }

    try {
      final service = context.read<PharmacyApiService>();
      if (user['is_active'] == true) {
        await service.deactivateUser((user['id'] as num).toInt());
      } else {
        await service.activateUser((user['id'] as num).toInt());
      }

      if (!mounted) {
        return;
      }
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
              const Spacer(),
              FilledButton.icon(
                onPressed: _openDialog,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Add User'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AppPanel(
            padding: const EdgeInsets.all(12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columns: const [
                  DataColumn(label: Text('Username')),
                  DataColumn(label: Text('Email')),
                  DataColumn(label: Text('Role')),
                  DataColumn(label: Text('Status')),
                  DataColumn(label: Text('Created')),
                  DataColumn(label: Text('Actions')),
                ],
                rows: _items
                    .map(
                      (user) => DataRow(
                        cells: [
                          DataCell(
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  user['username']?.toString() ?? '-',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  user['full_name']?.toString().isNotEmpty == true
                                      ? user['full_name'].toString()
                                      : '-',
                                  style: const TextStyle(
                                    color: Color(0xFF64748B),
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          DataCell(Text(user['email']?.toString().isNotEmpty == true
                              ? user['email'].toString()
                              : '-')),
                          DataCell(_roleBadge(user['role']?.toString())),
                          DataCell(
                            StatusBadge(
                              label: (user['is_active'] as bool? ?? false)
                                  ? 'ACTIVE'
                                  : 'INACTIVE',
                              background: (user['is_active'] as bool? ?? false)
                                  ? const Color(0xFFDCFCE7)
                                  : const Color(0xFFFEE2E2),
                              foreground: (user['is_active'] as bool? ?? false)
                                  ? const Color(0xFF15803D)
                                  : const Color(0xFFB91C1C),
                            ),
                          ),
                          DataCell(Text(formatDate(user['created_at']))),
                          DataCell(
                            Wrap(
                              spacing: 8,
                              children: [
                                IconButton(
                                  onPressed: () => _openDialog(user),
                                  icon: const Icon(Icons.edit_rounded),
                                ),
                                IconButton(
                                  onPressed: () => _toggleStatus(user),
                                  icon: Icon(
                                    (user['is_active'] as bool? ?? false)
                                        ? Icons.person_off_rounded
                                        : Icons.person_rounded,
                                  ),
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
          ),
        ],
      ),
    );
  }

  Widget _roleBadge(String? role) {
    switch (role) {
      case 'admin':
        return const StatusBadge(
          label: 'ADMIN',
          background: Color(0xFFEDE9FE),
          foreground: Color(0xFF6D28D9),
        );
      case 'staff':
        return const StatusBadge(
          label: 'STAFF',
          background: Color(0xFFCCFBF1),
          foreground: Color(0xFF0F766E),
        );
      default:
        return const StatusBadge(
          label: 'VIEWER',
          background: Color(0xFFE5E7EB),
          foreground: Color(0xFF4B5563),
        );
    }
  }
}

class _UserDialog extends StatefulWidget {
  const _UserDialog({this.initial});

  final Map<String, dynamic>? initial;

  @override
  State<_UserDialog> createState() => _UserDialogState();
}

class _UserDialogState extends State<_UserDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _usernameController;
  late final TextEditingController _firstNameController;
  late final TextEditingController _lastNameController;
  late final TextEditingController _emailController;
  late final TextEditingController _passwordController;
  late final TextEditingController _confirmPasswordController;
  String _role = 'staff';
  bool _saving = false;

  bool get _editing => widget.initial != null;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial ?? const {};
    _usernameController =
        TextEditingController(text: initial['username']?.toString() ?? '');
    _firstNameController =
        TextEditingController(text: initial['first_name']?.toString() ?? '');
    _lastNameController =
        TextEditingController(text: initial['last_name']?.toString() ?? '');
    _emailController =
        TextEditingController(text: initial['email']?.toString() ?? '');
    _passwordController = TextEditingController();
    _confirmPasswordController = TextEditingController();
    _role = initial['role']?.toString() ?? 'staff';
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _saving = true);

    final payload = {
      'email': _emailController.text.trim(),
      'first_name': _firstNameController.text.trim(),
      'last_name': _lastNameController.text.trim(),
      'role': _role,
      if (!_editing || _passwordController.text.trim().isNotEmpty)
        'password': _passwordController.text.trim(),
    };

    if (!_editing) {
      payload['username'] = _usernameController.text.trim();
      payload['confirm_password'] = _confirmPasswordController.text.trim();
    }

    try {
      final service = context.read<PharmacyApiService>();
      if (_editing) {
        await service.updateUser(
          (widget.initial!['id'] as num).toInt(),
          payload,
        );
      } else {
        await service.createUser(payload);
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
      title: Text(_editing ? 'Edit User' : 'Add User'),
      content: SizedBox(
        width: 520,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              children: [
                if (!_editing) ...[
                  TextFormField(
                    controller: _usernameController,
                    decoration: const InputDecoration(labelText: 'Username'),
                    validator: (value) => value == null || value.trim().length < 3
                        ? 'Minimum 3 characters'
                        : null,
                  ),
                  const SizedBox(height: 12),
                ],
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _firstNameController,
                        decoration: const InputDecoration(labelText: 'First Name'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _lastNameController,
                        decoration: const InputDecoration(labelText: 'Last Name'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _emailController,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _role,
                  decoration: const InputDecoration(labelText: 'Role'),
                  items: const [
                    DropdownMenuItem(value: 'admin', child: Text('Admin')),
                    DropdownMenuItem(value: 'staff', child: Text('Staff')),
                    DropdownMenuItem(value: 'viewer', child: Text('Viewer')),
                  ],
                  onChanged: (value) => setState(() => _role = value ?? 'staff'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _passwordController,
                  decoration: InputDecoration(
                    labelText: _editing ? 'New Password (optional)' : 'Password',
                  ),
                  validator: (value) {
                    if (!_editing && (value == null || value.trim().length < 6)) {
                      return 'Minimum 6 characters';
                    }
                    if (_editing &&
                        value != null &&
                        value.trim().isNotEmpty &&
                        value.trim().length < 6) {
                      return 'Minimum 6 characters';
                    }
                    return null;
                  },
                ),
                if (!_editing) ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _confirmPasswordController,
                    decoration:
                        const InputDecoration(labelText: 'Confirm Password'),
                    validator: (value) => value != _passwordController.text
                        ? 'Passwords do not match'
                        : null,
                  ),
                ],
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
