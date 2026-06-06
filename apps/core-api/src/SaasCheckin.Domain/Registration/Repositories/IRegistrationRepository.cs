using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.ValueObjects;

namespace SaasCheckin.Domain.Registration.Repositories;

public interface IRegistrationRepository
{
    Task<Registration?> FindByIdAsync(RegistrationId id, Guid organizationId, CancellationToken ct = default);
    Task<Registration?> FindByJtiAsync(Guid jti, Guid organizationId, CancellationToken ct = default);
    Task<IReadOnlyList<Registration>> ListByOrderAsync(Guid orderId, Guid organizationId, CancellationToken ct = default);
    Task<IReadOnlyList<Registration>> ListByEventAsync(Guid eventId, Guid organizationId, int skip, int take, CancellationToken ct = default);
    Task<IReadOnlyList<Registration>> ListByEmailAsync(string email, Guid organizationId, int skip, int take, CancellationToken ct = default);
    Task AddAsync(Registration registration, CancellationToken ct = default);
    Task UpdateAsync(Registration registration, CancellationToken ct = default);
}
