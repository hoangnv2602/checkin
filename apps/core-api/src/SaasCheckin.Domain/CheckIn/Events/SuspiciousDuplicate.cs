using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.CheckIn.Events;

public sealed record SuspiciousDuplicate(
    Guid RegistrationId,
    Guid Jti,
    Guid OrganizationId,
    Guid EventId,
    GateId GateId,
    Guid StaffUserId,
    DateTimeOffset ScannedAt) : IDomainEvent;
