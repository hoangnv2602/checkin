using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.EventManagement.Events;

public sealed record SessionCreated(
    SessionId SessionId,
    Guid OrganizationId,
    EventId EventId,
    string Title,
    DateTimeOffset OccurredAt) : IDomainEvent;
