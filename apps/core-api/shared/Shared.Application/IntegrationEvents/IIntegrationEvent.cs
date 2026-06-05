namespace SaasCheckin.Shared.Application.IntegrationEvents;

/// <summary>
/// Marker interface cho cross-context integration events. Khác với
/// <c>IDomainEvent</c> (in-process, qua MediatR) — IIntegrationEvent được
/// publish ra message broker (MassTransit → RabbitMQ/Redis Streams) cho
/// bounded context khác subscribe.
///
/// Phase 1: in-process only (no broker, no outbox table). Phase 2+ wire
/// qua MassTransit.
/// </summary>
public interface IIntegrationEvent
{
    /// <summary>Thời điểm event xảy ra (UTC). Dùng cho event ordering.</summary>
    DateTimeOffset OccurredAt { get; }
}

/// <summary>
/// Outbound bus contract. Phase 1 chỉ cần 1 method; Phase 2+ sẽ thêm
/// transactional outbox, retries, dead-letter.
/// </summary>
public interface IIntegrationEventBus
{
    Task PublishAsync(IIntegrationEvent @event, CancellationToken cancellationToken = default);
}
