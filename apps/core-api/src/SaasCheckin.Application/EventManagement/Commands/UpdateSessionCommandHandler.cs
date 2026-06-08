using MediatR;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed class UpdateSessionCommandHandler
    : IRequestHandler<UpdateSessionCommand, Unit>
{
    private readonly ISessionRepository _sessions;
    private readonly IClock _clock;

    public UpdateSessionCommandHandler(ISessionRepository sessions, IClock clock)
    {
        _sessions = sessions;
        _clock = clock;
    }

    public async Task<Unit> Handle(UpdateSessionCommand cmd, CancellationToken ct)
    {
        var session = await _sessions.FindByIdAsync(SessionId.From(cmd.SessionId), cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException($"Session {cmd.SessionId} not found");

        EventPeriod? period = null;
        if (cmd.StartAt.HasValue && cmd.EndAt.HasValue)
            period = EventPeriod.Create(cmd.StartAt.Value, cmd.EndAt.Value);

        Capacity? capacity = cmd.Capacity.HasValue ? Capacity.Create(cmd.Capacity.Value) : null;
        VenueId? venueId = cmd.ClearVenue ? null : (cmd.VenueId.HasValue ? VenueId.From(cmd.VenueId.Value) : null);

        session.Update(cmd.Title, cmd.Description, period, capacity, venueId, _clock);
        await _sessions.UpdateAsync(session, ct);
        return Unit.Value;
    }
}
