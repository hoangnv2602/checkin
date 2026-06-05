using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Registration.Events;

public sealed record OrderPaid(
    OrderId OrderId,
    Guid OrganizationId,
    Guid EventId,
    Guid TicketTypeId,
    int Quantity,
    Money Total,
    DateTimeOffset OccurredAt) : IDomainEvent;
