import 'package:open_filex/open_filex.dart';

import '../models/paginated_response.dart';
import '../network/api_client.dart';

class PharmacyApiService {
  PharmacyApiService(this._client);

  final ApiClient _client;

  Future<Map<String, dynamic>> getMe() async {
    final response = await _client.get<Map<String, dynamic>>('/auth/me/');
    return Map<String, dynamic>.from(response.data ?? const {});
  }

  Future<Map<String, dynamic>> getDashboardStats() async =>
      _map(await _client.get<Map<String, dynamic>>('/reports/dashboard/'));

  Future<Map<String, dynamic>> getDailySales(String date) async =>
      _map(await _client.get<Map<String, dynamic>>(
        '/reports/daily-sales/',
        queryParameters: {'date': date},
      ));

  Future<Map<String, dynamic>> getMonthlySales(int year, int month) async =>
      _map(await _client.get<Map<String, dynamic>>(
        '/reports/monthly-sales/',
        queryParameters: {'year': year, 'month': month},
      ));

  Future<Map<String, dynamic>> getStockReport() async =>
      _map(await _client.get<Map<String, dynamic>>('/reports/stock/'));

  Future<Map<String, dynamic>> getExpiryReport(int days) async =>
      _map(await _client.get<Map<String, dynamic>>(
        '/reports/expiry/',
        queryParameters: {'days': days},
      ));

