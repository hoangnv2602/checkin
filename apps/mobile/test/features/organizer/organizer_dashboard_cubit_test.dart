/**
 * test/features/organizer/organizer_dashboard_cubit_test.dart
 *
 * I-907 — Cubit tests với FakeDashboardRemoteDataSource + in-memory DAO stub.
 */
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:saas_checkin/features/organizer/data/datasources/event_dashboard_dao.dart';
import 'package:saas_checkin/features/organizer/data/repositories/dashboard_repository_impl.dart';
import 'package:saas_checkin/features/organizer/domain/entities/cached_event.dart';
import 'package:saas_checkin/features/organizer/domain/entities/dashboard_state.dart';
import 'package:saas_checkin/features/organizer/presentation/cubits/organizer_dashboard_cubit.dart';

class FlakyRemote implements DashboardRemoteDataSource {
  bool shouldFail = false;
  @override
  Future<List<CachedEvent>> fetchEvents(String tenantId) async {
    if (shouldFail) throw Exception('network down');
    return [
      CachedEvent(
        id: 'evt_1',
        tenantId: tenantId,
        name: 'Test',
        slug: 'test',
        status: 'published',
        startsAt: DateTime.utc(2026, 6, 15),
        endsAt: null,
        totalRegistered: 100,
        totalCheckedIn: 60,
        cachedAt: DateTime.now(),
      ),
    ];
  }
}

void main() {
  late EventDashboardDb dao;
  late DashboardRepository repo;
  late FlakyRemote remote;

  setUp(() {
    dao = EventDashboardDb(NativeDatabase.memory());
    remote = FlakyRemote();
    repo = DashboardRepository(dao: dao, remote: remote);
  });

  tearDown(() async {
    await dao.close();
  });

  test('load emits Loaded (from cache) when cache empty → fetches remote', () async {
    final cubit = OrganizerDashboardCubit(repo: repo, tenantId: 'tenant_1');
    final states = <DashboardState>[];
    final sub = cubit.stream.listen(states.add);
    await cubit.load();
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await sub.cancel();
    await cubit.close();

    expect(states.first, isA<DashboardLoading>());
    final loaded = states.whereType<DashboardLoaded>().last;
    expect(loaded.fromCache, false);
    expect(loaded.events.length, 1);
    expect(loaded.events.first.totalCheckedIn, 60);
  });

  test('load returns cached first then refreshes (fromCache=true then false)', () async {
    // Seed cache
    await dao.upsert(CachedEventsCompanion.insert(
      id: 'evt_cached',
      tenantId: 'tenant_1',
      name: 'Cached',
      slug: 'cached',
      status: 'published',
      startsAt: DateTime.utc(2026, 6, 15),
      totalRegistered: const Value(50),
      totalCheckedIn: const Value(20),
      cachedAt: DateTime.now().subtract(const Duration(minutes: 1)),
    ));

    final cubit = OrganizerDashboardCubit(repo: repo, tenantId: 'tenant_1');
    final states = <DashboardState>[];
    final sub = cubit.stream.listen(states.add);
    await cubit.load();
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await sub.cancel();
    await cubit.close();

    final loaded = states.whereType<DashboardLoaded>().toList();
    expect(loaded.first.fromCache, true);
    expect(loaded.last.fromCache, false);
  });

  test('remote fail → emit Error with cache fallback', () async {
    await dao.upsert(CachedEventsCompanion.insert(
      id: 'evt_fb',
      tenantId: 'tenant_1',
      name: 'Fallback',
      slug: 'fb',
      status: 'published',
      startsAt: DateTime.utc(2026, 6, 15),
      totalRegistered: const Value(10),
      totalCheckedIn: const Value(5),
      cachedAt: DateTime.now(),
    ));
    remote.shouldFail = true;

    final cubit = OrganizerDashboardCubit(repo: repo, tenantId: 'tenant_1');
    final states = <DashboardState>[];
    final sub = cubit.stream.listen(states.add);
    await cubit.load();
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await sub.cancel();
    await cubit.close();

    final err = states.whereType<DashboardError>().last;
    expect(err.fallback.length, 1);
    expect(err.fallback.first.id, 'evt_fb');
  });

  test('CachedEvent.isStale = true after 5 min', () {
    final e = CachedEvent(
      id: 'x', tenantId: 't', name: 'n', slug: 's', status: 'p',
      startsAt: DateTime.now(), endsAt: null,
      totalRegistered: 1, totalCheckedIn: 0,
      cachedAt: DateTime.now().subtract(const Duration(minutes: 6)),
    );
    expect(e.isStale, true);
  });

  test('CachedEvent.isStale = false within 5 min', () {
    final e = CachedEvent(
      id: 'x', tenantId: 't', name: 'n', slug: 's', status: 'p',
      startsAt: DateTime.now(), endsAt: null,
      totalRegistered: 1, totalCheckedIn: 0,
      cachedAt: DateTime.now().subtract(const Duration(minutes: 2)),
    );
    expect(e.isStale, false);
  });

  test('DashboardLoaded aggregates totals', () async {
    final s = DashboardLoaded(
      events: [
        CachedEvent(id: 'a', tenantId: 't', name: 'A', slug: 'a', status: 'p', startsAt: DateTime.now(), endsAt: null, totalRegistered: 100, totalCheckedIn: 60, cachedAt: DateTime.now()),
        CachedEvent(id: 'b', tenantId: 't', name: 'B', slug: 'b', status: 'p', startsAt: DateTime.now(), endsAt: null, totalRegistered: 50, totalCheckedIn: 20, cachedAt: DateTime.now()),
      ],
      fromCache: false,
      fetchedAt: DateTime.now(),
    );
    expect(s.totalRegistered, 150);
    expect(s.totalCheckedIn, 80);
    expect(s.totalPending, 70);
  });
}
