using MediatR;
using Microsoft.AspNetCore.Mvc;
using SaasCheckin.Application.Audit.Queries;

namespace SaasCheckin.HttpApi.Host.Controllers.Audit;

[ApiController]
[Route("v1/audit")]
public sealed class AuditController : ControllerBase
{
    private readonly IMediator _mediator;
    public AuditController(IMediator mediator) => _mediator = mediator;

    [HttpGet("log")]
    public async Task<IActionResult> List(
        [FromQuery] Guid organizationId,
        [FromQuery] Guid? actorUserId,
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new ListAuditLogQuery(
            organizationId, actorUserId, action, entityType, from, to, skip, take), ct);
        return Ok(result);
    }
}
