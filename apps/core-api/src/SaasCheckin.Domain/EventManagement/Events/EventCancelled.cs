using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.EventManagement.Events;

public sealed record EventCancelled(
    EventId EventId,
    Guid OrganizationId,
    DateTimeOffset OccurredAt) : IDomainEvent;
