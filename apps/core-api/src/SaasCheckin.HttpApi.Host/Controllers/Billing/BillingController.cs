using MediatR;
using Microsoft.AspNetCore.Mvc;
using SaasCheckin.Application.Billing.Commands;
using SaasCheckin.Application.Billing.Queries;
using SaasCheckin.Domain.Billing.ValueObjects;

namespace SaasCheckin.HttpApi.Host.Controllers.Billing;

[ApiController]
[Route("v1/billing")]
public sealed class BillingController : ControllerBase
{
    private readonly IMediator _mediator;
    public BillingController(IMediator mediator) => _mediator = mediator;

    [HttpPost("subscriptions")]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeRequestDto dto, CancellationToken ct)
    {
        var id = await _mediator.Send(new SubscribeToPlanCommand(
            dto.OrganizationId, PlanId.From(dto.PlanId), dto.StartTrial, dto.ExternalSubscriptionId), ct);
        return Ok(new { subscription_id = id });
    }

    [HttpPost("subscriptions/cancel")]
    public async Task<IActionResult> Cancel([FromBody] CancelRequestDto dto, CancellationToken ct)
    {
        await _mediator.Send(new CancelSubscriptionCommand(dto.OrganizationId, dto.ActorUserId), ct);
        return Ok();
    }

    [HttpPost("subscriptions/upgrade")]
    public async Task<IActionResult> Upgrade([FromBody] UpgradeRequestDto dto, CancellationToken ct)
    {
        await _mediator.Send(new UpgradePlanCommand(dto.OrganizationId, PlanId.From(dto.NewPlanId)), ct);
        return Ok();
    }

    [HttpPost("subscriptions/past-due")]
    public async Task<IActionResult> MarkPastDue([FromBody] PastDueRequestDto dto, CancellationToken ct)
    {
        await _mediator.Send(new MarkSubscriptionPastDueCommand(dto.OrganizationId), ct);
        return Ok();
    }

    /// <summary>Read-only: get current subscription for tenant. Used by BFF billing UI.</summary>
    [HttpGet("subscriptions/{organizationId:guid}")]
    public async Task<IActionResult> GetCurrent(Guid organizationId, CancellationToken ct)
    {
        // Reuse GetSubscriptionQuery (added in I-501). Returns null if no sub.
        var query = new GetCurrentSubscriptionQuery(organizationId);
        var sub = await _mediator.Send(query, ct);
        if (sub is null) return NotFound();
        return Ok(sub);
    }

    /// <summary>List all plans (no auth — used by /billing upgrade UI).</summary>
    [HttpGet("plans")]
    public async Task<IActionResult> ListPlans(CancellationToken ct)
    {
        var plans = await _mediator.Send(new ListPlansQuery(), ct);
        return Ok(plans);
    }

    /// <summary>Check plan limit cho 1 tenant (called by BFF guard trước khi mutate).</summary>
    [HttpPost("plan-limit/check")]
    public async Task<IActionResult> CheckPlanLimit([FromBody] CheckPlanLimitDto dto, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanLimitKind>(dto.Kind, ignoreCase: true, out var kind))
            return BadRequest(new { code = "invalid_kind", message = $"Unknown kind: {dto.Kind}" });
        var result = await _mediator.Send(
            new CheckPlanLimitCommand(dto.OrganizationId, kind, dto.RequestedDelta), ct);
        return Ok(result);
    }

    /// <summary>Usage meter for billing UI.</summary>
    [HttpGet("usage")]
    public async Task<IActionResult> Usage([FromQuery] Guid organizationId, CancellationToken ct)
    {
        var usage = await _mediator.Send(new GetUsageMeterQuery(organizationId), ct);
        return Ok(usage);
    }

    /// <summary>List invoices cho 1 tenant (paginated).</summary>
    [HttpGet("invoices")]
    public async Task<IActionResult> Invoices(
        [FromQuery] Guid organizationId,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 20,
        CancellationToken ct = default)
    {
        var invoices = await _mediator.Send(new ListInvoicesQuery(organizationId, skip, take), ct);
        return Ok(invoices);
    }
}

public sealed record CheckPlanLimitDto(
    Guid OrganizationId,
    string Kind,
    int RequestedDelta = 1);

public sealed record SubscribeRequestDto(
    Guid OrganizationId,
    Guid PlanId,
    bool StartTrial = true,
    string? ExternalSubscriptionId = null);

public sealed record CancelRequestDto(Guid OrganizationId, Guid ActorUserId);
public sealed record UpgradeRequestDto(Guid OrganizationId, Guid NewPlanId);
public sealed record PastDueRequestDto(Guid OrganizationId);
