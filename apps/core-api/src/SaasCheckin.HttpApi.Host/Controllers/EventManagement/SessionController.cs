using MediatR;
using Microsoft.AspNetCore.Mvc;
using SaasCheckin.Application.EventManagement.Commands;
using SaasCheckin.Application.EventManagement.Queries;
using SaasCheckin.Domain.EventManagement.Aggregates;

namespace SaasCheckin.HttpApi.Host.Controllers.EventManagement;

[ApiController]
[Route("v1/events/{eventId:guid}/sessions")]
public sealed class SessionController : ControllerBase
{
    private readonly IMediator _mediator;
    public SessionController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromRoute] Guid eventId,
        [FromQuery] Guid organizationId,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        if (take is < 1 or > 200) take = 50;
        var sessions = await _mediator.Send(
            new ListSessionsByEventQuery(organizationId, eventId, skip, take), ct);
        return Ok(sessions.Select(SessionResponse.From));
    }

    [HttpPost]
    public async Task<IActionResult> Add(
        [FromRoute] Guid eventId,
        [FromBody] AddSessionRequestDto dto,
        CancellationToken ct)
    {
        var id = await _mediator.Send(new AddSessionCommand(
            dto.OrganizationId, eventId,
            dto.Title, dto.Description,
            dto.StartAt, dto.EndAt, dto.Capacity, dto.VenueId), ct);
        return CreatedAtAction(nameof(List),
            new { eventId, organizationId = dto.OrganizationId },
            new { id });
    }

    [HttpPatch("{sessionId:guid}")]
    public async Task<IActionResult> Update(
        [FromRoute] Guid eventId,
        [FromRoute] Guid sessionId,
        [FromBody] UpdateSessionRequestDto dto,
        CancellationToken ct)
    {
        await _mediator.Send(new UpdateSessionCommand(
            dto.OrganizationId, sessionId,
            dto.Title, dto.Description,
            dto.StartAt, dto.EndAt, dto.Capacity,
            dto.VenueId, dto.ClearVenue), ct);
        return NoContent();
    }

    [HttpPost("{sessionId:guid}/schedule")]
    public Task<IActionResult> Schedule(
        [FromRoute] Guid sessionId,
        [FromBody] OrganizationScopedRequest dto,
        CancellationToken ct) =>
        ChangeStatus(dto.OrganizationId, sessionId, SessionAction.Schedule, ct);

    [HttpPost("{sessionId:guid}/start")]
    public Task<IActionResult> Start(
        [FromRoute] Guid sessionId,
        [FromBody] OrganizationScopedRequest dto,
        CancellationToken ct) =>
        ChangeStatus(dto.OrganizationId, sessionId, SessionAction.Start, ct);

    [HttpPost("{sessionId:guid}/end")]
    public Task<IActionResult> End(
        [FromRoute] Guid sessionId,
        [FromBody] OrganizationScopedRequest dto,
        CancellationToken ct) =>
        ChangeStatus(dto.OrganizationId, sessionId, SessionAction.End, ct);

    [HttpPost("{sessionId:guid}/cancel")]
    public Task<IActionResult> Cancel(
        [FromRoute] Guid sessionId,
        [FromBody] OrganizationScopedRequest dto,
        CancellationToken ct) =>
        ChangeStatus(dto.OrganizationId, sessionId, SessionAction.Cancel, ct);

    private async Task<IActionResult> ChangeStatus(
        Guid orgId, Guid sessionId, SessionAction action, CancellationToken ct)
    {
        await _mediator.Send(new ChangeSessionStatusCommand(orgId, sessionId, action), ct);
        return Ok();
    }
}

public sealed record AddSessionRequestDto(
    Guid OrganizationId,
    string Title,
    string? Description,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    int Capacity,
    Guid? VenueId);

public sealed record UpdateSessionRequestDto(
    Guid OrganizationId,
    string? Title,
    string? Description,
    DateTimeOffset? StartAt,
    DateTimeOffset? EndAt,
    int? Capacity,
    Guid? VenueId,
    bool ClearVenue = false);

public sealed record SessionResponse(
    Guid Id,
    Guid OrganizationId,
    Guid EventId,
    Guid? VenueId,
    string Title,
    string? Description,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    int Capacity,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static SessionResponse From(Session s) => new(
        s.Id, s.OrganizationId, s.EventId, s.VenueId.HasValue ? s.VenueId.Value.Value : null,
        s.Title, s.Description,
        s.Period.StartAt, s.Period.EndAt, s.Capacity,
        s.Status.ToString().ToLowerInvariant(), s.CreatedAt, s.UpdatedAt);
}
