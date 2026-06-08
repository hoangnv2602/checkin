/// I-403 — Offline Ed25519 verification. Cache JWKS trong flutter_secure_storage.
/// Verify signature ở client trước khi queue đồng bộ — saves round-trip nếu
/// payload bị tamper.
///
/// I-913: Stubbed — `basic_utils.CryptoUtils.verifyEd25519` API changed in
/// basic_utils 5.8. Real verification will be re-implemented in I-914 using
/// `package:ed25519_edwards` or the current basic_utils API.
library;

import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class QrOfflineVerifier {
  final FlutterSecureStorage _storage;
  QrOfflineVerifier(this._storage);

  /// Verify Ed25519 signature. Trả true nếu key match + signature valid.
  /// I-913: stub returns false (no verification). Real impl in I-914.
  Future<bool> verify({
    required String organizationId,
    required String payloadJson,
    required String signatureBase64,
  }) async {
    // TODO(I-914): re-implement Ed25519 verify with the current
    // `package:ed25519_edwards` or `basic_utils ^5.8` API. For Phase 0/9,
    // we always defer to the server-side signature check.
    return false;
  }

  Future<void> cachePublicKey(String organizationId, List<int> pubKeyBytes) async {
    await _storage.write(
      key: "qr:ed25519-pub:$organizationId",
      value: base64Encode(pubKeyBytes),
    );
  }
}

