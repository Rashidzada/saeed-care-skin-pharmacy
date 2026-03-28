import 'dart:async';

import 'package:flutter/material.dart';

class DebouncedSearchField extends StatefulWidget {
  const DebouncedSearchField({
    super.key,
    required this.hintText,
    required this.onChanged,
    this.initialValue = '',
  });

  final String hintText;
  final String initialValue;
  final ValueChanged<String> onChanged;

  @override
  State<DebouncedSearchField> createState() => _DebouncedSearchFieldState();
}

class _DebouncedSearchFieldState extends State<DebouncedSearchField> {
  late final TextEditingController _controller;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      decoration: InputDecoration(
        hintText: widget.hintText,
        prefixIcon: const Icon(Icons.search_rounded),
      ),
      onChanged: (value) {
        _debounce?.cancel();
        _debounce = Timer(
          const Duration(milliseconds: 350),
          () => widget.onChanged(value.trim()),
        );
      },
    );
  }
}
