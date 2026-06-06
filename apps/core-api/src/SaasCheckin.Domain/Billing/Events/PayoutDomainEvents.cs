// apps/core-api/src/SaasCheckin.Domain/Billing/Events/PayoutDomainEvents.cs
// I-803 — Domain + integration events cho Payout lifecycle.
using SaasCheckin.Shared.Application.IntegrationEvents;

namespace SaasCheckin.Domain.Billing.Events;

public sealed record PayoutScheduledDomainEvent(
    Guid PayoutId,
    Guid OrganizationId,
    long AmountMinor,
    string Currency,
    int CommissionBps) : SaasCheckin.Shared.Domain.Core.IDomainEvent
{
    public DateTimeOffset OccurredAt { get; init; } = DateTimeOffset.UtcNow;
}

public sealed record PayoutCompletedDomainEvent(
    Guid PayoutId,
    Guid OrganizationId,
    long AmountMinor,
    string Currency) : SaasCheckin.Shared.Domain.Core.IDomainEvent
{
    public DateTimeOffset OccurredAt { get; init; } = DateTimeOffset.UtcNow;
}

public sealed record PayoutFailedDomainEvent(
    Guid PayoutId,
    Guid OrganizationId,
    string Reason) : SaasCheckin.Shared.Domain.Core.IDomainEvent
{
    public DateTimeOffset OccurredAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// Integration event — emitted lên Redis Streams / RabbitMQ qua Outbox pattern.
/// BFF consume để update materialized view + send chat notification cho organizer.
/// </summary>
public sealed record PayoutCompletedIntegrationEvent(
    Guid PayoutId,
    Guid OrganizationId,
    long AmountMinor,
    string Currency,
    DateTimeOffset CompletedAt) : IIntegrationEvent
{
    public DateTimeOffset OccurredAt => CompletedAt;
}
