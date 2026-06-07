///
/// apps/mobile/lib/core/observability/sentry_init.dart
/// 
/// I-603 — Sentry init cho Flutter. Wrap sentry_flutter (đã có trong pubspec).
///
library;

import 'package:sentry_flutter/sentry_flutter.dart';

class SentryInit {
  static Future<void> start() async {
    final dsn = const String.fromEnvironment('SENTRY_DSN');
    if (dsn.isEmpty) return;
    await SentryFlutter.init(
      (options) {
        options.dsn = dsn;
        options.tracesSampleRate = 0.1;
        options.environment = const String.fromEnvironment('APP_ENV', defaultValue: 'dev');
      },
      appRunner: () {},
    );
  }
}
