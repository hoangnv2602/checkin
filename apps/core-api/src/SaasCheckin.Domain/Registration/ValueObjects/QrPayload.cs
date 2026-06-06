namespace SaasCheckin.Domain.Registration.ValueObjects;

/// <summary>
/// QrPayload — base64url( JSON({ jti, registrationId, eventId, orgId, exp }) ).
/// Server-side canonical, signed bởi IQrCodeGenerator trước khi encode.
/// </summary>
public sealed record QrPayload
{
    public Guid Jti { get; }              // unique ticket id (jti claim) — single-use
    public Guid RegistrationId { get; }
    public Guid EventId { get; }
    public Guid OrganizationId { get; }
    public DateTimeOffset IssuedAt { get; }
    public DateTimeOffset ExpiresAt { get; }

    public QrPayload(
        Guid jti,
        Guid registrationId,
        Guid eventId,
        Guid organizationId,
        DateTimeOffset issuedAt,
        DateTimeOffset expiresAt)
    {
        if (jti == Guid.Empty) throw new ArgumentException("Jti required", nameof(jti));
        if (registrationId == Guid.Empty) throw new ArgumentException("RegistrationId required", nameof(registrationId));
        if (eventId == Guid.Empty) throw new ArgumentException("EventId required", nameof(eventId));
        if (organizationId == Guid.Empty) throw new ArgumentException("OrganizationId required", nameof(organizationId));
        if (issuedAt >= expiresAt)
            throw new ArgumentException("IssuedAt must be < ExpiresAt", nameof(issuedAt));

        Jti = jti;
        RegistrationId = registrationId;
        EventId = eventId;
        OrganizationId = organizationId;
        IssuedAt = issuedAt;
        ExpiresAt = expiresAt;
    }
}

/// <summary>
/// QrSignature — Ed25519 64-byte signature of canonical QrPayload bytes,
/// key theo tenant (load qua IQrSignatureKeyProvider).
/// </summary>
public readonly record struct QrSignature
{
    public const int Size = 64;

    public byte[] Value { get; }

    public QrSignature(byte[] value)
    {
        if (value is null) throw new ArgumentNullException(nameof(value));
        if (value.Length != Size)
            throw new ArgumentException($"Ed25519 signature must be {Size} bytes", nameof(value));
        Value = value;
    }
}
