/**
 * apps/mobile/test/core/network/grpc_config_test.dart
 *
 * I-801: unit test cho GrpcConfig.
 * - useGrpc flag đọc từ build-time --dart-define
 * - host default là localhost:50052
 * - TLS bật khi host không phải localhost/127.*
 */
import 'package:flutter_test/flutter_test.dart';
import 'package:saas_checkin_mobile/core/network/grpc/grpc_config.dart';

void main() {
  group('GrpcConfig', () {
    test('useGrpc default false', () {
      // defaultValue trong const expression — không thể override runtime
      expect(GrpcConfig.useGrpc, isFalse);
    });

    test('host default là localhost:50052', () {
      expect(GrpcConfig.host, equals('localhost:50052'));
    });

    test('channel lazy-init', () {
      // First access — tạo mới
      final c1 = GrpcConfig.channel;
      // Second access — same instance
      final c2 = GrpcConfig.channel;
      expect(identical(c1, c2), isTrue);
    });

    test('channel credentials insecure cho localhost', () {
      final ch = GrpcConfig.channel;
      expect(ch.options.credentials.isSecure, isFalse);
    });
  });
}
