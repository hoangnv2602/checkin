using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed record CreateEventCommand(
    Guid OrganizationId,
    string Title,
    string? Description,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    int Capacity) : IRequest<EventId>;

public sealed class CreateEventCommandHandler
    : IRequestHandler<CreateEventCommand, EventId>
{
    private readonly IEventRepository _events;
    private readonly IClock _clock;

    public CreateEventCommandHandler(IEventRepository events, IClock clock)
    {
        _events = events;
        _clock = clock;
    }

    public async Task<EventId> Handle(CreateEventCommand cmd, CancellationToken ct)
    {
        var @event = Event.Create(
            cmd.OrganizationId,
            cmd.Title,
            cmd.Description,
            EventPeriod.Create(cmd.StartAt, cmd.EndAt),
            Capacity.Create(cmd.Capacity),
            _clock);
        await _events.AddAsync(@event, ct);
        return @event.Id;
    }
}
