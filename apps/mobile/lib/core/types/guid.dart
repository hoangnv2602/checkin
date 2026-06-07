///
/// apps/mobile/lib/core/types/guid.dart
/// 
/// I-913 — Shared Guid value type. Stub UUID wrapper used for foreign key
/// types (jti, registrationId, eventId, organizationId, etc.) that need to
/// round-trip through gRPC / REST. Production migration in I-914 → package:uuid.
///
library;

class Guid {
  final String value;
  const Guid(this.value);

  @override
  String toString() => value;

  @override
  bool operator ==(Object other) =>
      identical(this, other) || (other is Guid && other.value == value);

  @override
  int get hashCode => value.hashCode;
}
