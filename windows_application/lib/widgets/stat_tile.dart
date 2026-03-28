import 'package:flutter/material.dart';

import 'app_panel.dart';

class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    required this.accent,
    this.subtitle,
    this.onTap,
  });

  final String title;
  final String value;
  final IconData icon;
  final Color accent;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: AppPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: accent),
                ),
                const Spacer(),
                Icon(Icons.trending_up_rounded, color: accent),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF64748B),
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(
                subtitle!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF94A3B8),
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
