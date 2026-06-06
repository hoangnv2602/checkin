using MediatR;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Billing.Commands;

public sealed record UpgradePlanCommand(
    Guid OrganizationId,
    PlanId NewPlanId) : IRequest;

public sealed class UpgradePlanCommandHandler : IRequestHandler<UpgradePlanCommand>
{
    private readonly ISubscriptionRepository _subs;
    private readonly IClock _clock;

    public UpgradePlanCommandHandler(ISubscriptionRepository subs, IClock clock)
    {
        _subs = subs;
        _clock = clock;
    }

    public async Task Handle(UpgradePlanCommand cmd, CancellationToken ct)
    {
        var sub = await _subs.FindByOrganizationAsync(cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException("No subscription for organization");
        sub.UpgradePlan(cmd.NewPlanId, _clock);
        await _subs.UpdateAsync(sub, ct);
    }
}
