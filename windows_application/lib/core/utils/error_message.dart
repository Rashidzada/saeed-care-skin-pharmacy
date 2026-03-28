import 'package:dio/dio.dart';

String friendlyErrorMessage(
  Object error, {
  String fallback = 'Something went wrong.',
}) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      for (final key in ['error', 'detail']) {
        final value = data[key];
        if (value != null && value.toString().trim().isNotEmpty) {
          return value.toString();
        }
      }

      final nonFieldErrors = data['non_field_errors'];
      if (nonFieldErrors is List && nonFieldErrors.isNotEmpty) {
        return nonFieldErrors.first.toString();
      }
    }

    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return 'Request failed. Check that the Django backend is running at http://127.0.0.1:8000.';
    }
  }

  return fallback;
}
