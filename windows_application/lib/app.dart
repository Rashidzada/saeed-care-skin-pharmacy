import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/network/api_client.dart';
import 'core/services/pharmacy_api_service.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/session_controller.dart';
import 'features/shell/app_shell_screen.dart';

class SaeedPharmacyApp extends StatelessWidget {
  const SaeedPharmacyApp({
    super.key,
    required this.apiClient,
    required this.sessionController,
  });

  final ApiClient apiClient;
  final SessionController sessionController;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        Provider<PharmacyApiService>(
          create: (_) => PharmacyApiService(apiClient),
        ),
        ChangeNotifierProvider<SessionController>.value(
          value: sessionController,
        ),
      ],
      child: MaterialApp(
        title: 'Saeed Pharmacy Windows',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        home: const _AppRoot(),
      ),
    );
  }
}

class _AppRoot extends StatelessWidget {
  const _AppRoot();

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionController>(
      builder: (context, session, _) {
        if (session.isBootstrapping) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (!session.isAuthenticated) {
          return const LoginScreen();
        }

        return const AppShellScreen();
      },
    );
  }
}
