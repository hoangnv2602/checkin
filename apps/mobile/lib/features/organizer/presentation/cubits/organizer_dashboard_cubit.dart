/**
 * lib/features/organizer/presentation/cubits/organizer_dashboard_cubit.dart
 *
 * I-907 — Cubit: trạng thái dashboard, điều phối cache + remote.
 *
 * Flow:
 *  - load(): cache-first → emit Loaded(fromCache=true) ngay
 *  - nếu cache empty → emit Loading
 *  - background: refresh remote → upsert cache → emit Loaded(fromCache=false)
 *  - nếu remote fail: giữ cache, emit Error với fallback = cache
 */
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../data/repositories/dashboard_repository_impl.dart';
import '../../domain/entities/dashboard_state.dart';

class OrganizerDashboardCubit extends Cubit<DashboardState> {
  OrganizerDashboardCubit({required this.repo, required this.tenantId})
      : super(const DashboardInitial());

  final DashboardRepository repo;
  final String tenantId;

  Future<void> load() async {
    final cached = await repo.listCached(tenantId);
    if (cached.isEmpty) {
      emit(const DashboardLoading());
    } else {
      emit(DashboardLoaded(
        events: cached,
        fromCache: true,
        fetchedAt: DateTime.now(),
      ));
    }
    await _refresh();
  }

  Future<void> refresh() async {
    emit(const DashboardLoading());
    await _refresh();
  }

  Future<void> _refresh() async {
    try {
      final fresh = await repo.refresh(tenantId);
      emit(DashboardLoaded(
        events: fresh,
        fromCache: false,
        fetchedAt: DateTime.now(),
      ));
    } catch (e) {
      final cached = await repo.listCached(tenantId);
      emit(DashboardError(message: e.toString(), fallback: cached));
    }
  }
}
