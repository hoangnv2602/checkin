using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Application.IntegrationEvents;

namespace SaasCheckin.Domain.Registration.Events;

/// <summary>
/// Cross-context event — trigger Notification context gửi "payment-receipt".
/// </summary>
public sealed record OrderPaidIntegrationEvent(
    Guid OrderId,
    Guid OrganizationId,
    Guid EventId,
    string BuyerEmail,
    string BuyerName,
    long TotalMinor,
    string Currency,
    string Provider,
    DateTimeOffset OccurredAt) : IIntegrationEvent;
