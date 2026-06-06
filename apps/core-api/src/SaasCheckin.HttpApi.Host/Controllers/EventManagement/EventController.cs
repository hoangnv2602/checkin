using MediatR;
using Microsoft.AspNetCore.Mvc;
using SaasCheckin.Application.EventManagement.Commands;
using SaasCheckin.Application.EventManagement.Queries;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.HttpApi.Host.Controllers.EventManagement;

[ApiController]
[Route("v1/events")]
public sealed class EventController : ControllerBase
{
    private readonly IMediator _mediator;
    public EventController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid organizationId,
        [FromQuery] EventStatus? status,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 20,
        CancellationToken ct = default)
    {
        if (take is < 1 or > 100) take = 20;
        var events = await _mediator.Send(
            new ListEventsQuery(organizationId, status, skip, take), ct);
        return Ok(events.Select(EventResponse.From));
    }

    [HttpGet("{eventId:guid}")]
    public async Task<IActionResult> Get(
        [FromRoute] Guid eventId,
        [FromQuery] Guid organizationId,
        CancellationToken ct)
    {
        var ev = await _mediator.Send(new GetEventQuery(organizationId, eventId), ct);
        return ev is null ? NotFound() : Ok(EventResponse.From(ev));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateEventRequestDto dto,
        CancellationToken ct)
    {
        var id = await _mediator.Send(new CreateEventCommand(
            dto.OrganizationId, dto.Title, dto.Description,
            dto.StartAt, dto.EndAt, dto.Capacity), ct);
        return CreatedAtAction(nameof(Get), new { eventId = id, organizationId = dto.OrganizationId },
            new { id });
    }

    [HttpPatch("{eventId:guid}")]
    public async Task<IActionResult> Update(
        [FromRoute] Guid eventId,
        [FromBody] UpdateEventRequestDto dto,
        CancellationToken ct)
    {
        await _mediator.Send(new UpdateEventCommand(
            dto.OrganizationId, eventId,
            dto.Title, dto.Description,
            dto.StartAt, dto.EndAt, dto.Capacity), ct);
        return NoContent();
    }

    [HttpPost("{eventId:guid}/publish")]
    public async Task<IActionResult> Publish(
        [FromRoute] Guid eventId,
        [FromBody] OrganizationScopedRequest dto,
        CancellationToken ct)
    {
        await _mediator.Send(new PublishEventCommand(dto.OrganizationId, eventId), ct);
        return Ok();
    }

    [HttpPost("{eventId:guid}/cancel")]
    public async Task<IActionResult> Cancel(
        [FromRoute] Guid eventId,
        [FromBody] OrganizationScopedRequest dto,
        CancellationToken ct)
    {
        await _mediator.Send(new CancelEventCommand(dto.OrganizationId, eventId), ct);
        return Ok();
    }

    [HttpPost("{eventId:guid}/complete")]
    public async Task<IActionResult> Complete(
        [FromRoute] Guid eventId,
        [FromBody] OrganizationScopedRequest dto,
        CancellationToken ct)
    {
        await _mediator.Send(new CompleteEventCommand(dto.OrganizationId, eventId), ct);
        return Ok();
    }
}

public sealed record CreateEventRequestDto(
    Guid OrganizationId,
    string Title,
    string? Description,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    int Capacity);

public sealed record UpdateEventRequestDto(
    Guid OrganizationId,
    string? Title,
    string? Description,
    DateTimeOffset? StartAt,
    DateTimeOffset? EndAt,
    int? Capacity);

public sealed record OrganizationScopedRequest(Guid OrganizationId);

public sealed record EventResponse(
    Guid Id,
    Guid OrganizationId,
    string Title,
    string? Description,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    int Capacity,
    int SoldTickets,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static EventResponse From(Domain.EventManagement.Aggregates.Event e) => new(
        e.Id, e.OrganizationId, e.Title, e.Description,
        e.Period.StartAt, e.Period.EndAt, e.Capacity, e.SoldTickets,
        e.Status.ToString().ToLowerInvariant(), e.CreatedAt, e.UpdatedAt);
}
