using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Billing.Events;

public sealed record SubscriptionPastDue(
    SubscriptionId SubscriptionId,
    Guid OrganizationId,
    DateTimeOffset OccurredAt) : IDomainEvent;
