using MediatR;
using SaasCheckin.Domain.Billing.Repositories;

namespace SaasCheckin.Application.Billing.Queries;

public sealed record GetCurrentSubscriptionQuery(Guid OrganizationId)
    : IRequest<SubscriptionDto?>;

public sealed record SubscriptionDto(
    Guid Id,
    Guid OrganizationId,
    Guid PlanId,
    string State,
    string CurrentPeriodStart,
    string CurrentPeriodEnd,
    string? TrialEndsAt,
    string? CancelledAt,
    string? ExternalSubscriptionId);

public sealed class GetCurrentSubscriptionQueryHandler
    : IRequestHandler<GetCurrentSubscriptionQuery, SubscriptionDto?>
{
    private readonly ISubscriptionRepository _subs;

    public GetCurrentSubscriptionQueryHandler(ISubscriptionRepository subs) => _subs = subs;

    public async Task<SubscriptionDto?> Handle(GetCurrentSubscriptionQuery q, CancellationToken ct)
    {
        var sub = await _subs.FindByOrganizationAsync(q.OrganizationId, ct);
        if (sub is null) return null;
        return new SubscriptionDto(
            sub.Id.Value,
            sub.OrganizationId,
            sub.PlanId.Value,
            sub.State.ToString(),
            sub.CurrentPeriodStart.ToString("O"),
            sub.CurrentPeriodEnd.ToString("O"),
            sub.TrialEndsAt?.ToString("O"),
            sub.CancelledAt?.ToString("O"),
            sub.ExternalSubscriptionId);
    }
}
