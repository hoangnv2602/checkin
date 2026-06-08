using MediatR;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Billing.Commands;

public sealed class MarkSubscriptionPastDueCommandHandler
    : IRequestHandler<MarkSubscriptionPastDueCommand>
{
    private readonly ISubscriptionRepository _subs;
    private readonly IClock _clock;

    public MarkSubscriptionPastDueCommandHandler(ISubscriptionRepository subs, IClock clock)
    {
        _subs = subs;
        _clock = clock;
    }

    public async Task Handle(MarkSubscriptionPastDueCommand cmd, CancellationToken ct)
    {
        var sub = await _subs.FindByOrganizationAsync(cmd.OrganizationId, ct);
        if (sub is null) return;  // no subscription — nothing to mark
        if (sub.State == Domain.Billing.Aggregates.SubscriptionState.PastDue ||
            sub.State == Domain.Billing.Aggregates.SubscriptionState.Cancelled) return;
        sub.MarkPastDue(_clock);
        await _subs.UpdateAsync(sub, ct);
    }
}
