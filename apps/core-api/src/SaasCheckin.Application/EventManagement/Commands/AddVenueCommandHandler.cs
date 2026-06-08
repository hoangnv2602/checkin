using MediatR;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed class AddVenueCommandHandler
    : IRequestHandler<AddVenueCommand, VenueId>
{
    private readonly IVenueRepository _venues;
    private readonly IClock _clock;

    public AddVenueCommandHandler(IVenueRepository venues, IClock clock)
    {
        _venues = venues;
        _clock = clock;
    }

    public async Task<VenueId> Handle(AddVenueCommand cmd, CancellationToken ct)
    {
        var address = VenueAddress.Create(
            cmd.Country, cmd.StreetLine1, cmd.StreetLine2,
            cmd.City, cmd.Region, cmd.PostalCode);

        Capacity? capacity = cmd.Capacity.HasValue ? Capacity.Create(cmd.Capacity.Value) : null;
        GeoLocation? geo = (cmd.Latitude.HasValue && cmd.Longitude.HasValue)
            ? GeoLocation.Create(cmd.Latitude.Value, cmd.Longitude.Value)
            : null;

        var venue = Venue.Create(
            cmd.OrganizationId, cmd.Name, cmd.Description,
            address, capacity, geo, _clock);
        await _venues.AddAsync(venue, ct);
        return venue.Id;
    }
}
