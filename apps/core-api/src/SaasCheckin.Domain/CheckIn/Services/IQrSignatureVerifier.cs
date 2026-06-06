using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Domain.Registration.ValueObjects;

namespace SaasCheckin.Domain.CheckIn.Services;

/// <summary>
/// IQrSignatureVerifier — verify Ed25519 chữ ký QR. Reuse
/// <see cref="IQrCodeGenerator.Verify"/> từ Registration context.
/// </summary>
public interface IQrSignatureVerifier
{
    bool Verify(QrPayload payload, QrSignature signature, Guid organizationId);
}
