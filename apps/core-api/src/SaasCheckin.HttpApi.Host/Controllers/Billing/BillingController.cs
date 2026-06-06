using MediatR;
using Microsoft.AspNetCore.Mvc;
using SaasCheckin.Application.Billing.Commands;
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
}

public sealed record SubscribeRequestDto(
    Guid OrganizationId,
    Guid PlanId,
    bool StartTrial = true,
    string? ExternalSubscriptionId = null);

public sealed record CancelRequestDto(Guid OrganizationId, Guid ActorUserId);
public sealed record UpgradeRequestDto(Guid OrganizationId, Guid NewPlanId);
