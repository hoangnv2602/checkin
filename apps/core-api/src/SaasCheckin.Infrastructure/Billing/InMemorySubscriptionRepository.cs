// apps/core-api/src/SaasCheckin.Infrastructure/Billing/InMemorySubscriptionRepository.cs
//
// Phase 0 in-memory stub for ISubscriptionRepository. See
// InMemoryEventRepository for the full rationale. One subscription per org
// (current design: ISubscriptionRepository.FindByOrganizationAsync), so we
// keep two indexes — by orgId and by subscriptionId — sharing the same
// underlying records.
using System.Collections.Concurrent;
using SaasCheckin.Domain.Billing.Aggregates;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.ValueObjects;

namespace SaasCheckin.Infrastructure.Billing;

public sealed class InMemorySubscriptionRepository : ISubscriptionRepository
{
    private readonly ConcurrentDictionary<Guid, Subscription> _byOrg = new();
    private readonly ConcurrentDictionary<Guid, Subscription> _byId = new();

    public Task<Subscription?> FindByOrganizationAsync(Guid organizationId, CancellationToken ct = default)
    {
        _byOrg.TryGetValue(organizationId, out var s);
        return Task.FromResult<Subscription?>(s);
    }

    public Task<Subscription?> FindByIdAsync(SubscriptionId id, CancellationToken ct = default)
    {
        _byId.TryGetValue(id.Value, out var s);
        return Task.FromResult<Subscription?>(s);
    }

    public Task AddAsync(Subscription subscription, CancellationToken ct = default)
    {
        _byOrg[subscription.OrganizationId] = subscription;
        _byId[subscription.Id.Value] = subscription;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(Subscription subscription, CancellationToken ct = default)
    {
        _byOrg[subscription.OrganizationId] = subscription;
        _byId[subscription.Id.Value] = subscription;
        return Task.CompletedTask;
    }
}
