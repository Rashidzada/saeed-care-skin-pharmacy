import 'package:flutter/foundation.dart';

import '../../core/models/user_profile.dart';
import '../../core/network/api_client.dart';
import '../../core/services/pharmacy_api_service.dart';

class SessionController extends ChangeNotifier {
  SessionController(this._apiClient);

  final ApiClient _apiClient;

  bool _isBootstrapping = true;
  UserProfile? _user;

  bool get isBootstrapping => _isBootstrapping;
  bool get isAuthenticated => _user != null;
  UserProfile? get user => _user;

  Future<void> bootstrap() async {
    try {
      if (_apiClient.hasRefreshToken) {
        await _apiClient.refreshAccessToken();
        final me = await PharmacyApiService(_apiClient).getMe();
        _user = UserProfile.fromJson(me);
      }
    } catch (_) {
      await _apiClient.clearTokens();
      _user = null;
    } finally {
      _isBootstrapping = false;
      notifyListeners();
    }
  }

  Future<void> login({
    required String username,
    required String password,
  }) async {
    final data = await _apiClient.login(username: username, password: password);
    _user = UserProfile.fromJson(
      Map<String, dynamic>.from(data['user'] as Map),
    );
    notifyListeners();
  }

  Future<void> logout() async {
    await _apiClient.logout();
    _user = null;
    notifyListeners();
  }

  Future<void> forceLogout() async {
    await _apiClient.clearTokens();
    _user = null;
    notifyListeners();
  }
}
