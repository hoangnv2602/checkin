/**
 * lib/core/network/grpc/checkin_grpc_client.dart
 *
 * I-801: gRPC CheckInService client. Mirror của BFF gRPC server handlers.
 *
 * BFF gRPC server dùng JSON marshaller (xem grpc-core-client.ts) cho tới khi
 * core-api load proto descriptor đầy đủ. Nên client cũng encode/decode JSON.
 * Sau khi `buf generate` chạy sẽ có generated stubs ở
 * lib/core/network/gen/proto/checkin/v1/checkin.pbgrpc.dart — có thể swap in.
 */
import 'dart:convert';
import 'package:grpc/grpc.dart';
import '../grpc_config.dart';
import '../../features/checkin/domain/entities/check_in_outcome.dart';
import '../../features/checkin/domain/entities/scanned_ticket.dart';
import '../../features/checkin/domain/entities/event_stats.dart';

class CheckInGrpcClient {
  final CallOptions _baseCallOptions;

  CheckInGrpcClient({String? accessToken, String? tenantId})
      : _baseCallOptions = CallOptions(
          metadata: {
            if (accessToken != null) 'authorization': 'Bearer $accessToken',
            if (tenantId != null) 'x-tenant-id': tenantId,
          },
          timeout: const Duration(seconds: 5),
        );

  /// Scan QR — hot path. Trả về CheckInOutcome.
  Future<CheckInOutcome> scan({
    required ScannedTicket ticket,
    required String gateId,
    required String staffUserId,
    required String organizationId,
  }) async {
    final body = json.encode({
      'qr_payload': ticket.signature,
      'event_id': ticket.eventId.toString(),
      'gate_id': gateId,
      'staff_user_id': staffUserId,
      'organization_id': organizationId,
      'jti': ticket.jti.toString(),
      'registration_id': ticket.registrationId.toString(),
      'scanned_at': {
        'seconds': DateTime.now().toUtc().millisecondsSinceEpoch ~/ 1000,
        'nanos': 0,
      },
    });

    final response = await GrpcConfig.channel.makeUnaryCall(
      path: '/saascheckin.checkin.v1.CheckInService/Scan',
      request: body.codeUnits,
      options: _baseCallOptions,
    );

    final payload = jsonDecode(String.fromCharCodes(response)) as Map<String, dynamic>;
    final status = switch (payload['result'] as String? ?? '') {
      'CHECK_IN_RESULT_OK' => CheckInStatus.success,
      'CHECK_IN_RESULT_ALREADY_CHECKED_IN' => CheckInStatus.duplicate,
      _ => CheckInStatus.rejected,
    };
    return CheckInOutcome(
      status: status,
      attendeeName: (payload['attendee'] as Map?)?['full_name'] as String?,
      rejectReason: payload['ok'] == true ? null : payload['message'] as String?,
      scannedAt: DateTime.now().toUtc(),
    );
  }

  /// Get realtime stats cho event.
  Future<EventStats> getEventStats({
    required String eventId,
    required String organizationId,
  }) async {
    final body = json.encode({
      'event_id': eventId,
      'organization_id': organizationId,
    });
    final response = await GrpcConfig.channel.makeUnaryCall(
      path: '/saascheckin.checkin.v1.CheckInService/GetEventStats',
      request: body.codeUnits,
      options: _baseCallOptions,
    );
    final payload = jsonDecode(String.fromCharCodes(response)) as Map<String, dynamic>;
    return EventStats(
      eventId: eventId,
      totalRegistered: (payload['total_registered'] as num?)?.toInt() ?? 0,
      totalCheckedIn: (payload['total_checked_in'] as num?)?.toInt() ?? 0,
      totalPending: (payload['total_pending'] as num?)?.toInt() ?? 0,
    );
  }

  /// Undo check-in (staff scan nhầm).
  Future<UndoResult> undoCheckIn({
    required String registrationId,
    required String reason,
    required String staffUserId,
    required String organizationId,
  }) async {
    final body = json.encode({
      'registration_id': registrationId,
      'reason': reason,
      'staff_user_id': staffUserId,
      'organization_id': organizationId,
    });
    final response = await GrpcConfig.channel.makeUnaryCall(
      path: '/saascheckin.checkin.v1.CheckInService/UndoCheckIn',
      request: body.codeUnits,
      options: _baseCallOptions,
    );
    final payload = jsonDecode(String.fromCharCodes(response)) as Map<String, dynamic>;
    return UndoResult(
      ok: payload['ok'] == true,
      message: payload['message'] as String? ?? '',
    );
  }
}
