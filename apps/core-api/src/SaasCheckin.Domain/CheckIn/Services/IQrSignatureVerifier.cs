using SaasCheckin.Domain.Registration.ValueObjects;
using QrPayload = SaasCheckin.Domain.Registration.ValueObjects.QrPayload;
using QrSignature = SaasCheckin.Domain.Registration.ValueObjects.QrSignature;

namespace SaasCheckin.Domain.CheckIn.Services;

/// <summary>
/// IQrSignatureVerifier — verify Ed25519 chữ ký QR. Reuse
/// Registration context's IQrCodeGenerator để verify signature.
/// </summary>
public interface IQrSignatureVerifier
{
    bool Verify(QrPayload payload, QrSignature signature, Guid organizationId);
}
