using MediatR;
using Microsoft.AspNetCore.Mvc;
using SaasCheckin.Application.CheckIn.Commands;
using SaasCheckin.Application.CheckIn.Queries;

namespace SaasCheckin.HttpApi.Host.Controllers.CheckIn;

[ApiController]
[Route("v1/checkin")]
public sealed class CheckInController : ControllerBase
{
    private readonly IMediator _mediator;
    public CheckInController(IMediator mediator) => _mediator = mediator;

    [HttpPost("scan")]
    public async Task<IActionResult> Scan([FromBody] ScanRequestDto dto, CancellationToken ct)
    {
        var result = await _mediator.Send(new ScanQrCommand(
            dto.OrganizationId, dto.EventId, dto.GateId, dto.StaffUserId,
            dto.Jti, dto.RegistrationId, dto.Signature), ct);
        return Ok(new
        {
            check_in_record_id = result.CheckInRecordId,
            status = result.Status.ToString(),
            reject_reason = result.RejectReason,
            attendee_name = result.AttendeeName,
            jti = result.Jti,
        });
    }

    [HttpPost("manual")]
    public async Task<IActionResult> Manual([FromBody] ManualRequestDto dto, CancellationToken ct)
    {
        var result = await _mediator.Send(new ManualCheckInCommand(
            dto.OrganizationId, dto.EventId, dto.GateId, dto.StaffUserId,
            dto.AttendeeEmail), ct);
        return Ok(new
        {
            check_in_record_id = result.CheckInRecordId,
            status = result.Status.ToString(),
            reject_reason = result.RejectReason,
            attendee_name = result.AttendeeName,
        });
    }

    [HttpPost("undo")]
    public async Task<IActionResult> Undo([FromBody] UndoRequestDto dto, CancellationToken ct)
    {
        await _mediator.Send(new UndoCheckInCommand(
            dto.OrganizationId, dto.EventId, dto.CheckInRecordId, dto.StaffUserId, dto.Reason), ct);
        return Ok();
    }

    [HttpGet("stats/{eventId:guid}")]
    public async Task<IActionResult> Stats(Guid eventId, [FromQuery] Guid organizationId, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetEventStatsQuery(organizationId, eventId), ct);
        return Ok(result);
    }
}

public sealed record ScanRequestDto(
    Guid OrganizationId,
    Guid EventId,
    Guid GateId,
    Guid StaffUserId,
    Guid Jti,
    Guid RegistrationId,
    string Signature);

public sealed record ManualRequestDto(
    Guid OrganizationId,
    Guid EventId,
    Guid GateId,
    Guid StaffUserId,
    string AttendeeEmail);

public sealed record UndoRequestDto(
    Guid OrganizationId,
    Guid EventId,
    Guid CheckInRecordId,
    Guid StaffUserId,
    string Reason);
