import 'package:flutter/widgets.dart';

import 'app.dart';
import 'core/network/api_client.dart';
import 'features/auth/session_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final apiClient = ApiClient();
  await apiClient.initialize();

  final sessionController = SessionController(apiClient);
  apiClient.onUnauthorized = sessionController.forceLogout;
  await sessionController.bootstrap();

  runApp(
    SaeedPharmacyApp(
      apiClient: apiClient,
      sessionController: sessionController,
    ),
  );
}
