using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Domain.EventManagement.Repositories;

public interface ISessionRepository
{
    Task<Session?> FindByIdAsync(SessionId id, Guid organizationId, CancellationToken ct = default);
    Task<IReadOnlyList<Session>> ListByEventAsync(
        Guid organizationId, EventId eventId, int skip, int take, CancellationToken ct = default);
    Task AddAsync(Session session, CancellationToken ct = default);
    Task UpdateAsync(Session session, CancellationToken ct = default);
}
