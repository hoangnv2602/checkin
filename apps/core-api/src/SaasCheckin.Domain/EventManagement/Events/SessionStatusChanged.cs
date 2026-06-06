using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.EventManagement.Events;

public sealed record SessionStatusChanged(
    SessionId SessionId,
    Guid OrganizationId,
    EventId EventId,
    SessionStatus NewStatus,
    DateTimeOffset OccurredAt) : IDomainEvent;
