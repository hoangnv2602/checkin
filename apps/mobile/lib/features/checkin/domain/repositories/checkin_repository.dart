/// I-403 — CheckInRepository abstract interface.
library;

import '../../../../core/types/guid.dart';
import '../entities/check_in_outcome.dart';
import '../entities/scanned_ticket.dart';

abstract class CheckInRepository {
  /// Submit scan online. Throws nếu mất mạng — caller catch + persist offline.
  Future<CheckInOutcome> submitScan({
    required ScannedTicket ticket,
    required Guid gateId,
    required Guid staffUserId,
  });

  /// Manual lookup theo email — fallback khi QR hỏng.
  Future<CheckInOutcome> manualCheckIn({
    required String attendeeEmail,
    required Guid eventId,
    required Guid gateId,
    required Guid staffUserId,
    required Guid organizationId,
  });
}
