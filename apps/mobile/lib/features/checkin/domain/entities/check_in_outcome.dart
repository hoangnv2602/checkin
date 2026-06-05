/**
 * lib/features/checkin/domain/entities/check_in_outcome.dart
 *
 * I-403 — CheckInOutcome domain entity. Result of a scan: Success / Rejected / Duplicate.
 */
import 'package:equatable/equatable.dart';

enum CheckInStatus { success, rejected, duplicate }

class CheckInOutcome extends Equatable {
  final CheckInStatus status;
  final String? attendeeName;
  final String? rejectReason;
  final DateTime scannedAt;

  const CheckInOutcome({
    required this.status,
    this.attendeeName,
    this.rejectReason,
    required this.scannedAt,
  });

  bool get isSuccess => status == CheckInStatus.success;
  bool get isDuplicate => status == CheckInStatus.duplicate;

  @override
  List<Object?> get props => [status, attendeeName, rejectReason, scannedAt];
}
