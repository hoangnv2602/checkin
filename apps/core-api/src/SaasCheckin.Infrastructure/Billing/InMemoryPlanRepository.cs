// apps/core-api/src/SaasCheckin.Infrastructure/Billing/InMemoryPlanRepository.cs
//
// Phase 0 in-memory stub for IPlanRepository. Plan is a global table
// (not multi-tenant — only the platform owner creates Plans via
// checkin-admin app, see I-108) so the dictionary is keyed by PlanId only.
// We additionally maintain an index on IsDefault so FindDefaultAsync is O(1).
using System.Collections.Concurrent;
using SaasCheckin.Domain.Billing.Aggregates;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.Billing.ValueObjects;

namespace SaasCheckin.Infrastructure.Billing;

public sealed class InMemoryPlanRepository : IPlanRepository
{
    private readonly ConcurrentDictionary<Guid, Plan> _byId = new();
    private Plan? _default;

    public Task<Plan?> FindByIdAsync(PlanId id, CancellationToken ct = default)
    {
        _byId.TryGetValue(id.Value, out var p);
        return Task.FromResult<Plan?>(p);
    }

    public Task<Plan?> FindDefaultAsync(CancellationToken ct = default) =>
        Task.FromResult(_default);

    public Task<IReadOnlyList<Plan>> ListAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<Plan>>(_byId.Values.OrderBy(p => p.Tier).ToList());

    public Task AddAsync(Plan plan, CancellationToken ct = default)
    {
        _byId[plan.Id.Value] = plan;
        if (plan.IsDefault) _default = plan;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(Plan plan, CancellationToken ct = default)
    {
        _byId[plan.Id.Value] = plan;
        if (plan.IsDefault) _default = plan;
        return Task.CompletedTask;
    }
}
