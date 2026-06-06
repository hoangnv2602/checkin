// apps/core-api/src/SaasCheckin.Domain/Billing/Events/PayoutDomainEvents.cs
// I-803 — Domain + integration events cho Payout lifecycle.
namespace SaasCheckin.Domain.Billing.Events;

public sealed record PayoutScheduledDomainEvent(
    Guid PayoutId,
    Guid OrganizationId,
    long AmountMinor,
    string Currency,
    int CommissionBps);

public sealed record PayoutCompletedDomainEvent(
    Guid PayoutId,
    Guid OrganizationId,
    long AmountMinor,
    string Currency);

public sealed record PayoutFailedDomainEvent(
    Guid PayoutId,
    Guid OrganizationId,
    string Reason);

/// <summary>
/// Integration event — emitted lên Redis Streams / RabbitMQ qua Outbox pattern.
/// BFF consume để update materialized view + send chat notification cho organizer.
/// </summary>
public sealed record PayoutCompletedIntegrationEvent(
    Guid PayoutId,
    Guid OrganizationId,
    long AmountMinor,
    string Currency,
    DateTime CompletedAt) : SaasCheckin.Shared.Contracts.IntegrationEvent;
