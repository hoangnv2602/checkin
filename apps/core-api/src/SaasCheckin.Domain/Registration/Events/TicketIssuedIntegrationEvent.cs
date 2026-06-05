using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Application.IntegrationEvents;

namespace SaasCheckin.Domain.Registration.Events;

/// <summary>
/// Cross-context event — published to message bus (MassTransit / Redis Streams)
/// để QR worker (api-gateway) render ảnh + Notification context gửi email.
/// </summary>
public sealed record TicketIssuedIntegrationEvent(
    Guid RegistrationId,
    Guid Jti,
    Guid OrganizationId,
    Guid EventId,
    Guid OrderId,
    string AttendeeEmail,
    string AttendeeName,
    string? AttendeePhone,
    DateTimeOffset IssuedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset OccurredAt) : IIntegrationEvent;
