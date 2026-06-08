using MediatR;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed class ChangeVenueStatusCommandHandler
    : IRequestHandler<ChangeVenueStatusCommand, Unit>
{
    private readonly IVenueRepository _venues;
    private readonly IClock _clock;

    public ChangeVenueStatusCommandHandler(IVenueRepository venues, IClock clock)
    {
        _venues = venues;
        _clock = clock;
    }

    public async Task<Unit> Handle(ChangeVenueStatusCommand cmd, CancellationToken ct)
    {
        var venue = await _venues.FindByIdAsync(VenueId.From(cmd.VenueId), cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException($"Venue {cmd.VenueId} not found");

        switch (cmd.Action)
        {
            case VenueAction.Activate:   venue.Activate(_clock); break;
            case VenueAction.Deactivate: venue.Deactivate(_clock); break;
            case VenueAction.Archive:    venue.Archive(_clock); break;
            default: throw new ArgumentOutOfRangeException(nameof(cmd), cmd.Action, "Unknown venue action");
        }

        await _venues.UpdateAsync(venue, ct);
        return Unit.Value;
    }
}
