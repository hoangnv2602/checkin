using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.CheckIn.Events;

public sealed record CheckInRejected(
    Guid RegistrationId,
    Guid Jti,
    Guid OrganizationId,
    Guid EventId,
    GateId GateId,
    string Reason,
    DateTimeOffset ScannedAt) : IDomainEvent;
