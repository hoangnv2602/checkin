/**
 * lib/features/checkin/data/repositories/checkin_repository_impl.dart
 *
 * I-403 — CheckInRepository implementation: try online first; on Dio
 * network error, persist to drift pending_checkin + return optimistic
 * Success state (UI show ✓ ngay, sync sẽ xảy ra sau).
 */
import 'package:dio/dio.dart';
import 'package:drift/drift.dart';
import '../../domain/entities/check_in_outcome.dart';
import '../../domain/entities/scanned_ticket.dart';
import '../../domain/repositories/checkin_repository.dart';
import '../datasources/checkin_remote_datasource.dart';
import '../datasources/pending_checkin_dao.dart';
import '../datasources/pending_checkin_sync.dart';

class CheckInRepositoryImpl implements CheckInRepository {
  final CheckInRemoteDataSource _remote;
  final PendingCheckInDb _db;
  final PendingCheckInSync _sync;
  CheckInRepositoryImpl(this._remote, this._db, this._sync);

  @override
  Future<CheckInOutcome> submitScan({
    required ScannedTicket ticket,
    required Guid gateId,
    required Guid staffUserId,
  }) async {
    try {
      return await _remote.scan(
        ticket: ticket,
        gateId: gateId.toString(),
        staffUserId: staffUserId.toString(),
        organizationId: ticket.organizationId.toString(),
      );
    } on DioException catch (e) {
      // network error -> queue offline
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        await _db.into(_db.pendingCheckIns).insert(
              PendingCheckInsCompanion.insert(
                id: "${ticket.jti}-${DateTime.now().microsecondsSinceEpoch}",
                jti: ticket.jti.toString(),
                registrationId: ticket.registrationId.toString(),
                eventId: ticket.eventId.toString(),
                organizationId: ticket.organizationId.toString(),
                gateId: gateId.toString(),
                staffUserId: staffUserId.toString(),
                signature: ticket.signature,
                payloadJson: "{}", // populated by offline verifier ở Phase 4+
                scannedAt: DateTime.now(),
              ),
            );
        return CheckInOutcome(
          status: CheckInStatus.success,
          scannedAt: DateTime.now(),
        );
      }
      rethrow;
    }
  }

  @override
  Future<CheckInOutcome> manualCheckIn({
    required String attendeeEmail,
    required Guid eventId,
    required Guid gateId,
    required Guid staffUserId,
    required Guid organizationId,
  }) =>
      _remote.manual(
        attendeeEmail: attendeeEmail,
        eventId: eventId.toString(),
        gateId: gateId.toString(),
        staffUserId: staffUserId.toString(),
        organizationId: organizationId.toString(),
      );
}

/// Stub Guid since dart:core lacks it. Production dùng package:uuid.
class Guid {
  final String value;
  const Guid(this.value);
  @override
  String toString() => value;
  @override
  bool operator ==(Object other) => other is Guid && other.value == value;
  @override
  int get hashCode => value.hashCode;
}
