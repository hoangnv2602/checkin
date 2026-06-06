using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.EventManagement.Events;

public sealed record VenueCreated(
    VenueId VenueId,
    Guid OrganizationId,
    string Name,
    DateTimeOffset OccurredAt) : IDomainEvent;
