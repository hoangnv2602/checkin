using SaasCheckin.Domain.CheckIn.Services;
using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Domain.Registration.Services;
using SaasCheckin.Domain.Registration.ValueObjects;

namespace SaasCheckin.Infrastructure.CheckIn;

/// <summary>
/// Ed25519QrSignatureVerifier — thin adapter kết nối CheckIn context với
/// Registration.IQrCodeGenerator (đã có Ed25519 sign + verify).
/// </summary>
public sealed class Ed25519QrSignatureVerifier : IQrSignatureVerifier
{
    private readonly IQrCodeGenerator _generator;

    public Ed25519QrSignatureVerifier(IQrCodeGenerator generator)
    {
        _generator = generator;
    }

    public bool Verify(QrPayload payload, QrSignature signature, Guid organizationId)
    {
        var regPayload = new SaasCheckin.Domain.Registration.ValueObjects.QrPayload(
            payload.Jti, payload.RegistrationId, payload.EventId, payload.OrganizationId,
            payload.IssuedAt, payload.ExpiresAt);
        return _generator.Verify(regPayload, signature, organizationId);
    }
}
