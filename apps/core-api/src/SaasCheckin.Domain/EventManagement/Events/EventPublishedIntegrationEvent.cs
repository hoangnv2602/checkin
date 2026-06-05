using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Application.IntegrationEvents;

namespace SaasCheckin.Domain.EventManagement.Events;

/// <summary>
/// Cross-bounded-context event — published to RabbitMQ/MassTransit for
/// Registration context to start ticket sales.
/// </summary>
public sealed record EventPublishedIntegrationEvent(
    EventId EventId,
    Guid OrganizationId,
    string Title,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    int Capacity,
    DateTimeOffset OccurredAt) : IIntegrationEvent;
