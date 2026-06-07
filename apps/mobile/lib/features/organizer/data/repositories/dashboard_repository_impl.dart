/**
 * lib/features/organizer/data/repositories/dashboard_repository_impl.dart
 *
 * I-907 — Repository implementation: read-through cache.
 * - listEvents(tenantId): trả cache ngay (stale-OK), fire refresh async
 * - refresh(tenantId): pull remote, upsert cache
 *
 * Remote datasource được mock ở Phase 9 (Phase 10 wire gRPC EventService).
 */
import '../../domain/entities/cached_event.dart';
import '../datasources/event_dashboard_dao.dart';

abstract class DashboardRemoteDataSource {
  Future<List<CachedEvent>> fetchEvents(String tenantId);
}

class FakeDashboardRemoteDataSource implements DashboardRemoteDataSource {
  @override
  Future<List<CachedEvent>> fetchEvents(String tenantId) async {
    // Simulate network delay
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return [
      CachedEvent(
        id: 'evt_1',
        tenantId: tenantId,
        name: 'SaasConf 2026',
        slug: 'saasconf-2026',
        status: 'published',
        startsAt: DateTime.utc(2026, 6, 15, 9),
        endsAt: DateTime.utc(2026, 6, 15, 18),
        totalRegistered: 120,
        totalCheckedIn: 87,
        cachedAt: DateTime.now(),
      ),
    ];
  }
}

class DashboardRepository {
  DashboardRepository({required this.dao, required this.remote});

  final EventDashboardDb dao;
  final DashboardRemoteDataSource remote;

  /// Read-through cache: trả cache ngay, có thể stale.
  Future<List<CachedEvent>> listCached(String tenantId) {
    return dao.listByTenant(tenantId);
  }

  /// Refresh từ remote → upsert cache.
  Future<List<CachedEvent>> refresh(String tenantId) async {
    final fresh = await remote.fetchEvents(tenantId);
    final companions = fresh.map((e) => CachedEventsCompanion.insert(
          id: e.id,
          tenantId: e.tenantId,
          name: e.name,
          slug: e.slug,
          status: e.status,
          startsAt: e.startsAt,
          endsAt: Value(e.endsAt),
          totalRegistered: Value(e.totalRegistered),
          totalCheckedIn: Value(e.totalCheckedIn),
          cachedAt: e.cachedAt,
        )).toList();
    await dao.upsertAll(companions);
    return fresh;
  }

  /// Sweep stale rows > 24h.
  Future<int> sweepStale() {
    return dao.deleteStale(olderThan: DateTime.now().subtract(const Duration(hours: 24)));
  }
}
