import 'package:flutter/material.dart';

class PaginationBar extends StatelessWidget {
  const PaginationBar({
    super.key,
    required this.page,
    required this.count,
    required this.pageSize,
    required this.onChanged,
  });

  final int page;
  final int count;
  final int pageSize;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final totalPages = count == 0 ? 1 : ((count - 1) ~/ pageSize) + 1;

    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Text('Page $page of $totalPages'),
        const SizedBox(width: 12),
        OutlinedButton(
          onPressed: page > 1 ? () => onChanged(page - 1) : null,
          child: const Text('Previous'),
        ),
        const SizedBox(width: 8),
        FilledButton.tonal(
          onPressed: page < totalPages ? () => onChanged(page + 1) : null,
          child: const Text('Next'),
        ),
      ],
    );
  }
}
