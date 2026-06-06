using MediatR;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed record UpdateVenueCommand(
    Guid OrganizationId,
    Guid VenueId,
    string? Name,
    string? Description,
    string? Country,
    string? StreetLine1,
    string? StreetLine2,
    string? City,
    string? Region,
    string? PostalCode,
    int? Capacity,
    double? Latitude,
    double? Longitude,
    bool ClearGeo) : IRequest<Unit>;

public sealed class UpdateVenueCommandHandler
    : IRequestHandler<UpdateVenueCommand, Unit>
{
    private readonly IVenueRepository _venues;
    private readonly IClock _clock;

    public UpdateVenueCommandHandler(IVenueRepository venues, IClock clock)
    {
        _venues = venues;
        _clock = clock;
    }

    public async Task<Unit> Handle(UpdateVenueCommand cmd, CancellationToken ct)
    {
        var venue = await _venues.FindByIdAsync(VenueId.From(cmd.VenueId), cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException($"Venue {cmd.VenueId} not found");

        VenueAddress? address = null;
        if (cmd.Country is not null)
        {
            address = VenueAddress.Create(
                cmd.Country, cmd.StreetLine1, cmd.StreetLine2,
                cmd.City, cmd.Region, cmd.PostalCode);
        }

        Capacity? capacity = cmd.Capacity.HasValue ? Capacity.Create(cmd.Capacity.Value) : null;
        GeoLocation? geo = (cmd.Latitude.HasValue && cmd.Longitude.HasValue)
            ? GeoLocation.Create(cmd.Latitude.Value, cmd.Longitude.Value)
            : null;

        venue.Update(cmd.Name, cmd.Description, address, capacity, geo, cmd.ClearGeo, _clock);
        await _venues.UpdateAsync(venue, ct);
        return Unit.Value;
    }
}
