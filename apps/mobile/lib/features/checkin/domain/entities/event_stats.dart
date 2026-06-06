/**
 * lib/features/checkin/domain/entities/event_stats.dart
 *
 * I-801: domain entity cho realtime stats từ gRPC GetEventStats.
 */
class EventStats {
  final String eventId;
  final int totalRegistered;
  final int totalCheckedIn;
  final int totalPending;

  const EventStats({
    required this.eventId,
    required this.totalRegistered,
    required this.totalCheckedIn,
    required this.totalPending,
  });
}

class UndoResult {
  final bool ok;
  final String message;
  const UndoResult({required this.ok, required this.message});
}
