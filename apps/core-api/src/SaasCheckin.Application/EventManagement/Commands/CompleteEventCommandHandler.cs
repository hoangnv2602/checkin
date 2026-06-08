using MediatR;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed class CompleteEventCommandHandler
    : IRequestHandler<CompleteEventCommand, Unit>
{
    private readonly IEventRepository _events;
    private readonly IClock _clock;

    public CompleteEventCommandHandler(IEventRepository events, IClock clock)
    {
        _events = events;
        _clock = clock;
    }

    public async Task<Unit> Handle(CompleteEventCommand cmd, CancellationToken ct)
    {
        var @event = await _events.FindByIdAsync(EventId.From(cmd.EventId), cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException($"Event {cmd.EventId} not found");
        @event.Complete(_clock);
        await _events.UpdateAsync(@event, ct);
        return Unit.Value;
    }
}
