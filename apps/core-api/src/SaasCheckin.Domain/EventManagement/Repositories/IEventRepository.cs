using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.ValueObjects;

namespace SaasCheckin.Domain.EventManagement.Repositories;

public interface IEventRepository
{
    Task<Event?> FindByIdAsync(EventId id, Guid organizationId, CancellationToken ct = default);
    Task<IReadOnlyList<Event>> ListAsync(Guid organizationId, EventStatus? status, int skip, int take, CancellationToken ct = default);
    Task AddAsync(Event @event, CancellationToken ct = default);
    Task UpdateAsync(Event @event, CancellationToken ct = default);
}
