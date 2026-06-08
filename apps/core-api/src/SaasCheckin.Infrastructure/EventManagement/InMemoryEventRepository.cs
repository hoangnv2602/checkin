// apps/core-api/src/SaasCheckin.Infrastructure/EventManagement/InMemoryEventRepository.cs
//
// Phase 0 in-memory stub for IEventRepository.
//
// Why: SaasCheckin.EntityFrameworkCore has no EventManagement folder yet
// (entity configurations + DbSet registrations land with the EF migration
// in Phase 2 — I-201 wire-up). For `dotnet run` to boot in Phase 0, the
// MediatR handlers that take IEventRepository as a ctor parameter need a
// resolvable type. This stub satisfies that: it stores aggregates in a
// ConcurrentDictionary keyed by EventId, partitioned by OrganizationId
// (tenant boundary) so RLS semantics are preserved in-memory.
//
// Replacement: in Phase 2, swap registration in
// EventManagementInfrastructureModule to point at an EF Core impl backed
// by SaasCheckinDbContext.Events. Aggregates hydrate via the existing
// EventEntityConfiguration (to be added). Until then, all data is lost
// on process restart — consistent with the Phase 0 in-memory convention
// used by api-gateway stores (see form-template.store.ts et al.).
using System.Collections.Concurrent;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Infrastructure.EventManagement;

public sealed class InMemoryEventRepository : IEventRepository
{
    // Keyed by (orgId, eventId) so cross-tenant lookups stay isolated.
    private readonly ConcurrentDictionary<(Guid Org, Guid Id), Event> _store = new();

    public Task<Event?> FindByIdAsync(EventId id, Guid organizationId, CancellationToken ct = default)
    {
        _store.TryGetValue((organizationId, id.Value), out var e);
        return Task.FromResult<Event?>(e);
    }

    public Task<IReadOnlyList<Event>> ListAsync(
        Guid organizationId, EventStatus? status, int skip, int take, CancellationToken ct = default)
    {
        var q = _store.Values.Where(e => e.OrganizationId == organizationId);
        if (status.HasValue) q = q.Where(e => e.Status == status.Value);
        var page = q.OrderByDescending(e => e.CreatedAt).Skip(skip).Take(take).ToList();
        return Task.FromResult<IReadOnlyList<Event>>(page);
    }

    public Task AddAsync(Event @event, CancellationToken ct = default)
    {
        _store[(@event.OrganizationId, @event.Id.Value)] = @event;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(Event @event, CancellationToken ct = default)
    {
        _store[(@event.OrganizationId, @event.Id.Value)] = @event;
        return Task.CompletedTask;
    }
}
