///
/// lib/features/organizer/domain/entities/cached_event.dart
/// 
/// I-907 — Domain entity cho cached event + stats.
/// Mirror EventStats từ checkin context (I-401).
///
library;

import 'package:meta/meta.dart';

@immutable
class CachedEvent {
  final String id;
  final String tenantId;
  final String name;
  final String slug;
  final String status;
  final DateTime startsAt;
  final DateTime? endsAt;
  final int totalRegistered;
  final int totalCheckedIn;
  final DateTime cachedAt;

  const CachedEvent({
    required this.id,
    required this.tenantId,
    required this.name,
    required this.slug,
    required this.status,
    required this.startsAt,
    required this.endsAt,
    required this.totalRegistered,
    required this.totalCheckedIn,
    required this.cachedAt,
  });

  int get totalPending => totalRegistered - totalCheckedIn;
  double get checkInRate => totalRegistered == 0 ? 0 : totalCheckedIn / totalRegistered;

  /// Stale sau 5 phút (theo Phase 9 spec).
  bool get isStale => DateTime.now().difference(cachedAt) > const Duration(minutes: 5);

  CachedEvent copyWith({
    String? id,
    String? tenantId,
    String? name,
    String? slug,
    String? status,
    DateTime? startsAt,
    DateTime? endsAt,
    int? totalRegistered,
    int? totalCheckedIn,
    DateTime? cachedAt,
  }) {
    return CachedEvent(
      id: id ?? this.id,
      tenantId: tenantId ?? this.tenantId,
      name: name ?? this.name,
      slug: slug ?? this.slug,
      status: status ?? this.status,
      startsAt: startsAt ?? this.startsAt,
      endsAt: endsAt ?? this.endsAt,
      totalRegistered: totalRegistered ?? this.totalRegistered,
      totalCheckedIn: totalCheckedIn ?? this.totalCheckedIn,
      cachedAt: cachedAt ?? this.cachedAt,
    );
  }

  Map<String, Object?> toRow() => {
        'id': id,
        'tenantId': tenantId,
        'name': name,
        'slug': slug,
        'status': status,
        'startsAt': startsAt,
        'endsAt': endsAt,
        'totalRegistered': totalRegistered,
        'totalCheckedIn': totalCheckedIn,
        'cachedAt': cachedAt,
      };

  factory CachedEvent.fromRow(Map<String, Object?> r) => CachedEvent(
        id: r['id']! as String,
        tenantId: r['tenantId']! as String,
        name: r['name']! as String,
        slug: r['slug']! as String,
        status: r['status']! as String,
        startsAt: r['startsAt']! as DateTime,
        endsAt: r['endsAt'] as DateTime?,
        totalRegistered: (r['totalRegistered'] as int?) ?? 0,
        totalCheckedIn: (r['totalCheckedIn'] as int?) ?? 0,
        cachedAt: r['cachedAt']! as DateTime,
      );
}
