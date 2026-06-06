using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.ValueObjects;
using RegistrationEntity = SaasCheckin.Domain.Registration.Aggregates.Registration;

namespace SaasCheckin.Domain.Registration.Repositories;

public interface IRegistrationRepository
{
    Task<RegistrationEntity?> FindByIdAsync(RegistrationId id, Guid organizationId, CancellationToken ct = default);
    Task<RegistrationEntity?> FindByJtiAsync(Guid jti, Guid organizationId, CancellationToken ct = default);
    Task<IReadOnlyList<RegistrationEntity>> ListByOrderAsync(Guid orderId, Guid organizationId, CancellationToken ct = default);
    Task<IReadOnlyList<RegistrationEntity>> ListByEventAsync(Guid eventId, Guid organizationId, int skip, int take, CancellationToken ct = default);
    Task<IReadOnlyList<RegistrationEntity>> ListByEmailAsync(string email, Guid organizationId, int skip, int take, CancellationToken ct = default);
    Task AddAsync(RegistrationEntity registration, CancellationToken ct = default);
    Task UpdateAsync(RegistrationEntity registration, CancellationToken ct = default);
}
