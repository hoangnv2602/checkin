/**
 * lib/features/organizer/data/datasources/event_dashboard_dao.dart
 *
 * I-907 — Drift table + DAO cho cached event list + stats.
 *
 * Cache để organizer xem stats khi offline (vd tại sự kiện sóng yếu).
 * TTL 5 phút — stale-while-revalidate.
 */
import 'package:drift/drift.dart';

part 'event_dashboard_dao.g.dart';

class CachedEvents extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get name => text()();
  TextColumn get slug => text()();
  TextColumn get status => text()(); // 'draft' | 'published' | 'cancelled' | 'completed'
  DateTimeColumn get startsAt => dateTime()();
  DateTimeColumn get endsAt => dateTime().nullable()();
  IntColumn get totalRegistered => integer().withDefault(const Constant(0))();
  IntColumn get totalCheckedIn => integer().withDefault(const Constant(0))();
  DateTimeColumn get cachedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

class EventDashboardDb extends _$EventDashboardDb {
  EventDashboardDb(super.executor);

  Future<List<CachedEvent>> listByTenant(String tenantId) {
    return (select(cachedEvents)
          ..where((t) => t.tenantId.equals(tenantId))
          ..orderBy([(t) => OrderingTerm(expression: t.startsAt, mode: OrderingMode.desc)]))
        .get();
  }

  Future<CachedEvent?> get(String id) {
    return (select(cachedEvents)..where((t) => t.id.equals(id))).getSingleOrNull();
  }

  Future<void> upsert(CachedEventsCompanion entry) {
    return into(cachedEvents).insertOnConflictUpdate(entry);
  }

  Future<void> upsertAll(List<CachedEventsCompanion> entries) async {
    await batch((b) {
      for (final e in entries) {
        b.insert(cachedEvents, e, onConflict: DoUpdate((_) => e));
      }
    });
  }

  Future<int> deleteStale({required DateTime olderThan}) {
    return (delete(cachedEvents)..where((t) => t.cachedAt.isSmallerThanValue(olderThan))).go();
  }
}

@DriftDatabase(tables: [CachedEvents])
class EventDashboardDatabase extends _$EventDashboardDatabase {
  EventDashboardDatabase(super.executor);

  @override
  int get schemaVersion => 1;
}