  Future<PaginatedResponse<Map<String, dynamic>>> getMedicines({
    int page = 1,
    int pageSize = 20,
    String? search,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/medicines/',
      queryParameters: {
        'page': page,
        'page_size': pageSize,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
    return PaginatedResponse.fromJson(_map(response), (item) => item);
  }

  Future<Map<String, dynamic>> createMedicine(Map<String, dynamic> data) async =>
      _map(await _client.post<Map<String, dynamic>>('/medicines/', data: data));

  Future<Map<String, dynamic>> updateMedicine(int id, Map<String, dynamic> data) async =>
      _map(await _client.patch<Map<String, dynamic>>('/medicines/$id/', data: data));

  Future<void> deleteMedicine(int id) async {
    await _client.delete('/medicines/$id/');
  }

  Future<PaginatedResponse<Map<String, dynamic>>> getCustomers({
    int page = 1,
    int pageSize = 20,
    String? search,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/customers/',
      queryParameters: {
        'page': page,
        'page_size': pageSize,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
    return PaginatedResponse.fromJson(_map(response), (item) => item);
  }

  Future<Map<String, dynamic>> createCustomer(Map<String, dynamic> data) async =>
      _map(await _client.post<Map<String, dynamic>>('/customers/', data: data));

  Future<Map<String, dynamic>> updateCustomer(int id, Map<String, dynamic> data) async =>
      _map(await _client.patch<Map<String, dynamic>>('/customers/$id/', data: data));

  Future<void> deleteCustomer(int id) async {
    await _client.delete('/customers/$id/');
  }

  Future<PaginatedResponse<Map<String, dynamic>>> getSuppliers({
    int page = 1,
    int pageSize = 20,
    String? search,
    bool activeOnly = false,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/suppliers/',
      queryParameters: {
        'page': page,
        'page_size': pageSize,
        if (search != null && search.isNotEmpty) 'search': search,
        if (activeOnly) 'active': 'true',
      },
    );
    return PaginatedResponse.fromJson(_map(response), (item) => item);
  }

  Future<Map<String, dynamic>> createSupplier(Map<String, dynamic> data) async =>
      _map(await _client.post<Map<String, dynamic>>('/suppliers/', data: data));

  Future<Map<String, dynamic>> updateSupplier(int id, Map<String, dynamic> data) async =>
      _map(await _client.patch<Map<String, dynamic>>('/suppliers/$id/', data: data));

  Future<void> deleteSupplier(int id) async {
    await _client.delete('/suppliers/$id/');
  }

  Future<PaginatedResponse<Map<String, dynamic>>> getSales({
    int page = 1,
    String? search,
    String? dateFrom,
    String? dateTo,
    String? paymentStatus,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/sales/',
      queryParameters: {
        'page': page,
        if (search != null && search.isNotEmpty) 'search': search,
        if (dateFrom != null && dateFrom.isNotEmpty) 'date_from': dateFrom,
        if (dateTo != null && dateTo.isNotEmpty) 'date_to': dateTo,
        if (paymentStatus != null && paymentStatus.isNotEmpty) 'payment_status': paymentStatus,
      },
    );
    return PaginatedResponse.fromJson(_map(response), (item) => item);
  }

  Future<Map<String, dynamic>> createSale(Map<String, dynamic> data) async =>
      _map(await _client.post<Map<String, dynamic>>('/sales/', data: data));

  Future<void> voidSale(int id) async {
    await _client.post('/sales/$id/void/');
  }

  Future<Map<String, dynamic>> createSaleReturn(
    int id,
    Map<String, dynamic> data,
  ) async => _map(await _client.post<Map<String, dynamic>>('/sales/$id/returns/', data: data));

  Future<Map<String, dynamic>> createSalePayment(
    int id,
    Map<String, dynamic> data,
  ) async => _map(await _client.post<Map<String, dynamic>>('/sales/$id/payments/', data: data));

  Future<PaginatedResponse<Map<String, dynamic>>> getPurchases({
    int page = 1,
    String? search,
    String? paymentStatus,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/purchases/',
      queryParameters: {
        'page': page,
        if (search != null && search.isNotEmpty) 'search': search,
        if (paymentStatus != null && paymentStatus.isNotEmpty) 'payment_status': paymentStatus,
      },
    );
    return PaginatedResponse.fromJson(_map(response), (item) => item);
  }

  Future<Map<String, dynamic>> createPurchase(Map<String, dynamic> data) async =>
      _map(await _client.post<Map<String, dynamic>>('/purchases/', data: data));

  Future<Map<String, dynamic>> createPurchaseReturn(
    int id,
    Map<String, dynamic> data,
  ) async => _map(await _client.post<Map<String, dynamic>>('/purchases/$id/returns/', data: data));

  Future<Map<String, dynamic>> createPurchasePayment(
    int id,
    Map<String, dynamic> data,
  ) async => _map(await _client.post<Map<String, dynamic>>('/purchases/$id/payments/', data: data));

  Future<List<Map<String, dynamic>>> getUsers() async {
    final response = await _client.get<dynamic>('/auth/users/');
    final data = response.data;
    if (data is List) {
      return data.cast<Map<String, dynamic>>();
    }
    if (data is Map<String, dynamic>) {
      final results = data['results'] as List<dynamic>? ?? const [];
      return results.cast<Map<String, dynamic>>();
    }
    return const [];
  }

  Future<Map<String, dynamic>> createUser(Map<String, dynamic> data) async =>
      _map(await _client.post<Map<String, dynamic>>('/auth/users/', data: data));

  Future<Map<String, dynamic>> updateUser(int id, Map<String, dynamic> data) async =>
      _map(await _client.patch<Map<String, dynamic>>('/auth/users/$id/', data: data));

  Future<void> deactivateUser(int id) async {
    await _client.post('/auth/users/$id/deactivate/');
  }

  Future<void> activateUser(int id) async {
    await _client.post('/auth/users/$id/activate/');
  }

  Future<void> openSaleInvoice(int id) async {
    final file = await _client.downloadFile(
      path: '/sales/$id/invoice/',
      suggestedName: 'sale-invoice-$id.pdf',
    );
    await OpenFilex.open(file.path);
  }

  Future<void> openSaleReceipt(int id) async {
    final file = await _client.downloadFile(
      path: '/sales/$id/receipt/',
      suggestedName: 'sale-receipt-$id.html',
    );
    await OpenFilex.open(file.path);
  }

  Future<void> openPurchaseInvoice(int id) async {
    final file = await _client.downloadFile(
      path: '/purchases/$id/invoice/',
      suggestedName: 'purchase-order-$id.pdf',
    );
    await OpenFilex.open(file.path);
  }

  Future<void> openPurchaseReceipt(int id) async {
    final file = await _client.downloadFile(
      path: '/purchases/$id/receipt/',
      suggestedName: 'purchase-slip-$id.html',
    );
    await OpenFilex.open(file.path);
  }

  Future<void> openDailySalesCsv(String date) async {
    final file = await _client.downloadFile(
      path: '/reports/daily-sales/export/?date=$date',
      suggestedName: 'daily-sales-$date.csv',
    );
    await OpenFilex.open(file.path);
  }

  Future<void> openStockCsv() async {
    final file = await _client.downloadFile(
      path: '/reports/stock/export/',
      suggestedName: 'stock-report.csv',
    );
    await OpenFilex.open(file.path);
  }

  Map<String, dynamic> _map(dynamic response) {
    if (response is Map<String, dynamic>) {
      return response;
    }
    return Map<String, dynamic>.from(response.data ?? const {});
  }
}
