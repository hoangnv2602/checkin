// apps/core-api/src/SaasCheckin.Domain/Billing/Repositories/IPayoutRepository.cs
// I-803 — Payout repository interface. Implementation ở Infrastructure layer.
namespace SaasCheckin.Domain.Billing.Repositories;

using SaasCheckin.Domain.Billing.Aggregates;

public interface IPayoutRepository
{
    Task<Payout?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<Payout>> ListByOrganizationAsync(Guid organizationId, int skip, int take, CancellationToken ct = default);
    Task AddAsync(Payout payout, CancellationToken ct = default);
    Task UpdateAsync(Payout payout, CancellationToken ct = default);
}
