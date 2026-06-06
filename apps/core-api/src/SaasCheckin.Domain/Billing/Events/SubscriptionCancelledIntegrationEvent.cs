using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Application.IntegrationEvents;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Billing.Events;

/// <summary>
/// Cross-context event consumed by Identity context — auto-suspend org khi
/// trial hết hoặc chủ động cancel.
///
/// Implements cả IDomainEvent (in-process qua AggregateRoot.RaiseDomainEvent)
/// và IIntegrationEvent (Outbox dispatcher sẽ filter marker này để route
/// qua message bus cho context khác subscribe).
/// </summary>
public sealed record SubscriptionCancelledIntegrationEvent(
    SubscriptionId SubscriptionId,
    Guid OrganizationId,
    PlanId PlanId,
    DateTimeOffset CancelledAt,
    DateTimeOffset OccurredAt) : IDomainEvent, IIntegrationEvent;
