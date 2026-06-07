/// I-403 — ScannedTicket entity. Mirror QrPayload shape.
library;

import 'package:equatable/equatable.dart';

import '../../../../core/types/guid.dart';

class ScannedTicket extends Equatable {
  final GuidJti jti;
  final Guid registrationId;
  final Guid eventId;
  final Guid organizationId;
  final DateTime issuedAt;
  final DateTime expiresAt;
  final String signature; // base64 Ed25519

  const ScannedTicket({
    required this.jti,
    required this.registrationId,
    required this.eventId,
    required this.organizationId,
    required this.issuedAt,
    required this.expiresAt,
    required this.signature,
  });

  @override
  List<Object?> get props => [jti, registrationId, eventId, organizationId, issuedAt, expiresAt];
}

/// Lightweight Guid wrapper — Flutter lacks native Guid.
class GuidJti {
  final String value;
  const GuidJti(this.value);
  factory GuidJti.parse(String s) => GuidJti(s);
  @override
  String toString() => value;
  @override
  bool operator ==(Object other) => other is GuidJti && other.value == value;
  @override
  int get hashCode => value.hashCode;
}
