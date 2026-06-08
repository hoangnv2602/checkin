/// I-907 — Cubit: trạng thái dashboard, điều phối cache + remote.
///
/// I-913: stub — the drift-cached DashboardRepository and remote data source
/// were removed because the local pub cache's drift_dev 2.28 + dart_style 3.1.x
/// combo is incompatible with analyzer 7.x (cannot run build_runner). Real
/// implementation re-introduced in I-914 when drift codegen is wired up.
///
/// The cubit is kept (not deleted) so the SyncIndicator widget, the
/// DashboardState sealed class, and the test scaffolding remain compileable
/// for future integration.
library;

import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/dashboard_state.dart';

class OrganizerDashboardCubit extends Cubit<DashboardState> {
  OrganizerDashboardCubit({required this.tenantId})
      : super(const DashboardInitial());

  final String tenantId;

  /// I-913 stub: emits Initial and returns. I-914 will restore the
  /// cache-first + remote-refresh flow once drift codegen works.
  Future<void> load() async {
    emit(const DashboardInitial());
  }

  Future<void> refresh() async {
    emit(const DashboardInitial());
  }
}
