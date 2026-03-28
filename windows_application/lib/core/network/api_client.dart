import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/api_config.dart';

typedef UnauthorizedCallback = Future<void> Function();

class ApiClient {
  ApiClient()
      : _dio = Dio(
          BaseOptions(
            baseUrl: ApiConfig.baseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 30),
            sendTimeout: const Duration(seconds: 30),
            headers: const {'Content-Type': 'application/json'},
          ),
        ),
        _refreshDio = Dio(
          BaseOptions(
            baseUrl: ApiConfig.baseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 30),
            sendTimeout: const Duration(seconds: 30),
            headers: const {'Content-Type': 'application/json'},
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_accessToken != null && _accessToken!.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $_accessToken';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final original = error.requestOptions;
          final isUnauthorized = error.response?.statusCode == 401;
          final isRefreshCall = original.path.contains('/auth/refresh/');
          final isLoginCall = original.path.contains('/auth/login/');

          if (!isUnauthorized ||
              isRefreshCall ||
              isLoginCall ||
              original.extra['retried'] == true ||
              !hasRefreshToken) {
            handler.next(error);
            return;
          }

          try {
            await refreshAccessToken();
            original.extra['retried'] = true;
            final cloned = await _dio.fetch(original);
            handler.resolve(cloned);
          } catch (_) {
            await clearTokens();
            if (onUnauthorized != null) {
              await onUnauthorized!.call();
            }
            handler.next(error);
          }
        },
      ),
    );
  }

  static const _accessTokenKey = 'windows_app_access_token';
  static const _refreshTokenKey = 'windows_app_refresh_token';

  final Dio _dio;
  final Dio _refreshDio;
  SharedPreferences? _preferences;
  String? _accessToken;
  String? _refreshToken;
  Future<void>? _refreshing;

  UnauthorizedCallback? onUnauthorized;

  bool get hasRefreshToken => _refreshToken != null && _refreshToken!.isNotEmpty;
  String? get accessToken => _accessToken;

  Future<void> initialize() async {
    _preferences = await SharedPreferences.getInstance();
    _accessToken = _preferences?.getString(_accessTokenKey);
    _refreshToken = _preferences?.getString(_refreshTokenKey);
  }

  Future<void> setTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    await _preferences?.setString(_accessTokenKey, accessToken);
    await _preferences?.setString(_refreshTokenKey, refreshToken);
  }

  Future<void> updateAccessToken(String accessToken) async {
    _accessToken = accessToken;
    await _preferences?.setString(_accessTokenKey, accessToken);
  }

  Future<void> clearTokens() async {
    _accessToken = null;
    _refreshToken = null;
    await _preferences?.remove(_accessTokenKey);
    await _preferences?.remove(_refreshTokenKey);
  }

  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/login/',
      data: {'username': username, 'password': password},
    );

    final data = Map<String, dynamic>.from(response.data ?? const {});
    await setTokens(
      accessToken: data['access']?.toString() ?? '',
      refreshToken: data['refresh']?.toString() ?? '',
    );
    return data;
  }

  Future<void> logout() async {
    final refresh = _refreshToken;
    if (refresh != null && refresh.isNotEmpty) {
      try {
        await _dio.post('/auth/logout/', data: {'refresh': refresh});
      } on DioException {
        // Ignore logout cleanup failures.
      }
    }
    await clearTokens();
  }

  Future<void> refreshAccessToken() {
    if (_refreshing != null) {
      return _refreshing!;
    }

    final refresh = _refreshToken;
    if (refresh == null || refresh.isEmpty) {
      throw StateError('No refresh token available');
    }

    _refreshing = _refreshDio
        .post<Map<String, dynamic>>(
          '/auth/refresh/',
          data: {'refresh': refresh},
        )
        .then((response) async {
          final data = Map<String, dynamic>.from(response.data ?? const {});
          final newAccess = data['access']?.toString() ?? '';
          final newRefresh = data['refresh']?.toString();

          await updateAccessToken(newAccess);
          if (newRefresh != null && newRefresh.isNotEmpty) {
            _refreshToken = newRefresh;
            await _preferences?.setString(_refreshTokenKey, newRefresh);
          }
        })
        .whenComplete(() => _refreshing = null);

    return _refreshing!;
  }

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) {
    return _dio.get<T>(path, queryParameters: queryParameters);
  }

  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
  }) {
    return _dio.post<T>(
      path,
      data: data,
      queryParameters: queryParameters,
    );
  }

  Future<Response<T>> patch<T>(String path, {Object? data}) {
    return _dio.patch<T>(path, data: data);
  }

  Future<Response<T>> delete<T>(String path) {
    return _dio.delete<T>(path);
  }

  Future<File> downloadFile({
    required String path,
    required String suggestedName,
  }) async {
    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}\\$suggestedName');

    await _dio.download(
      path,
      file.path,
      options: Options(responseType: ResponseType.bytes),
    );

    return file;
  }
}
