using MediatR;
using Microsoft.Extensions.Logging;

namespace SaasCheckin.Shared.Application.IntegrationEvents;

/// <summary>
/// Phase 1 stub — log + route qua MediatR in-process. Phase 2+ thay bằng
/// MassTransit + RabbitMQ + outbox table.
/// </summary>
public sealed class InMemoryIntegrationEventBus : IIntegrationEventBus
{
    private readonly IMediator _mediator;
    private readonly ILogger<InMemoryIntegrationEventBus> _logger;

    public InMemoryIntegrationEventBus(IMediator mediator, ILogger<InMemoryIntegrationEventBus> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    public async Task PublishAsync(IIntegrationEvent @event, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "[InMemoryIntegrationEventBus] Publishing {EventType} occurred at {OccurredAt}",
            @event.GetType().Name, @event.OccurredAt);

        // Phase 1: in-process. Phase 2: MassTransit IPublishEndpoint.
        await _mediator.Publish(@event, cancellationToken);
    }
}
