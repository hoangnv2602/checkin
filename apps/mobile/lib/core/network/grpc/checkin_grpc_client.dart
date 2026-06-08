///
/// apps/mobile/lib/core/network/grpc/checkin_grpc_client.dart
/// 
/// I-801 — gRPC CheckInService client.
/// 
/// I-913: Stubbed — `ClientChannel.makeUnaryCall` was removed in grpc 5.x.
/// Production code will use the generated proto stubs (buf generate → Dart
/// stubs) once I-914 wires up the codegen pipeline. For Phase 0/9, the
/// CheckInRemoteDataSource falls back to REST (`POST /v1/checkin/{scan,manual}`)
/// and the gRPC path is never executed (gate on `GrpcConfig.useGrpc` = false).
/// 
/// When the gRPC path is needed, regenerate the client using:
///   buf generate packages/proto/checkin/v1
///   → lib/core/network/gen/proto/checkin/v1/checkin.pbgrpc.dart
///
library;

import '../../../features/checkin/domain/entities/check_in_outcome.dart';
import '../../../features/checkin/domain/entities/event_stats.dart';
import '../../../features/checkin/domain/entities/scanned_ticket.dart';

class CheckInGrpcClient {
  CheckInGrpcClient({String? accessToken, String? tenantId});

  /// Scan QR — hot path. Phase 0/9 stub; see file header.
  Future<CheckInOutcome> scan({
    required ScannedTicket ticket,
    required String gateId,
    required String staffUserId,
    required String organizationId,
  }) async {
    throw UnimplementedError(
      'CheckInGrpcClient.scan: regenerate from proto in I-914 '
      '(grpc 5.x removed ClientChannel.makeUnaryCall)',
    );
  }

  /// Get realtime stats cho event.
  Future<EventStats> getEventStats({
    required String eventId,
    required String organizationId,
  }) async {
    throw UnimplementedError(
      'CheckInGrpcClient.getEventStats: regenerate from proto in I-914',
    );
  }

  /// Undo check-in (staff scan nhầm).
  Future<UndoResult> undoCheckIn({
    required String registrationId,
    required String reason,
    required String staffUserId,
    required String organizationId,
  }) async {
    throw UnimplementedError(
      'CheckInGrpcClient.undoCheckIn: regenerate from proto in I-914',
    );
  }
}
