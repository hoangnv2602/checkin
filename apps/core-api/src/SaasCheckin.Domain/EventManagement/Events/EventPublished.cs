using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.EventManagement.Events;

public sealed record EventPublished(
    EventId EventId,
    Guid OrganizationId,
    string Title,
    DateTimeOffset OccurredAt) : IDomainEvent;
