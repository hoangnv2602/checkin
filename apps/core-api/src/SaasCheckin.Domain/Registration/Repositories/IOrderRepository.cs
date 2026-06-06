using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.ValueObjects;

namespace SaasCheckin.Domain.Registration.Repositories;

public interface IOrderRepository
{
    Task<Order?> FindByIdAsync(OrderId id, Guid organizationId, CancellationToken ct = default);
    Task<Order?> FindByProviderSessionAsync(string providerSessionId, CancellationToken ct = default);
    Task<IReadOnlyList<Order>> ListByEventAsync(Guid eventId, Guid organizationId, int skip, int take, CancellationToken ct = default);
    Task<IReadOnlyList<Order>> ListPendingExpiredAsync(DateTimeOffset cutoff, int take, CancellationToken ct = default);
    Task AddAsync(Order order, CancellationToken ct = default);
    Task UpdateAsync(Order order, CancellationToken ct = default);
}
