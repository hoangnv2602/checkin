using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain;

namespace SaasCheckin.Domain.Identity.Repositories;

public interface IMembershipRepository : IRepository<Membership, MembershipId>
{
    /// <summary>Lấy tất cả memberships ACTIVE của 1 user (dùng cho JWT issue).</summary>
    Task<IReadOnlyList<Membership>> ListActiveByUserAsync(UserId userId, CancellationToken ct = default);

    /// <summary>Lấy membership ACTIVE của user trong 1 tenant cụ thể.</summary>
    Task<Membership?> FindActiveAsync(UserId userId, OrganizationId organizationId, CancellationToken ct = default);

    /// <summary>Check user đã có membership trong org (bất kỳ status) chưa.</summary>
    Task<bool> ExistsAsync(UserId userId, OrganizationId organizationId, CancellationToken ct = default);
}
