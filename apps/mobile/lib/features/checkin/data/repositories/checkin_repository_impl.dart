/// I-403 / I-913 — CheckInRepository implementation.
///
/// Phase 0/9: stub — no offline queue (drift codegen deferred to I-914 because
/// the dart_style 3.1.x in the local pub cache is incompatible with analyzer
/// 7.x required by drift_dev 2.28). All calls delegate to the remote
/// datasource. Once I-914 wires drift codegen, the optimistic offline-queue
/// path will be restored (see git history for the full implementation).
library;

import 'package:dio/dio.dart';
import '../../../../core/types/guid.dart';
import '../../domain/entities/check_in_outcome.dart';
import '../../domain/entities/scanned_ticket.dart';
import '../../domain/repositories/checkin_repository.dart';
import '../datasources/checkin_remote_datasource.dart';

class CheckInRepositoryImpl implements CheckInRepository {
  final CheckInRemoteDataSource _remote;
  CheckInRepositoryImpl(this._remote);

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
    } on DioException {
      // TODO(I-914): persist to drift pending_checkin and return optimistic Success.
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
