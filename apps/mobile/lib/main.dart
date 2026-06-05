import 'package:flutter/material.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'app.dart';
import 'core/config/env.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (Env.sentryDsn.isNotEmpty) {
    await SentryFlutter.init(
      (options) => options.dsn = Env.sentryDsn,
      appRunner: () => runApp(const SaasCheckinApp()),
    );
  } else {
    runApp(const SaasCheckinApp());
  }
}
