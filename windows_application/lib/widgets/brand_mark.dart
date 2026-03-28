import 'package:flutter/material.dart';

import '../core/branding/app_brand.dart';

enum BrandMarkVariant { compact, full }

class BrandMark extends StatelessWidget {
  const BrandMark({
    super.key,
    this.variant = BrandMarkVariant.compact,
    this.light = false,
  });

  final BrandMarkVariant variant;
  final bool light;

  @override
  Widget build(BuildContext context) {
    final foreground = light ? Colors.white : const Color(0xFF0F172A);
    final muted = light ? Colors.white70 : const Color(0xFF64748B);

    final icon = Container(
      width: 58,
      height: 58,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(
          colors: [Color(0xFF2563EB), Color(0xFF65A30D)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          const Icon(Icons.medication_rounded, color: Colors.white, size: 28),
          Positioned(
            top: 4,
            child: Container(
              width: 20,
              height: 20,
              decoration: const BoxDecoration(
                color: Color(0xFF15803D),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.add, color: Colors.white, size: 16),
            ),
          ),
        ],
      ),
    );

    if (variant == BrandMarkVariant.compact) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          icon,
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                AppBrand.shortName,
                style: TextStyle(
                  color: foreground,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                AppBrand.subtitle,
                style: TextStyle(color: muted, fontSize: 13),
              ),
            ],
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        icon,
        const SizedBox(height: 18),
        Text(
          AppBrand.shortName,
          style: TextStyle(
            color: foreground,
            fontSize: 38,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.6,
          ),
        ),
        Text(
          'Skin Care Pharmacy',
          style: TextStyle(
            color: foreground,
            fontSize: 22,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
