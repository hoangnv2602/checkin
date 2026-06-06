/**
 * lib/core/network/grpc/grpc_config.dart
 *
 * I-801: gRPC channel config + feature flag cho mobile.
 * Build-time: `flutter build apk --dart-define=USE_GRPC=true --dart-define=GRPC_HOST=api.saas-checkin.com:50052`
 */
import 'package:grpc/grpc.dart';

class GrpcConfig {
  /// Build-time flag. Khi false, mobile dùng REST (Dio) — fallback.
  static const bool useGrpc = bool.fromEnvironment('USE_GRPC', defaultValue: false);

  /// gRPC host:port. Mặc định localhost cho dev.
  static const String host = String.fromEnvironment(
    'GRPC_HOST',
    defaultValue: 'localhost:50052',
  );

  /// Tạo ClientChannel singleton (lazy). TLS bật khi host không phải localhost.
  static ClientChannel? _channel;

  static ClientChannel get channel {
    return _channel ??= ClientChannel(
      host.split(':').first,
      port: int.parse(host.split(':').last),
      options: ChannelOptions(
        credentials: host.startsWith('localhost') || host.startsWith('127.')
            ? const ChannelCredentials.insecure()
            : const ChannelCredentials.secure(),
        idleTimeout: const Duration(minutes: 5),
        connectionTimeout: const Duration(seconds: 5),
      ),
    );
  }

  static Future<void> shutdown() async {
    await _channel?.shutdown();
    _channel = null;
  }
}
