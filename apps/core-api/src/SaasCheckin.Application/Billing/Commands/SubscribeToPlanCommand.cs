using MediatR;
using SaasCheckin.Domain.Billing.Aggregates;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Billing.Commands;

public sealed record SubscribeToPlanCommand(
    Guid OrganizationId,
    PlanId PlanId,
    bool StartTrial,
    string? ExternalSubscriptionId) : IRequest<SubscriptionId>;

public sealed class SubscribeToPlanCommandHandler
    : IRequestHandler<SubscribeToPlanCommand, SubscriptionId>
{
    private static readonly TimeSpan TrialDuration = TimeSpan.FromDays(14);
    private static readonly TimeSpan MonthlyPeriod = TimeSpan.FromDays(30);

    private readonly ISubscriptionRepository _subs;
    private readonly IPlanRepository _plans;
    private readonly IClock _clock;

    public SubscribeToPlanCommandHandler(
        ISubscriptionRepository subs,
        IPlanRepository plans,
        IClock clock)
    {
        _subs = subs;
        _plans = plans;
        _clock = clock;
    }

    public async Task<SubscriptionId> Handle(SubscribeToPlanCommand cmd, CancellationToken ct)
    {
        var plan = await _plans.FindByIdAsync(cmd.PlanId, ct)
            ?? throw new InvalidOperationException("Plan not found");

        var existing = await _subs.FindByOrganizationAsync(cmd.OrganizationId, ct);
        if (existing is { IsActive: true })
            throw new InvalidOperationException("Organization already has an active subscription");

        Subscription sub = cmd.StartTrial
            ? Subscription.StartTrial(cmd.OrganizationId, plan.Id, TrialDuration, MonthlyPeriod, _clock)
            : Subscription.Activate(cmd.OrganizationId, plan.Id, MonthlyPeriod,
                cmd.ExternalSubscriptionId ?? "manual", _clock);

        await _subs.AddAsync(sub, ct);
        return sub.Id;
    }
}
