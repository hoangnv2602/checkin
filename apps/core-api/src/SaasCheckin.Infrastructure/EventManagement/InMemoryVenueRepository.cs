// apps/core-api/src/SaasCheckin.Infrastructure/EventManagement/InMemoryVenueRepository.cs
//
// Phase 0 in-memory stub for IVenueRepository. See InMemoryEventRepository
// for the full rationale. ConcurrentDictionary keyed by (orgId, venueId).
using System.Collections.Concurrent;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Infrastructure.EventManagement;

public sealed class InMemoryVenueRepository : IVenueRepository
{
    private readonly ConcurrentDictionary<(Guid Org, Guid Id), Venue> _store = new();

    public Task<Venue?> FindByIdAsync(VenueId id, Guid organizationId, CancellationToken ct = default)
    {
        _store.TryGetValue((organizationId, id.Value), out var v);
        return Task.FromResult<Venue?>(v);
    }

    public Task<IReadOnlyList<Venue>> ListAsync(
        Guid organizationId, VenueStatus? status, int skip, int take, CancellationToken ct = default)
    {
        var q = _store.Values.Where(v => v.OrganizationId == organizationId);
        if (status.HasValue) q = q.Where(v => v.Status == status.Value);
        var page = q.OrderByDescending(v => v.CreatedAt).Skip(skip).Take(take).ToList();
        return Task.FromResult<IReadOnlyList<Venue>>(page);
    }

    public Task AddAsync(Venue venue, CancellationToken ct = default)
    {
        _store[(venue.OrganizationId, venue.Id.Value)] = venue;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(Venue venue, CancellationToken ct = default)
    {
        _store[(venue.OrganizationId, venue.Id.Value)] = venue;
        return Task.CompletedTask;
    }
}
