using SaasCheckin.Shared.Application.IntegrationEvents;

namespace SaasCheckin.Domain.Registration.Events;

/// <summary>
/// Cross-context event — Notification context có thể gửi "payment-failed" email.
/// </summary>
public sealed record OrderFailedIntegrationEvent(
    Guid OrderId,
    Guid OrganizationId,
    Guid EventId,
    string BuyerEmail,
    string Reason,
    DateTimeOffset OccurredAt) : IIntegrationEvent;
