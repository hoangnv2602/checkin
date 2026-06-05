using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;

namespace SaasCheckin.Domain.PlatformOperations.Repositories;

public interface IPlatformSessionRepository
{
    Task<PlatformSession?> FindByIdAsync(PlatformSessionId id, CancellationToken ct = default);
    Task<PlatformSession?> FindByRefreshTokenHashAsync(string hash, CancellationToken ct = default);
    Task AddAsync(PlatformSession session, CancellationToken ct = default);
    Task UpdateAsync(PlatformSession session, CancellationToken ct = default);
}
