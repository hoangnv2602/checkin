using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using RegistrationId = SaasCheckin.Domain.Registration.ValueObjects.RegistrationId;

namespace SaasCheckin.Domain.CheckIn.Events;

public sealed record AttendeeCheckedIn(
    RegistrationId RegistrationId,
    Guid Jti,
    Guid OrganizationId,
    Guid EventId,
    GateId GateId,
    Guid StaffUserId,
    DateTimeOffset ScannedAt) : IDomainEvent
{
    public DateTimeOffset OccurredAt => ScannedAt;
}
