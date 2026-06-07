/**
 * lib/features/organizer/domain/entities/dashboard_state.dart
 *
 * I-907 — Dashboard state cho OrganizerDashboardCubit.
 * Sealed-class (Dart 3) — exhaustive switch trong UI.
 */
import 'package:meta/meta.dart';
import 'cached_event.dart';

@immutable
sealed class DashboardState {
  const DashboardState();
}

class DashboardInitial extends DashboardState {
  const DashboardInitial();
}

class DashboardLoading extends DashboardState {
  const DashboardLoading();
}

class DashboardLoaded extends DashboardState {
  final List<CachedEvent> events;
  final bool fromCache;
  final DateTime fetchedAt;
  const DashboardLoaded({
    required this.events,
    required this.fromCache,
    required this.fetchedAt,
  });

  int get totalCheckedIn => events.fold(0, (sum, e) => sum + e.totalCheckedIn);
  int get totalRegistered => events.fold(0, (sum, e) => sum + e.totalRegistered);
  int get totalPending => totalRegistered - totalCheckedIn;
  /// Số events có data stale (>5 phút).
  int get staleCount => events.where((e) => e.isStale).length;
}

class DashboardError extends DashboardState {
  final String message;
  final List<CachedEvent> fallback;
  const DashboardError({required this.message, required this.fallback});
}
