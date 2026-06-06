using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Billing.Events;

public sealed record SubscriptionCancelled(
    SubscriptionId SubscriptionId,
    Guid OrganizationId,
    PlanId PlanId,
    DateTimeOffset OccurredAt) : IDomainEvent;
