/**
 * lib/features/checkin/data/datasources/pending_checkin_dao.dart
 *
 * I-403 — Drift table cho pending_checkin (offline queue).
 */
import 'package:drift/drift.dart';

part 'pending_checkin_dao.g.dart';

class PendingCheckIns extends Table {
  TextColumn get id => text()();
  TextColumn get jti => text()();
  TextColumn get registrationId => text()();
  TextColumn get eventId => text()();
  TextColumn get organizationId => text()();
  TextColumn get gateId => text()();
  TextColumn get staffUserId => text()();
  TextColumn get signature => text()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get scannedAt => dateTime()();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(tables: [PendingCheckIns])
class PendingCheckInDb extends _$PendingCheckInDb {
  PendingCheckInDb(super.executor);
  @override
  int get schemaVersion => 1;
}
