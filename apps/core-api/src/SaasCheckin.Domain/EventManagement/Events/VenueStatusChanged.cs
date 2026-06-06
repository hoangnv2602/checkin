using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.EventManagement.Events;

public sealed record VenueStatusChanged(
    VenueId VenueId,
    Guid OrganizationId,
    VenueStatus NewStatus,
    DateTimeOffset OccurredAt) : IDomainEvent;
