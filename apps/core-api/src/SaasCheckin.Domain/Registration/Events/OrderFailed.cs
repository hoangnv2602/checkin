using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Registration.Events;

public sealed record OrderFailed(
    OrderId OrderId,
    Guid OrganizationId,
    Guid EventId,
    Guid TicketTypeId,
    int Quantity,
    string Reason,
    DateTimeOffset OccurredAt) : IDomainEvent;
