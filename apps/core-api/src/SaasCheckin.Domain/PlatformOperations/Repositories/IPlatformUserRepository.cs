using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;

namespace SaasCheckin.Domain.PlatformOperations.Repositories;

public interface IPlatformUserRepository
{
    Task<PlatformUser?> FindByIdAsync(PlatformUserId id, CancellationToken ct = default);
    Task<PlatformUser?> FindByEmailAsync(string email, CancellationToken ct = default);
    Task AddAsync(PlatformUser user, CancellationToken ct = default);
    Task UpdateAsync(PlatformUser user, CancellationToken ct = default);
}
