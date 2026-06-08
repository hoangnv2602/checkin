using MediatR;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed class UpdateEventCommandHandler
    : IRequestHandler<UpdateEventCommand, Unit>
{
    private readonly IEventRepository _events;
    private readonly IClock _clock;

    public UpdateEventCommandHandler(IEventRepository events, IClock clock)
    {
        _events = events;
        _clock = clock;
    }

    public async Task<Unit> Handle(UpdateEventCommand cmd, CancellationToken ct)
    {
        var @event = await _events.FindByIdAsync(EventId.From(cmd.EventId), cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException($"Event {cmd.EventId} not found");

        EventPeriod? period = null;
        if (cmd.StartAt.HasValue && cmd.EndAt.HasValue)
            period = EventPeriod.Create(cmd.StartAt.Value, cmd.EndAt.Value);

        Capacity? capacity = cmd.Capacity.HasValue ? Capacity.Create(cmd.Capacity.Value) : null;

        @event.Update(cmd.Title, cmd.Description, period, capacity, _clock);
        await _events.UpdateAsync(@event, ct);
        return Unit.Value;
    }
}
