using SaasCheckin.Domain.Registration.ValueObjects;

namespace SaasCheckin.Domain.Registration.Services;

/// <summary>
/// IQrCodeGenerator — ký QrPayload bằng Ed25519 với key theo tenant.
/// Implementation dùng NSec.Cryptography (preferred) hoặc
/// Org.BouncyCastle.Cryptography (fallback).
/// </summary>
public interface IQrCodeGenerator
{
    /// <summary>Trả QrSignature cho payload, dùng signing key của <paramref name="organizationId"/>.</summary>
    QrSignature Sign(QrPayload payload, Guid organizationId);

    /// <summary>Verify signature với key của tenant. Trả false nếu key xoay / không match.</summary>
    bool Verify(QrPayload payload, QrSignature signature, Guid organizationId);
}
