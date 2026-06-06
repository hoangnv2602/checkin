using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Application.IntegrationEvents;

namespace SaasCheckin.Domain.Billing.Events;

/// <summary>
/// Cross-context event consumed by Identity context — auto-suspend org khi
/// trial hết hoặc chủ động cancel.
/// </summary>
public sealed record SubscriptionCancelledIntegrationEvent(
    SubscriptionId SubscriptionId,
    Guid OrganizationId,
    PlanId PlanId,
    DateTimeOffset CancelledAt,
    DateTimeOffset OccurredAt) : IIntegrationEvent;
