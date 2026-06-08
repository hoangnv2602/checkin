/// I-403 — REST client to .NET core-api /v1/checkin/{scan,manual,undo}.
/// I-801 — Thêm gRPC path qua CheckInGrpcClient khi GrpcConfig.useGrpc = true.
///         Build: `flutter build apk --dart-define=USE_GRPC=true`.
library;

import 'package:dio/dio.dart';
import 'package:grpc/grpc.dart';
import '../../../../core/network/grpc/checkin_grpc_client.dart';
import '../../../../core/network/grpc/grpc_config.dart';
import '../../domain/entities/check_in_outcome.dart';
import '../../domain/entities/scanned_ticket.dart';

class CheckInRemoteDataSource {
  final Dio _dio;
  final CheckInGrpcClient? _grpc;
  CheckInRemoteDataSource(this._dio, {CheckInGrpcClient? grpc}) : _grpc = grpc;

  /// Hot path: gRPC nếu bật, fallback REST nếu lỗi.
  Future<CheckInOutcome> scan({
    required ScannedTicket ticket,
    required String gateId,
    required String staffUserId,
    required String organizationId,
  }) async {
    if (GrpcConfig.useGrpc && _grpc != null) {
      try {
        return await _grpc.scan(
          ticket: ticket,
          gateId: gateId,
          staffUserId: staffUserId,
          organizationId: organizationId,
        );
      } on GrpcError catch (e) {
        // RpcException UNIMPLEMENTED = method chưa sẵn sàng ở BFF,
        // hoặc UNAVAILABLE = BFF gRPC down. Fallback REST.
        if (e.code == StatusCode.unimplemented || e.code == StatusCode.unavailable) {
          return _restScan(ticket, gateId, staffUserId, organizationId);
        }
        rethrow;
      }
    }
    return _restScan(ticket, gateId, staffUserId, organizationId);
  }

  Future<CheckInOutcome> manual({
    required String attendeeEmail,
    required String eventId,
    required String gateId,
    required String staffUserId,
    required String organizationId,
  }) async {
    // Manual lookup tạm thời chỉ qua REST (chưa migrate sang gRPC ở I-801).
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/checkin/manual",
      data: {
        "organizationId": organizationId,
        "eventId": eventId,
        "gateId": gateId,
        "staffUserId": staffUserId,
        "attendeeEmail": attendeeEmail,
      },
    );
    return _toOutcome(res.data!);
  }

  Future<CheckInOutcome> _restScan(
    ScannedTicket ticket,
    String gateId,
    String staffUserId,
    String organizationId,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      "/v1/checkin/scan",
      data: {
        "organizationId": organizationId,
        "eventId": ticket.eventId.toString(),
        "gateId": gateId,
        "staffUserId": staffUserId,
        "jti": ticket.jti.toString(),
        "registrationId": ticket.registrationId.toString(),
        "signature": ticket.signature,
      },
    );
    return _toOutcome(res.data!);
  }

  CheckInOutcome _toOutcome(Map<String, dynamic> data) {
    final status = switch (data["status"] as String) {
      "Success" => CheckInStatus.success,
      "Duplicate" => CheckInStatus.duplicate,
      _ => CheckInStatus.rejected,
    };
    return CheckInOutcome(
      status: status,
      attendeeName: data["attendee_name"] as String?,
      rejectReason: data["reject_reason"] as String?,
      scannedAt: DateTime.now().toUtc(),
    );
  }
}
