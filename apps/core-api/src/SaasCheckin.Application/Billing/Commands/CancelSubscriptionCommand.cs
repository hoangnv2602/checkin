using MediatR;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.Billing.Commands;

public sealed record CancelSubscriptionCommand(
    Guid OrganizationId,
    Guid ActorUserId) : IRequest;

public sealed class CancelSubscriptionCommandHandler
    : IRequestHandler<CancelSubscriptionCommand>
{
    private readonly ISubscriptionRepository _subs;
    private readonly IClock _clock;

    public CancelSubscriptionCommandHandler(ISubscriptionRepository subs, IClock clock)
    {
        _subs = subs;
        _clock = clock;
    }

    public async Task Handle(CancelSubscriptionCommand cmd, CancellationToken ct)
    {
        var sub = await _subs.FindByOrganizationAsync(cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException("No subscription for organization");
        sub.Cancel(_clock);
        await _subs.UpdateAsync(sub, ct);
    }
}
