/**
 * lib/features/checkin/data/datasources/checkin_remote_datasource.dart
 *
 * I-403 — REST client to .NET core-api /v1/checkin/{scan,manual,undo}.
 */
import 'package:dio/dio.dart';
import '../../domain/entities/check_in_outcome.dart';
import '../../domain/entities/scanned_ticket.dart';

class CheckInRemoteDataSource {
  final Dio _dio;
  CheckInRemoteDataSource(this._dio);

  Future<CheckInOutcome> scan({
    required ScannedTicket ticket,
    required String gateId,
    required String staffUserId,
    required String organizationId,
  }) async {
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

  Future<CheckInOutcome> manual({
    required String attendeeEmail,
    required String eventId,
    required String gateId,
    required String staffUserId,
    required String organizationId,
  }) async {
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
