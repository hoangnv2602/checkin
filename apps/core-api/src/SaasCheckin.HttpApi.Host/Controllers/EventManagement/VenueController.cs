using MediatR;
using Microsoft.AspNetCore.Mvc;
using SaasCheckin.Application.EventManagement.Commands;
using SaasCheckin.Application.EventManagement.Queries;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.HttpApi.Host.Controllers.EventManagement;

[ApiController]
[Route("v1/venues")]
public sealed class VenueController : ControllerBase
{
    private readonly IMediator _mediator;
    public VenueController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid organizationId,
        [FromQuery] VenueStatus? status,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 20,
        CancellationToken ct = default)
    {
        if (take is < 1 or > 100) take = 20;
        var venues = await _mediator.Send(
            new ListVenuesQuery(organizationId, status, skip, take), ct);
        return Ok(venues.Select(VenueResponse.From));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] AddVenueRequestDto dto,
        CancellationToken ct)
    {
        var id = await _mediator.Send(new AddVenueCommand(
            dto.OrganizationId, dto.Name, dto.Description,
            dto.Country, dto.StreetLine1, dto.StreetLine2,
            dto.City, dto.Region, dto.PostalCode,
            dto.Capacity, dto.Latitude, dto.Longitude), ct);
        return CreatedAtAction(nameof(List), new { organizationId = dto.OrganizationId },
            new { id });
    }

    [HttpPatch("{venueId:guid}")]
    public async Task<IActionResult> Update(
        [FromRoute] Guid venueId,
        [FromBody] UpdateVenueRequestDto dto,
        CancellationToken ct)
    {
        await _mediator.Send(new UpdateVenueCommand(
            dto.OrganizationId, venueId,
            dto.Name, dto.Description,
            dto.Country, dto.StreetLine1, dto.StreetLine2,
            dto.City, dto.Region, dto.PostalCode,
            dto.Capacity, dto.Latitude, dto.Longitude, dto.ClearGeo), ct);
        return NoContent();
    }

    [HttpPost("{venueId:guid}/activate")]
    public Task<IActionResult> Activate(
        [FromRoute] Guid venueId,
        [FromBody] OrganizationScopedRequest dto,
        CancellationToken ct) =>
        ChangeStatus(dto.OrganizationId, venueId, VenueAction.Activate, ct);

    [HttpPost("{venueId:guid}/deactivate")]
    public Task<IActionResult> Deactivate(
        [FromRoute] Guid venueId,
        [FromBody] OrganizationScopedRequest dto,
        CancellationToken ct) =>
        ChangeStatus(dto.OrganizationId, venueId, VenueAction.Deactivate, ct);

    [HttpPost("{venueId:guid}/archive")]
    public Task<IActionResult> Archive(
        [FromRoute] Guid venueId,
        [FromBody] OrganizationScopedRequest dto,
        CancellationToken ct) =>
        ChangeStatus(dto.OrganizationId, venueId, VenueAction.Archive, ct);

    private async Task<IActionResult> ChangeStatus(
        Guid orgId, Guid venueId, VenueAction action, CancellationToken ct)
    {
        await _mediator.Send(new ChangeVenueStatusCommand(orgId, venueId, action), ct);
        return Ok();
    }
}

public sealed record AddVenueRequestDto(
    Guid OrganizationId,
    string Name,
    string? Description,
    string Country,
    string? StreetLine1,
    string? StreetLine2,
    string? City,
    string? Region,
    string? PostalCode,
    int? Capacity,
    double? Latitude,
    double? Longitude);

public sealed record UpdateVenueRequestDto(
    Guid OrganizationId,
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
    bool ClearGeo = false);

public sealed record VenueResponse(
    Guid Id,
    Guid OrganizationId,
    string Name,
    string? Description,
    string Country,
    string? StreetLine1,
    string? City,
    int? Capacity,
    double? Latitude,
    double? Longitude,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static VenueResponse From(Venue v) => new(
        v.Id, v.OrganizationId, v.Name, v.Description,
        v.Address.Country, v.Address.StreetLine1, v.Address.City,
        v.Capacity.HasValue ? v.Capacity.Value.Value : null,
        v.Geo?.Latitude, v.Geo?.Longitude,
        v.Status.ToString().ToLowerInvariant(), v.CreatedAt, v.UpdatedAt);
}
