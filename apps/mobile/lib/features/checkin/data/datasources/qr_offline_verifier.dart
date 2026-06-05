/**
 * lib/features/checkin/data/datasources/qr_offline_verifier.dart
 *
 * I-403 — Offline Ed25519 verification. Cache JWKS trong flutter_secure_storage.
 * Verify signature ở client trước khi queue đồng bộ — saves round-trip nếu
 * payload bị tamper.
 */
import 'dart:convert';
import 'package:basic_utils/basic_utils.dart' as basic_utils; // nếu có; fallback dùng pointycastle
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class QrOfflineVerifier {
  final FlutterSecureStorage _storage;
  QrOfflineVerifier(this._storage);

  /// Verify Ed25519 signature. Trả true nếu key match + signature valid.
  Future<bool> verify({
    required String organizationId,
    required String payloadJson,
    required String signatureBase64,
  }) async {
    final pubKey = await _loadPublicKey(organizationId);
    if (pubKey == null) return false;
    try {
      return basic_utils.CryptoUtils.verifyEd25519(
        utf8.encode(payloadJson),
        base64Decode(signatureBase64),
        pubKey,
      );
    } catch (_) {
      return false;
    }
  }

  Future<void> cachePublicKey(String organizationId, List<int> pubKeyBytes) async {
    await _storage.write(
      key: "qr:ed25519-pub:$organizationId",
      value: base64Encode(pubKeyBytes),
    );
  }

  Future<List<int>?> _loadPublicKey(String organizationId) async {
    final v = await _storage.read(key: "qr:ed25519-pub:$organizationId");
    if (v == null) return null;
    return base64Decode(v);
  }
}
