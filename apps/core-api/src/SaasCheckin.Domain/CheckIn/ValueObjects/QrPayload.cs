namespace SaasCheckin.Domain.CheckIn.ValueObjects;

/// <summary>
/// QrPayload — mirror Registration QrPayload cho verify offline. Server-side
/// canonical bytes đã ký bởi Ed25519 (xem SaasCheckin.Domain.Registration).
/// </summary>
public sealed record QrPayload
{
    public Guid Jti { get; }
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
