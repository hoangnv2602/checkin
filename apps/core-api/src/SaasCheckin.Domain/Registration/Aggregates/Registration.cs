using SaasCheckin.Domain.Registration.Events;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

namespace SaasCheckin.Domain.Registration.Aggregates;

/// <summary>
/// Registration — 1 attendee đã mua vé. 1 Order có thể tạo N Registration
/// (quantity=N). Sau khi Order paid, command IssueTicket tạo Registration,
/// sinh JTI (single-use), ký QR payload qua IQrCodeGenerator.
/// </summary>
public sealed class Registration : AggregateRoot<RegistrationId>
{
    public Guid OrganizationId { get; private set; }
    public Guid EventId { get; private set; }
    public Guid OrderId { get; private set; }
    public Guid TicketTypeId { get; private set; }
    public Guid Jti { get; private set; }                    // unique ticket id — single-use
    public string AttendeeEmail { get; private set; } = default!;
    public string AttendeeName { get; private set; } = default!;
    public string? AttendeePhone { get; private set; }
    public RegistrationStatus Status { get; private set; }
    public DateTimeOffset IssuedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? CheckedInAt { get; private set; }
    public string? QrImageUrl { get; private set; }
    public string? Signature { get; private set; }           // base64(QrSignature) — for offline verify
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private Registration() : base(default!) { }

    private Registration(
        RegistrationId id,
        Guid orgId,
        Guid eventId,
        Guid orderId,
        Guid ticketTypeId,
        Guid jti,
        string attendeeEmail,
        string attendeeName,
        string? attendeePhone,
        DateTimeOffset expiresAt,
        IClock clock) : base(id)
    {
        Guard.NotNullStruct(id, nameof(id));
        Guard.NotNullStruct(orgId, nameof(orgId));
        if (orgId == Guid.Empty) throw new ArgumentException("OrganizationId required", nameof(orgId));
        Guard.NotNullStruct(eventId, nameof(eventId));
        if (eventId == Guid.Empty) throw new ArgumentException("EventId required", nameof(eventId));
        Guard.NotNullStruct(orderId, nameof(orderId));
        if (orderId == Guid.Empty) throw new ArgumentException("OrderId required", nameof(orderId));
        Guard.NotNullStruct(ticketTypeId, nameof(ticketTypeId));
        if (ticketTypeId == Guid.Empty) throw new ArgumentException("TicketTypeId required", nameof(ticketTypeId));
        if (jti == Guid.Empty) throw new ArgumentException("Jti required", nameof(jti));
        Guard.NotNullOrWhiteSpace(attendeeEmail, nameof(attendeeEmail));
        Guard.NotNullOrWhiteSpace(attendeeName, nameof(attendeeName));
        if (attendeeName.Length > 200) throw new ArgumentException("AttendeeName > 200 chars", nameof(attendeeName));
        if (clock.UtcNow >= expiresAt)
            throw new ArgumentException("ExpiresAt must be > now", nameof(expiresAt));

        OrganizationId = orgId;
        EventId = eventId;
        OrderId = orderId;
        TicketTypeId = ticketTypeId;
        Jti = jti;
        AttendeeEmail = attendeeEmail.Trim().ToLowerInvariant();
        AttendeeName = attendeeName.Trim();
        AttendeePhone = attendeePhone?.Trim();
        Status = RegistrationStatus.Active;
        IssuedAt = clock.UtcNow;
        ExpiresAt = expiresAt;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public static Registration Issue(
        Guid organizationId,
        Guid eventId,
        Guid orderId,
        Guid ticketTypeId,
        string attendeeEmail,
        string attendeeName,
        string? attendeePhone,
        TimeSpan ticketValidity,
        IClock clock)
    {
        if (ticketValidity <= TimeSpan.Zero)
            throw new ArgumentException("Ticket validity must be > 0", nameof(ticketValidity));
        var expiresAt = clock.UtcNow.Add(ticketValidity);
        return new Registration(RegistrationId.New(), organizationId, eventId, orderId, ticketTypeId,
                                 Guid.NewGuid(), attendeeEmail, attendeeName, attendeePhone, expiresAt, clock);
    }

    /// <summary>Set QR image + signature (URL output of QR worker).</summary>
    public void AttachQrImage(string qrImageUrl, string signature, IClock clock)
    {
        if (Status != RegistrationStatus.Active)
            throw new InvalidOperationException($"Cannot attach QR in status {Status}");
        Guard.NotNullOrWhiteSpace(qrImageUrl, nameof(qrImageUrl));
        Guard.NotNullOrWhiteSpace(signature, nameof(signature));
        QrImageUrl = qrImageUrl;
        Signature = signature;
        UpdatedAt = clock.UtcNow;
    }

    public void MarkCheckedIn(IClock clock)
    {
        if (Status != RegistrationStatus.Active)
            throw new InvalidOperationException($"Cannot check-in in status {Status}");
        Status = RegistrationStatus.CheckedIn;
        CheckedInAt = clock.UtcNow;
        UpdatedAt = clock.UtcNow;
    }

    public void Revoke(string reason, IClock clock)
    {
        if (Status == RegistrationStatus.Revoked) return;
        Status = RegistrationStatus.Revoked;
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new TicketRevoked(Id, Jti, OrganizationId, EventId,
                                           reason ?? "unspecified", clock.UtcNow));
    }

    public QrPayload ToQrPayload() => new(
        Jti, Id, EventId, OrganizationId, IssuedAt, ExpiresAt);
}

public enum RegistrationStatus
{
    Active = 0,
    CheckedIn = 1,
    Revoked = 2,
    Expired = 3
}
