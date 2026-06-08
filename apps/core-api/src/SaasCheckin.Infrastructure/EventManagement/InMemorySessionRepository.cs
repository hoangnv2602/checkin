// apps/core-api/src/SaasCheckin.Infrastructure/EventManagement/InMemorySessionRepository.cs
//
// Phase 0 in-memory stub for ISessionRepository. See InMemoryEventRepository
// for the full rationale. ConcurrentDictionary keyed by (orgId, sessionId).
using System.Collections.Concurrent;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Infrastructure.EventManagement;

public sealed class InMemorySessionRepository : ISessionRepository
{
    private readonly ConcurrentDictionary<(Guid Org, Guid Id), Session> _store = new();

    public Task<Session?> FindByIdAsync(SessionId id, Guid organizationId, CancellationToken ct = default)
    {
        _store.TryGetValue((organizationId, id.Value), out var s);
        return Task.FromResult<Session?>(s);
    }

    public Task<IReadOnlyList<Session>> ListByEventAsync(
        Guid organizationId, EventId eventId, int skip, int take, CancellationToken ct = default)
    {
        var page = _store.Values
            .Where(s => s.OrganizationId == organizationId && s.EventId.Value == eventId.Value)
            .OrderByDescending(s => s.CreatedAt)
            .Skip(skip)
            .Take(take)
            .ToList();
        return Task.FromResult<IReadOnlyList<Session>>(page);
    }

    public Task AddAsync(Session session, CancellationToken ct = default)
    {
        _store[(session.OrganizationId, session.Id.Value)] = session;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(Session session, CancellationToken ct = default)
    {
        _store[(session.OrganizationId, session.Id.Value)] = session;
        return Task.CompletedTask;
    }
}
