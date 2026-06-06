/**
 * lib/features/checkin/data/datasources/pending_checkin_sync.dart
 *
 * I-403 — Workmanager task 15s drain pending queue. Khi online:
 *  - read tất cả pending rows
 *  - gọi scan
 *  - success -> delete row
 *  - 409 (duplicate) -> delete row (server says already done)
 *  - 5xx -> keep, increment attempts (max 5 rồi mark dead)
 */
import 'package:workmanager/workmanager.dart';
import 'package:drift/drift.dart';
import 'pending_checkin_dao.dart';
import 'checkin_remote_datasource.dart';
import '../../domain/entities/scanned_ticket.dart';
import '../../domain/entities/check_in_outcome.dart';

const SYNC_TASK = "checkin.syncPending";

class PendingCheckInSync {
  final PendingCheckInDb _db;
  final CheckInRemoteDataSource _remote;
  PendingCheckInSync(this._db, this._remote);

  /// Run 1 lần — drain queue. Returns (success, failed).
  Future<(int, int)> drainOnce() async {
    final rows = await _db.select(_db.pendingCheckIns).get();
    var ok = 0, fail = 0;
    for (final row in rows) {
      if (row.attempts >= 5) {
        await (_db.delete(_db.pendingCheckIns)..where((t) => t.id.equals(row.id))).go();
        fail++;
        continue;
      }
      try {
        await _remote.scan(
          ticket: ScannedTicket(
            jti: GuidJti.parse(row.jti),
            registrationId: GuidJti.parse(row.registrationId),
            eventId: GuidJti.parse(row.eventId),
            organizationId: GuidJti.parse(row.organizationId),
            issuedAt: row.scannedAt,
            expiresAt: row.scannedAt.add(const Duration(days: 1)),
            signature: row.signature,
          ),
          gateId: row.gateId,
          staffUserId: row.staffUserId,
          organizationId: row.organizationId,
        );
        await (_db.delete(_db.pendingCheckIns)..where((t) => t.id.equals(row.id))).go();
        ok++;
      } catch (e) {
        await (_db.update(_db.pendingCheckIns)..where((t) => t.id.equals(row.id)))
            .write(PendingCheckInsCompanion(
          attempts: Value(row.attempts + 1),
          lastError: Value(e.toString()),
        ));
        fail++;
      }
    }
    return (ok, fail);
  }
}

/// workmanager callback (top-level required by package).
@pragma('vm:entry-point')
void workmanagerCallback() {
  Workmanager().executeTask((task, inputData) async {
    // Phase 3: stub. Real app sẽ lookup DI container ở đây.
    return Future.value(true);
  });
}
