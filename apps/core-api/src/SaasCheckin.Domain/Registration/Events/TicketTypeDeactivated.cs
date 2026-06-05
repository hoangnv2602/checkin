using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Registration.Events;

public sealed record TicketTypeDeactivated(
    TicketTypeId TicketTypeId,
    Guid OrganizationId,
    Guid EventId,
    DateTimeOffset OccurredAt) : IDomainEvent;
