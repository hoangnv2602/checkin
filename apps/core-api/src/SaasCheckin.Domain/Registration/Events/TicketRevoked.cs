using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Registration.Events;

public sealed record TicketRevoked(
    RegistrationId RegistrationId,
    Guid Jti,
    Guid OrganizationId,
    Guid EventId,
    string Reason,
    DateTimeOffset OccurredAt) : IDomainEvent;
