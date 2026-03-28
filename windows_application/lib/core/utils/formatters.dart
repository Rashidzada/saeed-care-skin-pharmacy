import 'package:intl/intl.dart';

final _currencyFormat = NumberFormat.currency(
  locale: 'en_PK',
  symbol: 'PKR ',
  decimalDigits: 2,
);

num? parseNum(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value;
  }
  if (value is String) {
    return num.tryParse(value);
  }
  return null;
}

double asDouble(dynamic value, {double fallback = 0}) {
  return parseNum(value)?.toDouble() ?? fallback;
}

int asInt(dynamic value, {int fallback = 0}) {
  return parseNum(value)?.toInt() ?? fallback;
}

String formatCurrency(dynamic value) => _currencyFormat.format(parseNum(value) ?? 0);

String formatDate(dynamic value, {String pattern = 'dd MMM yyyy'}) {
  if (value == null || value.toString().isEmpty) {
    return '-';
  }

  try {
    return DateFormat(pattern)
        .format(DateTime.parse(value.toString()).toLocal());
  } catch (_) {
    return value.toString();
  }
}
