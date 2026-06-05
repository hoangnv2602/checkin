using SaasCheckin.Domain.CheckIn.Events;
using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

namespace SaasCheckin.Domain.CheckIn.Aggregates;

/// <summary>
/// CheckInRecord — 1 lần quét QR (Success | Rejected | Duplicate).
/// Aggregate: mỗi scan tạo 1 record. Unique partial index trên
/// (registration_id) WHERE status='Success' đảm bảo 1 attendee chỉ
/// check-in thành công đúng 1 lần (nhưng có thể có nhiều attempts
/// bị Rejected hoặc Duplicate).
/// </summary>
public sealed class CheckInRecord : AggregateRoot<CheckInRecordId>
{
    public Guid OrganizationId { get; private set; }
    public Guid EventId { get; private set; }
    public Guid RegistrationId { get; private set; }
    public Guid Jti { get; private set; }
    public GateId GateId { get; private set; }
    public Guid StaffUserId { get; private set; }
    public CheckInStatus Status { get; private set; }
    public string? RejectReason { get; private set; }
    public DateTimeOffset ScannedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private CheckInRecord() : base(default!) { }

    private CheckInRecord(
        CheckInRecordId id,
        Guid orgId,
        Guid eventId,
        Guid registrationId,
        Guid jti,
        GateId gateId,
        Guid staffUserId,
        CheckInStatus status,
        string? rejectReason,
        DateTimeOffset scannedAt,
        IClock clock) : base(id)
    {
        Guard.NotNullStruct(id, nameof(id));
        Guard.NotNullStruct(orgId, nameof(orgId));
        if (orgId == Guid.Empty) throw new ArgumentException("OrganizationId required", nameof(orgId));
        Guard.NotNullStruct(eventId, nameof(eventId));
        if (eventId == Guid.Empty) throw new ArgumentException("EventId required", nameof(eventId));
        Guard.NotNullStruct(registrationId, nameof(registrationId));
        if (registrationId == Guid.Empty) throw new ArgumentException("RegistrationId required", nameof(registrationId));
        if (jti == Guid.Empty) throw new ArgumentException("Jti required", nameof(jti));
        Guard.NotNullStruct(gateId, nameof(gateId));
        if (gateId.Value == Guid.Empty) throw new ArgumentException("GateId required", nameof(gateId));
        if (staffUserId == Guid.Empty) throw new ArgumentException("StaffUserId required", nameof(staffUserId));
        if (status == CheckInStatus.Rejected && string.IsNullOrWhiteSpace(rejectReason))
            throw new ArgumentException("RejectReason required when status=Rejected", nameof(rejectReason));

        OrganizationId = orgId;
        EventId = eventId;
        RegistrationId = registrationId;
        Jti = jti;
        GateId = gateId;
        StaffUserId = staffUserId;
        Status = status;
        RejectReason = rejectReason?.Trim();
        ScannedAt = scannedAt;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public static CheckInRecord Success(
        Guid organizationId,
        Guid eventId,
        Guid registrationId,
        Guid jti,
        GateId gateId,
        Guid staffUserId,
        DateTimeOffset scannedAt,
        IClock clock)
        => new(CheckInRecordId.New(), organizationId, eventId, registrationId, jti,
               gateId, staffUserId, CheckInStatus.Success, null, scannedAt, clock)
            .WithEvent(new AttendeeCheckedIn(
                RegistrationId.From(registrationId), jti, organizationId, eventId,
                gateId, staffUserId, scannedAt));

    public static CheckInRecord Rejected(
        Guid organizationId,
        Guid eventId,
        Guid registrationId,
        Guid jti,
        GateId gateId,
        Guid staffUserId,
        string reason,
        DateTimeOffset scannedAt,
        IClock clock)
        => new(CheckInRecordId.New(), organizationId, eventId, registrationId, jti,
               gateId, staffUserId, CheckInStatus.Rejected, reason, scannedAt, clock)
            .WithEvent(new CheckInRejected(
                registrationId, jti, organizationId, eventId, gateId, reason, scannedAt));

    public static CheckInRecord Duplicate(
        Guid organizationId,
        Guid eventId,
        Guid registrationId,
        Guid jti,
        GateId gateId,
        Guid staffUserId,
        DateTimeOffset scannedAt,
        IClock clock)
        => new(CheckInRecordId.New(), organizationId, eventId, registrationId, jti,
               gateId, staffUserId, CheckInStatus.Duplicate,
                "Already checked in", scannedAt, clock)
            .WithEvent(new SuspiciousDuplicate(
                registrationId, jti, organizationId, eventId, gateId, staffUserId, scannedAt));

    private CheckInRecord WithEvent(IDomainEvent @event)
    {
        RaiseDomainEvent(@event);
        return this;
    }
}
